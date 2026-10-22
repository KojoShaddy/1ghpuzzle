import {
  LeaderboardState,
  PlayerProfile,
  PuzzleTileData,
  ScoreSubmissionResult,
} from '../types/puzzle';
import {
  calculateTimeScore,
  computeRankedLeaderboard,
  createPlayerIdFromProfile,
  getScoringTierForTime,
  validateSolvedBoard,
} from '../shared/scoring';
import {
  liveSessionSync,
  mergeTwoPlayerEntries,
  RawLeaderboardEntry,
  sanitizeEntry,
} from './liveSessionSync';

const PLAYER_ID_STORAGE_KEY = 'ghana-puzzle-player-id-v4';
const FALLBACK_PLAYERS_STORAGE_KEY = 'ghana-puzzle-leaderboard-entries-v4';
const COMPLETED_SESSIONS_STORAGE_KEY = 'ghana-puzzle-completed-sessions-v4';
const LEADERBOARD_BROADCAST_CHANNEL = 'ghana-puzzle-leaderboard-sync-v4';

export { createPlayerIdFromProfile };

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return res.ok && contentType.toLowerCase().includes('application/json');
}

export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'player-local';
  try {
    const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `player-${crypto.randomUUID().slice(0, 8)}`
        : `player-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'player-local';
  }
}

function notifyCrossTabLeaderboardChange(): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(LEADERBOARD_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'leaderboard_update', timestamp: Date.now() });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}

function getLocalCompletedSessions(): Record<string, ScoreSubmissionResult> {
  try {
    const raw = window.localStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ScoreSubmissionResult>) : {};
  } catch {
    return {};
  }
}

function saveLocalCompletedSession(sessionId: string, result: ScoreSubmissionResult): void {
  try {
    const map = getLocalCompletedSessions();
    map[sessionId] = result;
    window.localStorage.setItem(COMPLETED_SESSIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage error
  }
}

function loadStoredEntries(): RawLeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_PLAYERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RawLeaderboardEntry[] = [];
    for (const item of parsed) {
      const sanitized = sanitizeEntry(item);
      if (sanitized) out.push(sanitized);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Merges multiple lists of leaderboard entries without ever losing or downgrading any participant.
 */
function mergeAllEntries(
  ...entryLists: Array<Array<unknown> | undefined>
): RawLeaderboardEntry[] {
  const mergedMap = new Map<string, RawLeaderboardEntry>();

  for (const list of entryLists) {
    if (!Array.isArray(list)) continue;
    for (const rawItem of list) {
      const sanitized = sanitizeEntry(rawItem);
      if (!sanitized) continue;
      const existing = mergedMap.get(sanitized.playerId);
      if (!existing) {
        mergedMap.set(sanitized.playerId, sanitized);
      } else {
        mergedMap.set(sanitized.playerId, mergeTwoPlayerEntries(existing, sanitized));
      }
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Combines localStorage entries, live WebSocket/MQTT session entries, and any newly supplied entries,
 * persists the merged set back to both localStorage and liveSessionSync, and returns the unified list.
 */
function getAndPersistMergedEntries(additionalEntries?: unknown[]): RawLeaderboardEntry[] {
  const stored = loadStoredEntries();
  const live = liveSessionSync.getEntries();
  const unified = mergeAllEntries(stored, live, additionalEntries);

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FALLBACK_PLAYERS_STORAGE_KEY, JSON.stringify(unified));
    }
  } catch {
    // Ignore storage quota error
  }

  liveSessionSync.mergeExternalEntries(unified);
  return unified;
}

function getUnifiedLeaderboardState(
  profile: PlayerProfile,
  additionalEntries?: unknown[]
): LeaderboardState {
  const unified = getAndPersistMergedEntries(additionalEntries);
  return computeRankedLeaderboard(unified, profile.playerId, profile.name, profile.region);
}

async function syncEntriesWithLocalServer(entries: RawLeaderboardEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await fetch('/api/leaderboard/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch {
    // Ignore when running on static hosting without local server
  }
}

export async function registerPlayerProfile(
  profile: PlayerProfile
): Promise<LeaderboardState> {
  liveSessionSync.init(loadStoredEntries());

  const cleanName = profile.name.trim();
  const cleanRegion = profile.region.trim() || 'Greater Accra';
  const canonicalId = createPlayerIdFromProfile(cleanName, cleanRegion);

  // Immediately merge & publish this participant to the live cross-device session
  const currentState = getUnifiedLeaderboardState({
    playerId: canonicalId,
    name: cleanName,
    region: cleanRegion,
  });

  liveSessionSync.publishPlayerEntry({
    ...currentState.playerEntry,
    playerId: canonicalId,
    playerName: cleanName,
    region: cleanRegion,
    lastSeenAt: Date.now(),
  });
  notifyCrossTabLeaderboardChange();

  try {
    const res = await fetch('/api/player/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: canonicalId,
        playerName: cleanName,
        region: cleanRegion,
      }),
    });
    if (isJsonResponse(res)) {
      const serverData = (await res.json()) as LeaderboardState;
      const mergedState = getUnifiedLeaderboardState(
        {
          playerId: canonicalId,
          name: cleanName,
          region: cleanRegion,
        },
        serverData.entries
      );
      liveSessionSync.publishPlayerEntry({
        ...mergedState.playerEntry,
        lastSeenAt: Date.now(),
      });
      void syncEntriesWithLocalServer(mergedState.entries);
      notifyCrossTabLeaderboardChange();
      return mergedState;
    }
  } catch {
    // Running on static host or offline; live WebSocket/MQTT + local state already updated
  }

  return getUnifiedLeaderboardState({
    playerId: canonicalId,
    name: cleanName,
    region: cleanRegion,
  });
}

export async function fetchGlobalLeaderboard(
  profile: PlayerProfile
): Promise<LeaderboardState> {
  liveSessionSync.init(loadStoredEntries());

  try {
    const query = new URLSearchParams({
      playerId: profile.playerId,
      playerName: profile.name,
      region: profile.region,
    });
    const res = await fetch(`/api/leaderboard?${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (isJsonResponse(res)) {
      const serverData = (await res.json()) as LeaderboardState;
      const mergedState = getUnifiedLeaderboardState(profile, serverData.entries);
      if (mergedState.entries.length > serverData.entries.length) {
        void syncEntriesWithLocalServer(mergedState.entries);
      }
      return mergedState;
    }
  } catch {
    // Fallback to unified live WebSocket/MQTT + local state
  }
  return getUnifiedLeaderboardState(profile);
}

/**
 * Subscribes to live session leaderboard updates via:
 * 1. Global WebSocket/MQTT live session sync (works across all phones/browsers on any host)
 * 2. Server-Sent Events (/api/leaderboard/stream when local backend is running)
 * 3. Cross-tab BroadcastChannel & localStorage events
 * 4. Periodic refresh
 */
export function subscribeToLiveLeaderboard(onShouldRefresh: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  liveSessionSync.init(loadStoredEntries());

  const unsubscribeLiveSync = liveSessionSync.subscribe(() => {
    getAndPersistMergedEntries();
    onShouldRefresh();
  });

  let eventSource: EventSource | null = null;
  let broadcastChannel: BroadcastChannel | null = null;

  try {
    if (typeof EventSource !== 'undefined') {
      eventSource = new EventSource('/api/leaderboard/stream');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as { type?: string };
          if (parsed.type === 'leaderboard_update') {
            onShouldRefresh();
          }
        } catch {
          onShouldRefresh();
        }
      };
      eventSource.onerror = () => {
        // Close SSE quietly if deployed on a static host without /api/leaderboard/stream
        if (eventSource && eventSource.readyState === EventSource.CLOSED) {
          eventSource.close();
        }
      };
    }
  } catch {
    // Ignore EventSource error
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel(LEADERBOARD_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = () => {
        onShouldRefresh();
      };
    }
  } catch {
    // Ignore BroadcastChannel error
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === FALLBACK_PLAYERS_STORAGE_KEY) {
      onShouldRefresh();
    }
  };
  window.addEventListener('storage', handleStorage);

  const pollInterval = window.setInterval(() => {
    onShouldRefresh();
  }, 4000);

  return () => {
    unsubscribeLiveSync();
    window.clearInterval(pollInterval);
    window.removeEventListener('storage', handleStorage);
    if (eventSource) {
      eventSource.close();
    }
    if (broadcastChannel) {
      broadcastChannel.close();
    }
  };
}

export function broadcastPlayerPlayingState(
  profile: PlayerProfile,
  isPlaying: boolean
): void {
  if (!profile.name || profile.name.trim().toLowerCase() === 'player') return;
  const state = getUnifiedLeaderboardState(profile);
  const updatedEntry: RawLeaderboardEntry = {
    ...state.playerEntry,
    isPlaying,
    lastSeenAt: Date.now(),
  };
  getAndPersistMergedEntries([updatedEntry]);
  liveSessionSync.publishPlayerEntry(updatedEntry);
  notifyCrossTabLeaderboardChange();
}

export async function startServerPuzzleSession(params: {
  profile: PlayerProfile;
  imageId: string;
  gridSize: number;
  initialTiles?: PuzzleTileData[];
}): Promise<{ sessionId: string; leaderboard: LeaderboardState }> {
  broadcastPlayerPlayingState(params.profile, true);

  try {
    const res = await fetch('/api/puzzle/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: params.profile.playerId,
        playerName: params.profile.name,
        region: params.profile.region,
        imageId: params.imageId,
        gridSize: params.gridSize,
        initialTiles: params.initialTiles,
      }),
    });
    if (isJsonResponse(res)) {
      const data = (await res.json()) as {
        sessionId: string;
        leaderboard: LeaderboardState;
      };
      const mergedLeaderboard = getUnifiedLeaderboardState(
        params.profile,
        data.leaderboard.entries
      );
      notifyCrossTabLeaderboardChange();
      return {
        sessionId: data.sessionId,
        leaderboard: mergedLeaderboard,
      };
    }
  } catch {
    // Offline / static host fallback
  }

  const fallbackSessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    sessionId: fallbackSessionId,
    leaderboard: getUnifiedLeaderboardState(params.profile),
  };
}

export async function pauseServerPuzzleSession(
  sessionId: string | null,
  profile?: PlayerProfile
): Promise<void> {
  if (profile) {
    broadcastPlayerPlayingState(profile, false);
  }
  if (!sessionId) return;
  try {
    await fetch('/api/puzzle/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Ignore offline error
  }
}

export async function resumeServerPuzzleSession(
  sessionId: string | null,
  profile?: PlayerProfile
): Promise<void> {
  if (profile) {
    broadcastPlayerPlayingState(profile, true);
  }
  if (!sessionId) return;
  try {
    await fetch('/api/puzzle/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Ignore offline error
  }
}

export async function abandonServerPuzzleSession(
  sessionId: string | null,
  profile?: PlayerProfile
): Promise<void> {
  if (profile) {
    broadcastPlayerPlayingState(profile, false);
  }
  if (!sessionId) return;
  try {
    await fetch('/api/puzzle/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Ignore offline error
  }
}

export async function completeServerPuzzleSession(params: {
  sessionId: string;
  profile: PlayerProfile;
  imageId: string;
  gridSize: number;
  finalTiles: PuzzleTileData[];
  moves: number;
  monotonicElapsedSeconds: number;
}): Promise<ScoreSubmissionResult> {
  const existingCompleted = getLocalCompletedSessions()[params.sessionId];
  if (existingCompleted) {
    return { ...existingCompleted, alreadyAwarded: true };
  }

  if (params.moves <= 0 || !validateSolvedBoard(params.finalTiles, params.gridSize)) {
    throw new Error('Puzzle is incomplete or incorrectly solved.');
  }

  const beforeState = getUnifiedLeaderboardState(params.profile);
  const previousRank =
    beforeState.playerEntry.puzzlesSolved > 0 ? beforeState.playerEntry.rank : null;

  try {
    const res = await fetch('/api/puzzle/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: params.sessionId,
        playerId: params.profile.playerId,
        playerName: params.profile.name,
        region: params.profile.region,
        imageId: params.imageId,
        finalTiles: params.finalTiles,
        moves: params.moves,
      }),
    });

    if (isJsonResponse(res)) {
      const serverResult = (await res.json()) as ScoreSubmissionResult;
      const mergedLeaderboard = getUnifiedLeaderboardState(
        params.profile,
        serverResult.leaderboard.entries
      );
      const publishedPlayer: RawLeaderboardEntry = {
        ...mergedLeaderboard.playerEntry,
        isPlaying: false,
        lastSeenAt: Date.now(),
      };
      liveSessionSync.publishPlayerEntry(publishedPlayer);
      void syncEntriesWithLocalServer(mergedLeaderboard.entries);

      const finalResult: ScoreSubmissionResult = {
        ...serverResult,
        cumulativeScore: mergedLeaderboard.playerEntry.cumulativeScore,
        globalRank: mergedLeaderboard.playerEntry.rank,
        previousRank,
        totalPlayers: mergedLeaderboard.totalPlayers,
        leaderboard: mergedLeaderboard,
      };
      saveLocalCompletedSession(params.sessionId, finalResult);
      notifyCrossTabLeaderboardChange();
      return finalResult;
    }
  } catch {
    // Fallback to client-side authoritative scoring + live cross-device broadcast
  }

  const elapsedSeconds = Math.max(1, Math.floor(params.monotonicElapsedSeconds));
  const pointsAwarded = calculateTimeScore(elapsedSeconds);
  const tier = getScoringTierForTime(elapsedSeconds);

  const canonicalId = createPlayerIdFromProfile(params.profile.name, params.profile.region);
  const updatedPlayer: RawLeaderboardEntry = {
    playerId: canonicalId,
    playerName: params.profile.name.trim(),
    region: params.profile.region.trim(),
    cumulativeScore: beforeState.playerEntry.cumulativeScore + pointsAwarded,
    puzzlesSolved: beforeState.playerEntry.puzzlesSolved + 1,
    bestTimeSeconds:
      beforeState.playerEntry.bestTimeSeconds === null
        ? elapsedSeconds
        : Math.min(beforeState.playerEntry.bestTimeSeconds, elapsedSeconds),
    updatedAt: new Date().toISOString(),
    isPlaying: false,
    lastSeenAt: Date.now(),
  };

  const updatedLeaderboard = getUnifiedLeaderboardState(params.profile, [updatedPlayer]);
  liveSessionSync.publishPlayerEntry(updatedPlayer);
  void syncEntriesWithLocalServer(updatedLeaderboard.entries);
  notifyCrossTabLeaderboardChange();

  const fallbackResult: ScoreSubmissionResult = {
    sessionId: params.sessionId,
    elapsedSeconds,
    pointsAwarded,
    tierLabel: tier.label,
    cumulativeScore: updatedLeaderboard.playerEntry.cumulativeScore,
    globalRank: updatedLeaderboard.playerEntry.rank,
    previousRank,
    totalPlayers: updatedLeaderboard.totalPlayers,
    alreadyAwarded: false,
    leaderboard: updatedLeaderboard,
  };

  saveLocalCompletedSession(params.sessionId, fallbackResult);
  return fallbackResult;
}
