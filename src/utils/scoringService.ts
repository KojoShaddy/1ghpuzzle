import {
  LeaderboardEntry,
  LeaderboardState,
  PlayerProfile,
  PuzzleTileData,
  ScoreSubmissionResult,
} from '../types/puzzle';
import {
  calculateTimeScore,
  computeRankedLeaderboard,
  getScoringTierForTime,
  validateSolvedBoard,
} from '../shared/scoring';

const PLAYER_ID_STORAGE_KEY = 'ghana-puzzle-player-id-v3';
const FALLBACK_PLAYERS_STORAGE_KEY = 'ghana-puzzle-leaderboard-entries-v3';
const COMPLETED_SESSIONS_STORAGE_KEY = 'ghana-puzzle-completed-sessions-v3';

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

function getFallbackLeaderboardState(profile: PlayerProfile): LeaderboardState {
  try {
    const raw = window.localStorage.getItem(FALLBACK_PLAYERS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Omit<LeaderboardEntry, 'rank'>>) : [];
    return computeRankedLeaderboard(parsed, profile.playerId, profile.name, profile.region);
  } catch {
    return computeRankedLeaderboard([], profile.playerId, profile.name, profile.region);
  }
}

function saveFallbackPlayerEntry(entry: Omit<LeaderboardEntry, 'rank'>): void {
  try {
    const raw = window.localStorage.getItem(FALLBACK_PLAYERS_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as Array<Omit<LeaderboardEntry, 'rank'>>) : [];
    const filtered = list.filter((e) => e.playerId !== entry.playerId);
    filtered.push(entry);
    window.localStorage.setItem(FALLBACK_PLAYERS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage error
  }
}

export async function registerPlayerProfile(
  profile: PlayerProfile
): Promise<LeaderboardState> {
  try {
    const res = await fetch('/api/player/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: profile.playerId,
        playerName: profile.name,
        region: profile.region,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as LeaderboardState;
      saveFallbackPlayerEntry(data.playerEntry);
      return data;
    }
  } catch {
    // Fallback if offline
  }
  const fallback = getFallbackLeaderboardState(profile);
  saveFallbackPlayerEntry(fallback.playerEntry);
  return fallback;
}

export async function fetchGlobalLeaderboard(
  profile: PlayerProfile
): Promise<LeaderboardState> {
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
    if (res.ok) {
      const data = (await res.json()) as LeaderboardState;
      saveFallbackPlayerEntry(data.playerEntry);
      return data;
    }
  } catch {
    // Fallback if offline
  }
  return getFallbackLeaderboardState(profile);
}

export async function startServerPuzzleSession(params: {
  profile: PlayerProfile;
  imageId: string;
  gridSize: number;
}): Promise<{ sessionId: string; leaderboard: LeaderboardState }> {
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
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        sessionId: string;
        leaderboard: LeaderboardState;
      };
      return data;
    }
  } catch {
    // Offline fallback
  }

  const fallbackSessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    sessionId: fallbackSessionId,
    leaderboard: getFallbackLeaderboardState(params.profile),
  };
}

export async function pauseServerPuzzleSession(sessionId: string | null): Promise<void> {
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

export async function resumeServerPuzzleSession(sessionId: string | null): Promise<void> {
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

export async function abandonServerPuzzleSession(sessionId: string | null): Promise<void> {
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

    if (res.ok) {
      const result = (await res.json()) as ScoreSubmissionResult;
      saveLocalCompletedSession(params.sessionId, result);
      saveFallbackPlayerEntry(result.leaderboard.playerEntry);
      return result;
    }
  } catch {
    // Offline fallback using the single authoritative scoring module
  }

  const elapsedSeconds = Math.max(1, Math.floor(params.monotonicElapsedSeconds));
  const pointsAwarded = calculateTimeScore(elapsedSeconds);
  const tier = getScoringTierForTime(elapsedSeconds);

  const beforeState = getFallbackLeaderboardState(params.profile);
  const previousRank =
    beforeState.playerEntry.puzzlesSolved > 0 ? beforeState.playerEntry.rank : null;

  const updatedPlayer: Omit<LeaderboardEntry, 'rank'> = {
    playerId: params.profile.playerId,
    playerName: params.profile.name,
    region: params.profile.region,
    cumulativeScore: beforeState.playerEntry.cumulativeScore + pointsAwarded,
    puzzlesSolved: beforeState.playerEntry.puzzlesSolved + 1,
    bestTimeSeconds:
      beforeState.playerEntry.bestTimeSeconds === null
        ? elapsedSeconds
        : Math.min(beforeState.playerEntry.bestTimeSeconds, elapsedSeconds),
    updatedAt: new Date().toISOString(),
  };

  saveFallbackPlayerEntry(updatedPlayer);
  const updatedLeaderboard = getFallbackLeaderboardState(params.profile);

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
