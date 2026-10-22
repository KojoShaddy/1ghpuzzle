import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  Unsubscribe,
} from 'firebase/database';
import { ensureAnonymousAuth, getFirebaseServices } from '../lib/firebase';
import { PlayerProfile } from '../types/puzzle';

export interface OnlineParticipant {
  uid: string;
  playerId: string;
  playerName: string;
  region: string;
  isPlaying: boolean;
  state: 'online' | 'offline';
  lastChanged?: number;
}

export interface LivePresenceSnapshot {
  isConnected: boolean;
  onlineCount: number;
  participants: OnlineParticipant[];
  playingPlayerIds: Set<string>;
}

const CLIENT_PRESENCE_SESSION_KEY = 'ghana-puzzle-presence-client-id-v6';

function getOrCreateClientPresenceId(): string {
  if (typeof window === 'undefined') return 'client-server';
  try {
    // Use sessionStorage so two tabs on the same browser count as two distinct live browser sessions
    const existing = window.sessionStorage.getItem(CLIENT_PRESENCE_SESSION_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `conn-${crypto.randomUUID().slice(0, 10)}`
        : `conn-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(CLIENT_PRESENCE_SESSION_KEY, generated);
    return generated;
  } catch {
    return `conn-${Math.random().toString(36).slice(2, 10)}`;
  }
}

class FirebasePresenceManager {
  private clientConnId = getOrCreateClientPresenceId();
  private currentProfile: PlayerProfile | null = null;
  private currentIsPlaying = false;
  private isRtdbConnected = false;
  private rtdbParticipants = new Map<string, OnlineParticipant>();
  private apiParticipants = new Map<string, OnlineParticipant>();
  private listeners = new Set<(snapshot: LivePresenceSnapshot) => void>();

  private connectedUnsub?: Unsubscribe;
  private presenceListUnsub?: Unsubscribe;
  private activeRtdbPath: string | null = null;
  private initialized = false;
  private heartbeatTimer: number | null = null;
  private unloadHandlerRegistered = false;

  public init(profile: PlayerProfile | null, isPlaying = false): void {
    this.currentProfile = profile;
    this.currentIsPlaying = isPlaying;

    if (typeof window === 'undefined') return;

    if (!this.unloadHandlerRegistered) {
      this.unloadHandlerRegistered = true;
      const handleDisconnect = () => {
        this.leavePresenceSync();
      };
      window.addEventListener('pagehide', handleDisconnect);
      window.addEventListener('beforeunload', handleDisconnect);
    }

    if (!this.initialized) {
      this.initialized = true;
      void this.setupRealtimeDatabasePresence();
      this.setupBackendPresenceFallback();
    } else {
      void this.publishCurrentPresenceState();
    }
  }

  public updatePresence(profile: PlayerProfile | null, isPlaying: boolean): void {
    this.currentProfile = profile;
    this.currentIsPlaying = isPlaying;
    if (!this.initialized) {
      this.init(profile, isPlaying);
      return;
    }
    void this.publishCurrentPresenceState();
  }

  public getSnapshot(): LivePresenceSnapshot {
    const combined = new Map<string, OnlineParticipant>();

    for (const [key, p] of this.apiParticipants.entries()) {
      if (p.state === 'online') {
        combined.set(key, p);
      }
    }
    for (const [key, p] of this.rtdbParticipants.entries()) {
      if (p.state === 'online') {
        combined.set(key, p);
      }
    }

    const participants = Array.from(combined.values());
    const playingPlayerIds = new Set<string>();
    for (const p of participants) {
      if (p.isPlaying && p.playerId) {
        playingPlayerIds.add(p.playerId);
      }
    }

    const onlineCount = Math.max(
      participants.length,
      this.currentProfile ? 1 : 0
    );

    return {
      isConnected: this.isRtdbConnected || this.apiParticipants.size > 0,
      onlineCount,
      participants,
      playingPlayerIds,
    };
  }

  public subscribe(listener: (snapshot: LivePresenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setApiPresenceEntries(entries: OnlineParticipant[]): void {
    this.apiParticipants.clear();
    for (const item of entries) {
      if (item && item.uid && item.state === 'online') {
        this.apiParticipants.set(item.uid, item);
      }
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        // Ignore listener error
      }
    }
  }

  /**
   * Connects to Firebase Realtime Database `.info/connected` and `/presence`
   * with automatic server-side `onDisconnect().remove()` cleanup.
   */
  private async setupRealtimeDatabasePresence(): Promise<void> {
    const services = getFirebaseServices();
    if (!services || !services.rtdb) return;

    const user = await ensureAnonymousAuth();
    if (!user) return;

    const { rtdb } = services;
    // Key by auth UID + tab connection ID so multiple tabs or devices each have accurate disconnect tracking
    const presenceKey = `${user.uid}_${this.clientConnId}`;
    this.activeRtdbPath = `presence_v6/${presenceKey}`;

    const connectedRef = ref(rtdb, '.info/connected');
    const userPresenceRef = ref(rtdb, this.activeRtdbPath);
    const allPresenceRef = ref(rtdb, 'presence_v6');

    this.connectedUnsub = onValue(connectedRef, async (snap) => {
      const connected = snap.val() === true;
      this.isRtdbConnected = connected;

      if (!connected) {
        this.notifyListeners();
        return;
      }

      try {
        // Register automatic server-side disconnect handler first
        await onDisconnect(userPresenceRef).remove();
        await this.writeRtdbPresenceNode(user.uid);
      } catch {
        // Ignore RTDB permission or network errors
      }
    });

    this.presenceListUnsub = onValue(allPresenceRef, (snap) => {
      this.rtdbParticipants.clear();
      const val = snap.val() as Record<string, Record<string, unknown>> | null;
      if (val && typeof val === 'object') {
        for (const [key, raw] of Object.entries(val)) {
          if (!raw || typeof raw !== 'object') continue;
          const state = raw.state === 'offline' ? 'offline' : 'online';
          if (state !== 'online') continue;
          this.rtdbParticipants.set(key, {
            uid: String(raw.uid || key),
            playerId: String(raw.playerId || 'guest'),
            playerName: String(raw.playerName || 'Participant').slice(0, 32),
            region: String(raw.region || 'Greater Accra').slice(0, 32),
            isPlaying: Boolean(raw.isPlaying),
            state: 'online',
            lastChanged:
              typeof raw.lastChanged === 'number' ? raw.lastChanged : Date.now(),
          });
        }
      }
      this.notifyListeners();
    });
  }

  private async writeRtdbPresenceNode(authUid: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services || !services.rtdb || !this.activeRtdbPath) return;

    const userPresenceRef = ref(services.rtdb, this.activeRtdbPath);
    const profile = this.currentProfile;

    await set(userPresenceRef, {
      uid: authUid,
      connectionId: this.clientConnId,
      playerId: profile?.playerId || `anon-${authUid.slice(0, 8)}`,
      playerName: profile?.name?.trim() || 'Guest Player',
      region: profile?.region?.trim() || 'Greater Accra',
      isPlaying: Boolean(this.currentIsPlaying),
      state: 'online',
      connectedAt: serverTimestamp(),
      lastChanged: serverTimestamp(),
    });
  }

  private async publishCurrentPresenceState(): Promise<void> {
    // 1. Update Firebase Realtime Database presence node if configured
    const services = getFirebaseServices();
    if (services && services.rtdb && this.isRtdbConnected) {
      const user = await ensureAnonymousAuth();
      if (user) {
        try {
          await this.writeRtdbPresenceNode(user.uid);
        } catch {
          // Ignore RTDB write error
        }
      }
    }

    // 2. Also send heartbeat to backend /api/presence/heartbeat
    void this.sendBackendPresenceHeartbeat();
  }

  private setupBackendPresenceFallback(): void {
    void this.sendBackendPresenceHeartbeat();
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = window.setInterval(() => {
      void this.sendBackendPresenceHeartbeat();
    }, 5000);
  }

  private async sendBackendPresenceHeartbeat(): Promise<void> {
    try {
      const profile = this.currentProfile;
      const res = await fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: this.clientConnId,
          playerId: profile?.playerId || `guest-${this.clientConnId}`,
          playerName: profile?.name || 'Guest Player',
          region: profile?.region || 'Greater Accra',
          isPlaying: this.currentIsPlaying,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          onlineCount?: number;
          participants?: OnlineParticipant[];
        };
        if (Array.isArray(data.participants)) {
          this.setApiPresenceEntries(data.participants);
        }
      }
    } catch {
      // Ignore when offline
    }
  }

  private leavePresenceSync(): void {
    const services = getFirebaseServices();
    if (services && services.rtdb && this.activeRtdbPath) {
      try {
        void remove(ref(services.rtdb, this.activeRtdbPath));
      } catch {
        // Ignore
      }
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob(
          [JSON.stringify({ connectionId: this.clientConnId })],
          { type: 'application/json' }
        );
        navigator.sendBeacon('/api/presence/leave', blob);
      } else {
        void fetch('/api/presence/leave', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId: this.clientConnId }),
        });
      }
    } catch {
      // Ignore beacon error
    }
  }

  public destroy(): void {
    if (this.connectedUnsub) this.connectedUnsub();
    if (this.presenceListUnsub) this.presenceListUnsub();
    if (this.heartbeatTimer && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
    }
  }
}

export const firebasePresence = new FirebasePresenceManager();
