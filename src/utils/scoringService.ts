import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ensureAnonymousAuth,
  getFirebaseServices,
  isCloudFunctionsEnabled,
} from '../lib/firebase';
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
import { firebasePresence } from './firebasePresence';
import {
  mergeTwoPlayerEntries,
  RawLeaderboardEntry,
  sanitizeEntry,
} from './liveSessionSync';

const PLAYER_ID_STORAGE_KEY = 'ghana-puzzle-player-id-v7';
const LEADERBOARD_BROADCAST_CHANNEL = 'ghana-puzzle-leaderboard-sync-v7';
const FIRESTORE_LEADERBOARD_COLLECTION = 'leaderboard_v7';

export { createPlayerIdFromProfile };

// In-memory cache of remote leaderboard entries from Cloud Firestore & backend API (never stored exclusively in localStorage)
const remoteEntriesMemoryCache = new Map<string, RawLeaderboardEntry>();
const completedSessionIdsMemory = new Map<string, ScoreSubmissionResult>();

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

function upsertRemoteCacheEntries(entries: unknown[]): void {
  for (const raw of entries) {
    const sanitized = sanitizeEntry(raw);
    if (!sanitized) continue;
    const existing = remoteEntriesMemoryCache.get(sanitized.playerId);
    if (!existing) {
      remoteEntriesMemoryCache.set(sanitized.playerId, sanitized);
    } else {
      remoteEntriesMemoryCache.set(
        sanitized.playerId,
        mergeTwoPlayerEntries(existing, sanitized)
      );
    }
  }
}

function replaceRemoteCacheEntries(entries: unknown[]): void {
  remoteEntriesMemoryCache.clear();
  upsertRemoteCacheEntries(entries);
}

/**
 * Builds the leaderboard state strictly from Cloud Firestore entries,
 * enriched with real-time presence (`isPlaying` and `onlineCount`) from Firebase Realtime Database.
 */
function buildUnifiedLeaderboardState(
  profile: PlayerProfile,
  additionalEntries?: unknown[]
): LeaderboardState {
  if (additionalEntries) {
    upsertRemoteCacheEntries(additionalEntries);
  }

  const presenceSnap = firebasePresence.getSnapshot();
  const mergedMap = new Map<string, RawLeaderboardEntry>();

  for (const item of remoteEntriesMemoryCache.values()) {
    const sanitized = sanitizeEntry(item);
    if (!sanitized) continue;
    const existing = mergedMap.get(sanitized.playerId);
    if (!existing) {
      mergedMap.set(sanitized.playerId, sanitized);
    } else {
      mergedMap.set(sanitized.playerId, mergeTwoPlayerEntries(existing, sanitized));
    }
  }

  // Overlay live RTDB playing status onto existing Firestore leaderboard entries
  for (const [playerId, entry] of mergedMap.entries()) {
    if (presenceSnap.playingPlayerIds.has(playerId)) {
      mergedMap.set(playerId, { ...entry, isPlaying: true });
    }
  }

  const ranked = computeRankedLeaderboard(
    Array.from(mergedMap.values()),
    profile.playerId,
    profile.name,
    profile.region
  );

  return {
    ...ranked,
    onlineCount: Math.max(presenceSnap.onlineCount, ranked.entries.length > 0 ? 1 : 0),
  };
}

/**
 * Queries Cloud Firestore `leaderboard` collection sorted by `cumulativeScore` descending.
 */
async function fetchFirestoreLeaderboardEntries(): Promise<RawLeaderboardEntry[]> {
  const services = getFirebaseServices();
  if (!services) return [];

  try {
    await ensureAnonymousAuth();
    const leaderboardQuery = query(
      collection(services.db, FIRESTORE_LEADERBOARD_COLLECTION),
      orderBy('cumulativeScore', 'desc'),
      limit(100)
    );
    const snap = await getDocs(leaderboardQuery);
    const entries: RawLeaderboardEntry[] = [];
    snap.forEach((docSnap) => {
      const sanitized = sanitizeEntry({
        playerId: docSnap.id,
        ...docSnap.data(),
      });
      if (sanitized) {
        entries.push(sanitized);
      }
    });
    replaceRemoteCacheEntries(entries);
    return entries;
  } catch {
    return [];
  }
}

/**
 * Upserts a player profile in Cloud Firestore `leaderboard/{playerId}` using a transaction
 * so an existing player's cumulativeScore is never overwritten.
 */
async function upsertFirestorePlayerProfile(profile: PlayerProfile): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;

  const cleanName = profile.name.trim();
  if (cleanName.length < 2 || cleanName.toLowerCase() === 'player') return;
  const cleanRegion = profile.region.trim() || 'Greater Accra';
  const canonicalId = createPlayerIdFromProfile(cleanName, cleanRegion);

  try {
    const user = await ensureAnonymousAuth();
    if (!user) return;

    // 1. Try Firebase Cloud Function first only if enabled (Blaze plan)
    if (isCloudFunctionsEnabled()) {
      try {
        const registerFn = httpsCallable(services.functions, 'registerPlayerProfile');
        await registerFn({
          playerId: canonicalId,
          playerName: cleanName,
          region: cleanRegion,
        });
        return;
      } catch {
        // Fallback to direct Firestore transaction
      }
    }

    const playerRef = doc(services.db, FIRESTORE_LEADERBOARD_COLLECTION, canonicalId);
    await runTransaction(services.db, async (tx) => {
      const snap = await tx.get(playerRef);
      const nowIso = new Date().toISOString();
      if (!snap.exists()) {
        tx.set(playerRef, {
          uid: user.uid,
          playerId: canonicalId,
          playerName: cleanName,
          region: cleanRegion,
          cumulativeScore: 0,
          puzzlesSolved: 0,
          bestTimeSeconds: null,
          updatedAt: nowIso,
          updatedAtServer: serverTimestamp(),
        });
      } else {
        const data = snap.data();
        if (!data.uid || data.uid === user.uid) {
          tx.update(playerRef, {
            uid: user.uid,
            playerName: cleanName,
            region: cleanRegion,
            updatedAt: nowIso,
            updatedAtServer: serverTimestamp(),
          });
        }
      }
    });
  } catch {
    // Ignore Firestore error when unconfigured
  }
}

export async function registerPlayerProfile(
  profile: PlayerProfile
): Promise<LeaderboardState> {
  const cleanName = profile.name.trim();
  const cleanRegion = profile.region.trim() || 'Greater Accra';
  const canonicalId = createPlayerIdFromProfile(cleanName, cleanRegion);
  const normalizedProfile: PlayerProfile = {
    playerId: canonicalId,
    name: cleanName,
    region: cleanRegion,
  };

  firebasePresence.init(normalizedProfile, false);
  await upsertFirestorePlayerProfile(normalizedProfile);
  await fetchFirestoreLeaderboardEntries();

  const finalState = buildUnifiedLeaderboardState(normalizedProfile);
  notifyCrossTabLeaderboardChange();

  return finalState;
}

export async function fetchGlobalLeaderboard(
  profile: PlayerProfile
): Promise<LeaderboardState> {
  await fetchFirestoreLeaderboardEntries();
  return buildUnifiedLeaderboardState(profile);
}

/**
 * Subscribes to live leaderboard and presence updates from:
 * 1. Cloud Firestore `onSnapshot` (sorted by `cumulativeScore` DESC)
 * 2. Firebase Realtime Database `presence` (`onValue` + `.info/connected` + `onDisconnect`)
 * 3. Live session sync & Server-Sent Events (`/api/leaderboard/stream`)
 */
export function subscribeToLiveLeaderboard(onShouldRefresh: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let firestoreUnsub: Unsubscribe | null = null;
  const services = getFirebaseServices();
  if (services) {
    void ensureAnonymousAuth().then(() => {
      try {
        const leaderboardQuery = query(
          collection(services.db, FIRESTORE_LEADERBOARD_COLLECTION),
          orderBy('cumulativeScore', 'desc'),
          limit(100)
        );
        firestoreUnsub = onSnapshot(
          leaderboardQuery,
          (snapshot) => {
            const entries: RawLeaderboardEntry[] = [];
            snapshot.forEach((docSnap) => {
              const sanitized = sanitizeEntry({
                playerId: docSnap.id,
                ...docSnap.data(),
              });
              if (sanitized) entries.push(sanitized);
            });
            replaceRemoteCacheEntries(entries);
            onShouldRefresh();
          },
          () => {
            // Ignore snapshot permission error before rules deployment
          }
        );
      } catch {
        // Ignore query error
      }
    });
  }

  const unsubscribePresence = firebasePresence.subscribe(() => {
    onShouldRefresh();
  });

  let broadcastChannel: BroadcastChannel | null = null;
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

  return () => {
    if (firestoreUnsub) firestoreUnsub();
    unsubscribePresence();
    if (broadcastChannel) {
      broadcastChannel.close();
    }
  };
}

export function broadcastPlayerPlayingState(
  profile: PlayerProfile,
  isPlaying: boolean
): void {
  firebasePresence.updatePresence(profile, isPlaying);

  if (!profile.name || profile.name.trim().toLowerCase() === 'player') return;
  const canonicalId = createPlayerIdFromProfile(profile.name, profile.region);
  const existing = remoteEntriesMemoryCache.get(canonicalId);
  if (existing) {
    remoteEntriesMemoryCache.set(canonicalId, {
      ...existing,
      isPlaying,
      lastSeenAt: Date.now(),
    });
  }
  notifyCrossTabLeaderboardChange();
}

export async function startServerPuzzleSession(params: {
  profile: PlayerProfile;
  imageId: string;
  gridSize: number;
  initialTiles?: PuzzleTileData[];
}): Promise<{ sessionId: string; leaderboard: LeaderboardState }> {
  broadcastPlayerPlayingState(params.profile, true);

  // 1. Try Firebase Cloud Function (`startPuzzleSession`) if enabled
  const services = getFirebaseServices();
  if (services && isCloudFunctionsEnabled()) {
    try {
      await ensureAnonymousAuth();
      const startFn = httpsCallable<
        {
          playerId: string;
          playerName: string;
          region: string;
          imageId: string;
          gridSize: number;
          initialTiles?: PuzzleTileData[];
        },
        { sessionId: string }
      >(services.functions, 'startPuzzleSession');

      const response = await startFn({
        playerId: params.profile.playerId,
        playerName: params.profile.name,
        region: params.profile.region,
        imageId: params.imageId,
        gridSize: params.gridSize,
        initialTiles: params.initialTiles,
      });

      if (response.data?.sessionId) {
        return {
          sessionId: response.data.sessionId,
          leaderboard: buildUnifiedLeaderboardState(params.profile),
        };
      }
    } catch {
      // Fallback to /api/puzzle/start
    }
  }

  // 2. Try Vercel / Vite backend API (`/api/puzzle/start`)
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
      const mergedLeaderboard = buildUnifiedLeaderboardState(params.profile);
      notifyCrossTabLeaderboardChange();
      return {
        sessionId: data.sessionId,
        leaderboard: mergedLeaderboard,
      };
    }
  } catch {
    // Fallback
  }

  const fallbackSessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    sessionId: fallbackSessionId,
    leaderboard: buildUnifiedLeaderboardState(params.profile),
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

  const services = getFirebaseServices();
  if (services && isCloudFunctionsEnabled()) {
    try {
      const pauseFn = httpsCallable(services.functions, 'pausePuzzleSession');
      void pauseFn({ sessionId }).catch(() => {});
    } catch {
      // Ignore
    }
  }

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

  const services = getFirebaseServices();
  if (services && isCloudFunctionsEnabled()) {
    try {
      const resumeFn = httpsCallable(services.functions, 'resumePuzzleSession');
      void resumeFn({ sessionId }).catch(() => {});
    } catch {
      // Ignore
    }
  }

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

  const services = getFirebaseServices();
  if (services && isCloudFunctionsEnabled()) {
    try {
      const abandonFn = httpsCallable(services.functions, 'abandonPuzzleSession');
      void abandonFn({ sessionId }).catch(() => {});
    } catch {
      // Ignore
    }
  }

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

/**
 * Persists a validated puzzle score atomically into Cloud Firestore `leaderboard/{playerId}`.
 */
async function persistScoreToFirestore(
  profile: PlayerProfile,
  pointsAwarded: number,
  elapsedSeconds: number
): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;

  const cleanName = profile.name.trim();
  const cleanRegion = profile.region.trim() || 'Greater Accra';
  const canonicalId = createPlayerIdFromProfile(cleanName, cleanRegion);

  try {
    const user = await ensureAnonymousAuth();
    if (!user) return;

    const playerRef = doc(services.db, FIRESTORE_LEADERBOARD_COLLECTION, canonicalId);
    await runTransaction(services.db, async (tx) => {
      const snap = await tx.get(playerRef);
      const nowIso = new Date().toISOString();
      if (!snap.exists()) {
        tx.set(playerRef, {
          uid: user.uid,
          playerId: canonicalId,
          playerName: cleanName,
          region: cleanRegion,
          cumulativeScore: pointsAwarded,
          puzzlesSolved: 1,
          bestTimeSeconds: elapsedSeconds,
          updatedAt: nowIso,
          updatedAtServer: serverTimestamp(),
        });
      } else {
        const existing = snap.data();
        const prevScore = Math.max(0, Math.floor(Number(existing.cumulativeScore) || 0));
        const prevSolved = Math.max(0, Math.floor(Number(existing.puzzlesSolved) || 0));
        const prevBest =
          typeof existing.bestTimeSeconds === 'number' && existing.bestTimeSeconds > 0
            ? Math.floor(existing.bestTimeSeconds)
            : null;

        tx.update(playerRef, {
          uid: existing.uid || user.uid,
          playerName: cleanName,
          region: cleanRegion,
          cumulativeScore: prevScore + pointsAwarded,
          puzzlesSolved: prevSolved + 1,
          bestTimeSeconds:
            prevBest === null ? elapsedSeconds : Math.min(prevBest, elapsedSeconds),
          updatedAt: nowIso,
          updatedAtServer: serverTimestamp(),
        });
      }
    });
  } catch {
    // Ignore when Firestore rules or project not yet configured
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
  const existingCompleted = completedSessionIdsMemory.get(params.sessionId);
  if (existingCompleted) {
    return { ...existingCompleted, alreadyAwarded: true };
  }

  if (params.moves <= 0 || !validateSolvedBoard(params.finalTiles, params.gridSize)) {
    throw new Error('Puzzle is incomplete or incorrectly solved.');
  }

  broadcastPlayerPlayingState(params.profile, false);

  const beforeState = buildUnifiedLeaderboardState(params.profile);
  const previousRank =
    beforeState.playerEntry.puzzlesSolved > 0 ? beforeState.playerEntry.rank : null;

  // 1. Try Trusted Firebase Cloud Function (`completePuzzleSession`) if enabled
  const services = getFirebaseServices();
  if (services && isCloudFunctionsEnabled()) {
    try {
      await ensureAnonymousAuth();
      const completeFn = httpsCallable<
        {
          sessionId: string;
          playerId: string;
          playerName: string;
          region: string;
          imageId: string;
          gridSize: number;
          finalTiles: PuzzleTileData[];
          moves: number;
          monotonicElapsedSeconds: number;
        },
        {
          sessionId: string;
          elapsedSeconds: number;
          pointsAwarded: number;
          tierLabel: string;
          cumulativeScore: number;
          puzzlesSolved: number;
          bestTimeSeconds: number;
          alreadyAwarded: boolean;
        }
      >(services.functions, 'completePuzzleSession');

      const fnRes = await completeFn({
        sessionId: params.sessionId,
        playerId: params.profile.playerId,
        playerName: params.profile.name,
        region: params.profile.region,
        imageId: params.imageId,
        gridSize: params.gridSize,
        finalTiles: params.finalTiles,
        moves: params.moves,
        monotonicElapsedSeconds: params.monotonicElapsedSeconds,
      });

      if (fnRes.data) {
        const canonicalId = createPlayerIdFromProfile(
          params.profile.name,
          params.profile.region
        );
        const updatedPlayer: RawLeaderboardEntry = {
          playerId: canonicalId,
          playerName: params.profile.name.trim(),
          region: params.profile.region.trim(),
          cumulativeScore: fnRes.data.cumulativeScore,
          puzzlesSolved: fnRes.data.puzzlesSolved,
          bestTimeSeconds: fnRes.data.bestTimeSeconds,
          updatedAt: new Date().toISOString(),
          isPlaying: false,
          lastSeenAt: Date.now(),
        };

        const mergedLeaderboard = buildUnifiedLeaderboardState(params.profile, [
          updatedPlayer,
        ]);

        const result: ScoreSubmissionResult = {
          sessionId: params.sessionId,
          elapsedSeconds: fnRes.data.elapsedSeconds,
          pointsAwarded: fnRes.data.pointsAwarded,
          tierLabel: fnRes.data.tierLabel,
          cumulativeScore: mergedLeaderboard.playerEntry.cumulativeScore,
          globalRank: mergedLeaderboard.playerEntry.rank,
          previousRank,
          totalPlayers: mergedLeaderboard.totalPlayers,
          alreadyAwarded: fnRes.data.alreadyAwarded,
          leaderboard: mergedLeaderboard,
        };
        completedSessionIdsMemory.set(params.sessionId, result);
        notifyCrossTabLeaderboardChange();
        return result;
      }
    } catch {
      // Fallback to /api/puzzle/complete + Firestore transaction
    }
  }

  // 2. Try Trusted Backend API (`/api/puzzle/complete`) for timer & move verification, then persist to Firestore
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
        monotonicElapsedSeconds: params.monotonicElapsedSeconds,
      }),
    });

    if (isJsonResponse(res)) {
      const serverResult = (await res.json()) as ScoreSubmissionResult;
      await persistScoreToFirestore(
        params.profile,
        serverResult.pointsAwarded,
        serverResult.elapsedSeconds
      );
      await fetchFirestoreLeaderboardEntries();

      const mergedLeaderboard = buildUnifiedLeaderboardState(params.profile);

      const finalResult: ScoreSubmissionResult = {
        ...serverResult,
        cumulativeScore: mergedLeaderboard.playerEntry.cumulativeScore,
        globalRank: mergedLeaderboard.playerEntry.rank,
        previousRank,
        totalPlayers: mergedLeaderboard.totalPlayers,
        leaderboard: mergedLeaderboard,
      };
      completedSessionIdsMemory.set(params.sessionId, finalResult);
      notifyCrossTabLeaderboardChange();
      return finalResult;
    }
  } catch {
    // Fallback to Firestore transaction + authoritative scoring module
  }

  // 3. Direct Firestore transaction + authoritative scoring module
  const elapsedSeconds = Math.max(1, Math.floor(params.monotonicElapsedSeconds));
  const pointsAwarded = calculateTimeScore(elapsedSeconds);
  const tier = getScoringTierForTime(elapsedSeconds);

  await persistScoreToFirestore(params.profile, pointsAwarded, elapsedSeconds);
  await fetchFirestoreLeaderboardEntries();

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

  const updatedLeaderboard = buildUnifiedLeaderboardState(
    params.profile,
    remoteEntriesMemoryCache.has(canonicalId) ? undefined : [updatedPlayer]
  );
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

  completedSessionIdsMemory.set(params.sessionId, fallbackResult);
  return fallbackResult;
}
