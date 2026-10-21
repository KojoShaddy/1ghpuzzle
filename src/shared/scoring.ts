import {
  LeaderboardEntry,
  LeaderboardState,
  PuzzleTileData,
  ScoreSubmissionResult,
} from '../types/puzzle';

export interface ScoringTier {
  id: string;
  label: string;
  minSeconds: number;
  maxSeconds: number | null;
  points: number;
  badgeColor: string;
}

/**
 * Single authoritative scoring table for every completed puzzle.
 */
export const SCORING_TIERS: readonly ScoringTier[] = [
  {
    id: 'tier-under-30',
    label: 'Less than 30 seconds',
    minSeconds: 0,
    maxSeconds: 29,
    points: 1200,
    badgeColor: 'emerald',
  },
  {
    id: 'tier-30-60',
    label: '30-60 seconds inclusive',
    minSeconds: 30,
    maxSeconds: 60,
    points: 1000,
    badgeColor: 'teal',
  },
  {
    id: 'tier-61-90',
    label: 'More than 60 seconds up to 90 seconds',
    minSeconds: 61,
    maxSeconds: 90,
    points: 750,
    badgeColor: 'cyan',
  },
  {
    id: 'tier-91-120',
    label: 'More than 90 seconds up to 120 seconds inclusive',
    minSeconds: 91,
    maxSeconds: 120,
    points: 500,
    badgeColor: 'amber',
  },
  {
    id: 'tier-121-180',
    label: 'More than 120 seconds up to 180 seconds',
    minSeconds: 121,
    maxSeconds: 180,
    points: 300,
    badgeColor: 'orange',
  },
  {
    id: 'tier-181-300',
    label: 'More than 180 seconds up to 300 seconds',
    minSeconds: 181,
    maxSeconds: 300,
    points: 200,
    badgeColor: 'rose',
  },
  {
    id: 'tier-301-600',
    label: 'More than 300 seconds up to 600 seconds',
    minSeconds: 301,
    maxSeconds: 600,
    points: 100,
    badgeColor: 'indigo',
  },
  {
    id: 'tier-over-600',
    label: 'More than 600 seconds',
    minSeconds: 601,
    maxSeconds: null,
    points: 50,
    badgeColor: 'slate',
  },
] as const;

/**
 * Authoritative time-based score calculation.
 */
export function calculateTimeScore(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('Invalid elapsed time: must be a non-negative finite number');
  }

  const seconds = Math.floor(elapsedSeconds);

  if (seconds < 30) return 1200;
  if (seconds <= 60) return 1000;
  if (seconds <= 90) return 750;
  if (seconds <= 120) return 500;
  if (seconds <= 180) return 300;
  if (seconds <= 300) return 200;
  if (seconds <= 600) return 100;
  return 50;
}

/**
 * Returns the matching ScoringTier metadata for a given completion time in seconds.
 */
export function getScoringTierForTime(elapsedSeconds: number): ScoringTier {
  const points = calculateTimeScore(elapsedSeconds);
  return (
    SCORING_TIERS.find((tier) => tier.points === points) ??
    SCORING_TIERS[SCORING_TIERS.length - 1]
  );
}

/**
 * Validates that a tile arrangement represents a complete, genuinely solved grid.
 */
export function validateSolvedBoard(tiles: unknown, expectedGridSize: number): boolean {
  if (!Array.isArray(tiles)) return false;
  const expectedLength = expectedGridSize * expectedGridSize;
  if (tiles.length !== expectedLength) return false;

  return tiles.every((item, index) => {
    if (!item || typeof item !== 'object') return false;
    const tile = item as Partial<PuzzleTileData>;
    return (
      typeof tile.correctIndex === 'number' &&
      tile.correctIndex === index &&
      tile.id === `tile-${index}`
    );
  });
}

export function createPlayerIdFromProfile(name: string, region: string): string {
  const slug = `${name.trim().toLowerCase()}-${region.trim().toLowerCase()}`
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `player-${slug || 'guest'}`;
}

/**
 * Sorts leaderboard entries by cumulativeScore DESC, then bestTimeSeconds ASC, then updatedAt ASC,
 * and assigns 1-based global ranks. Starts completely clean with no fake seeded entries.
 */
export function computeRankedLeaderboard(
  rawEntries: Array<Omit<LeaderboardEntry, 'rank'>>,
  currentPlayerId: string,
  currentPlayerName = 'Player',
  currentPlayerRegion = 'Greater Accra'
): LeaderboardState {
  const map = new Map<string, Omit<LeaderboardEntry, 'rank'>>();

  for (const entry of rawEntries) {
    map.set(entry.playerId, {
      ...entry,
      region: entry.region || 'Ghana',
    });
  }

  let resolvedPlayerId = currentPlayerId;
  const cleanName = currentPlayerName.trim() || 'Player';
  const cleanRegion = currentPlayerRegion.trim() || 'Greater Accra';

  if (cleanName && cleanName !== 'Player') {
    let matchedId: string | null = null;
    for (const existing of map.values()) {
      if (
        existing.playerName.trim().toLowerCase() === cleanName.toLowerCase() &&
        existing.region.trim().toLowerCase() === cleanRegion.toLowerCase()
      ) {
        matchedId = existing.playerId;
        break;
      }
    }

    if (matchedId) {
      resolvedPlayerId = matchedId;
      const existing = map.get(matchedId)!;
      map.set(matchedId, {
        ...existing,
        playerName: cleanName,
        region: cleanRegion,
      });
    } else if (
      resolvedPlayerId &&
      map.has(resolvedPlayerId) &&
      map.get(resolvedPlayerId)!.playerName.trim().toLowerCase() === cleanName.toLowerCase()
    ) {
      const existing = map.get(resolvedPlayerId)!;
      map.set(resolvedPlayerId, {
        ...existing,
        playerName: cleanName,
        region: cleanRegion,
      });
    } else {
      resolvedPlayerId = createPlayerIdFromProfile(cleanName, cleanRegion);
      if (!map.has(resolvedPlayerId)) {
        map.set(resolvedPlayerId, {
          playerId: resolvedPlayerId,
          playerName: cleanName,
          region: cleanRegion,
          cumulativeScore: 0,
          puzzlesSolved: 0,
          bestTimeSeconds: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } else if (resolvedPlayerId && !map.has(resolvedPlayerId)) {
    map.set(resolvedPlayerId, {
      playerId: resolvedPlayerId,
      playerName: cleanName,
      region: cleanRegion,
      cumulativeScore: 0,
      puzzlesSolved: 0,
      bestTimeSeconds: null,
      updatedAt: new Date().toISOString(),
    });
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.cumulativeScore !== a.cumulativeScore) {
      return b.cumulativeScore - a.cumulativeScore;
    }
    if (a.bestTimeSeconds !== null && b.bestTimeSeconds !== null) {
      if (a.bestTimeSeconds !== b.bestTimeSeconds) {
        return a.bestTimeSeconds - b.bestTimeSeconds;
      }
    } else if (a.bestTimeSeconds !== null) {
      return -1;
    } else if (b.bestTimeSeconds !== null) {
      return 1;
    }
    return a.updatedAt.localeCompare(b.updatedAt);
  });

  const rankedEntries: LeaderboardEntry[] = sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  const playerEntry =
    rankedEntries.find((e) => e.playerId === resolvedPlayerId) ?? {
      playerId: resolvedPlayerId,
      playerName: cleanName,
      region: cleanRegion,
      cumulativeScore: 0,
      puzzlesSolved: 0,
      bestTimeSeconds: null,
      rank: rankedEntries.length + 1,
      updatedAt: new Date().toISOString(),
    };

  return {
    playerEntry,
    totalPlayers: rankedEntries.length,
    entries: rankedEntries,
  };
}

export interface ServerPuzzleSession {
  sessionId: string;
  playerId: string;
  imageId: string;
  gridSize: number;
  startedAtMonoMs: number;
  pausedAtMonoMs: number | null;
  totalPausedMs: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  submissionResult: ScoreSubmissionResult | null;
}
