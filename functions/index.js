import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

const ALLOWED_GRID_SIZE = 4;

const ALLOWED_GHANA_REGIONS = new Set([
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
]);

const SCORING_TIERS = [
  { id: 'tier-under-30', label: 'Less than 30 seconds', points: 1200 },
  { id: 'tier-30-60', label: '30-60 seconds inclusive', points: 1000 },
  { id: 'tier-61-90', label: 'More than 60 seconds up to 90 seconds', points: 750 },
  { id: 'tier-91-120', label: 'More than 90 seconds up to 120 seconds inclusive', points: 500 },
  { id: 'tier-121-180', label: 'More than 120 seconds up to 180 seconds', points: 300 },
  { id: 'tier-181-300', label: 'More than 180 seconds up to 300 seconds', points: 200 },
  { id: 'tier-301-600', label: 'More than 300 seconds up to 600 seconds', points: 100 },
  { id: 'tier-over-600', label: 'More than 600 seconds', points: 50 },
];

function sanitizePlayerName(rawName) {
  return String(rawName || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

function sanitizeRegion(rawRegion) {
  const cleaned = String(rawRegion || '').trim();
  return ALLOWED_GHANA_REGIONS.has(cleaned) ? cleaned : 'Greater Accra';
}

function sanitizeImageId(rawImageId) {
  const cleaned = String(rawImageId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 64);
  return cleaned || 'coatoa';
}

function createDeterministicPlayerId(playerName, region) {
  const slug = `${String(playerName || 'player').trim().toLowerCase()}-${String(
    region || 'ghana'
  )
    .trim()
    .toLowerCase()}`
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `player-${slug || 'guest'}`;
}

function calculateAuthoritativeTimeScore(elapsedSeconds) {
  const seconds = Math.max(1, Math.floor(Number(elapsedSeconds) || 1));
  if (seconds < 30) return 1200;
  if (seconds <= 60) return 1000;
  if (seconds <= 90) return 750;
  if (seconds <= 120) return 500;
  if (seconds <= 180) return 300;
  if (seconds <= 300) return 200;
  if (seconds <= 600) return 100;
  return 50;
}

function getTierForSeconds(elapsedSeconds) {
  const points = calculateAuthoritativeTimeScore(elapsedSeconds);
  return SCORING_TIERS.find((t) => t.points === points) || SCORING_TIERS[SCORING_TIERS.length - 1];
}

function validateSolvedBoardOnServer(tiles, expectedGridSize = ALLOWED_GRID_SIZE) {
  if (!Array.isArray(tiles)) return false;
  const expectedLength = expectedGridSize * expectedGridSize;
  if (tiles.length !== expectedLength) return false;
  return tiles.every((tile, index) => {
    return (
      tile &&
      typeof tile === 'object' &&
      typeof tile.correctIndex === 'number' &&
      tile.correctIndex === index &&
      (tile.currentIndex === undefined || tile.currentIndex === index) &&
      tile.id === `tile-${index}`
    );
  });
}

function computeMinimumSwapsForBoard(initialTiles, expectedGridSize = ALLOWED_GRID_SIZE) {
  const n = expectedGridSize * expectedGridSize;
  if (!Array.isArray(initialTiles) || initialTiles.length !== n) {
    return 1;
  }

  const perm = new Array(n);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const t = initialTiles[i];
    if (!t || typeof t.correctIndex !== 'number' || t.correctIndex < 0 || t.correctIndex >= n) {
      return 1;
    }
    if (seen.has(t.correctIndex)) {
      return 1;
    }
    seen.add(t.correctIndex);
    perm[i] = t.correctIndex;
  }

  const visited = new Array(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (!visited[i]) {
      cycles++;
      let curr = i;
      while (!visited[curr]) {
        visited[curr] = true;
        curr = perm[curr];
      }
    }
  }

  return Math.max(1, n - cycles);
}

/**
 * Registers or updates a player's profile in Cloud Firestore (`leaderboard/{playerId}`).
 */
export const registerPlayerProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }

  const data = request.data || {};
  const playerName = sanitizePlayerName(data.playerName);
  if (playerName.length < 2) {
    throw new HttpsError('invalid-argument', 'Player name must be between 2 and 32 characters.');
  }
  const region = sanitizeRegion(data.region);
  const playerId = createDeterministicPlayerId(playerName, region);
  const playerRef = db.collection('leaderboard').doc(playerId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef);
    const nowIso = new Date().toISOString();
    if (!snap.exists) {
      const record = {
        uid: request.auth.uid,
        playerId,
        playerName,
        region,
        cumulativeScore: 0,
        puzzlesSolved: 0,
        bestTimeSeconds: null,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      };
      tx.set(playerRef, record);
      return record;
    }

    const existing = snap.data();
    tx.update(playerRef, {
      playerName,
      region,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });
    return {
      ...existing,
      playerId,
      playerName,
      region,
      updatedAt: nowIso,
    };
  });

  return result;
});

/**
 * Starts a server-tracked puzzle session in Cloud Firestore (`puzzleSessions/{sessionId}`).
 */
export const startPuzzleSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }

  const data = request.data || {};
  const playerName = sanitizePlayerName(data.playerName) || 'Player';
  const region = sanitizeRegion(data.region);
  const playerId = createDeterministicPlayerId(playerName, region);
  const imageId = sanitizeImageId(data.imageId);
  const gridSize = ALLOWED_GRID_SIZE;
  const minRequiredMoves = computeMinimumSwapsForBoard(data.initialTiles, gridSize);

  const sessionId = randomUUID();
  const sessionRef = db.collection('puzzleSessions').doc(sessionId);

  await sessionRef.set({
    sessionId,
    uid: request.auth.uid,
    playerId,
    playerName,
    region,
    imageId,
    gridSize,
    minRequiredMoves,
    startedAtMs: Date.now(),
    pausedAtMs: null,
    totalPausedMs: 0,
    status: 'active',
    createdAtServer: FieldValue.serverTimestamp(),
  });

  return { sessionId, gridSize };
});

/**
 * Pauses an active puzzle session on the server.
 */
export const pausePuzzleSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }
  const sessionId = String(request.data?.sessionId || '');
  if (!sessionId) {
    throw new HttpsError('invalid-argument', 'Missing sessionId');
  }

  const sessionRef = db.collection('puzzleSessions').doc(sessionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) return;
    const session = snap.data();
    if (session.uid !== request.auth.uid || session.status !== 'active') return;
    tx.update(sessionRef, {
      status: 'paused',
      pausedAtMs: Date.now(),
    });
  });

  return { status: 'paused' };
});

/**
 * Resumes a paused puzzle session on the server.
 */
export const resumePuzzleSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }
  const sessionId = String(request.data?.sessionId || '');
  if (!sessionId) {
    throw new HttpsError('invalid-argument', 'Missing sessionId');
  }

  const sessionRef = db.collection('puzzleSessions').doc(sessionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) return;
    const session = snap.data();
    if (session.uid !== request.auth.uid || session.status !== 'paused') return;
    const additionalPaused =
      typeof session.pausedAtMs === 'number' ? Math.max(0, Date.now() - session.pausedAtMs) : 0;
    tx.update(sessionRef, {
      status: 'active',
      pausedAtMs: null,
      totalPausedMs: (Number(session.totalPausedMs) || 0) + additionalPaused,
    });
  });

  return { status: 'active' };
});

/**
 * Marks a puzzle session as abandoned so it cannot be used to claim points.
 */
export const abandonPuzzleSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }
  const sessionId = String(request.data?.sessionId || '');
  if (!sessionId) {
    return { status: 'abandoned' };
  }

  const sessionRef = db.collection('puzzleSessions').doc(sessionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) return;
    const session = snap.data();
    if (
      session.uid === request.auth.uid &&
      (session.status === 'active' || session.status === 'paused')
    ) {
      tx.update(sessionRef, { status: 'abandoned' });
    }
  });

  return { status: 'abandoned' };
});

/**
 * Validates a completed puzzle board, move count, and elapsed time on the server,
 * and atomically updates the player's persistent score in Cloud Firestore (`leaderboard/{playerId}`).
 */
export const completePuzzleSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Anonymous authentication is required.');
  }

  const data = request.data || {};
  const sessionId = String(data.sessionId || '');
  const moves = Math.floor(Number(data.moves) || 0);
  const finalTiles = data.finalTiles;

  if (!sessionId) {
    throw new HttpsError('invalid-argument', 'Missing sessionId.');
  }

  if (!validateSolvedBoardOnServer(finalTiles, ALLOWED_GRID_SIZE)) {
    throw new HttpsError(
      'failed-precondition',
      'Puzzle board is incomplete or incorrectly solved.'
    );
  }

  const sessionRef = db.collection('puzzleSessions').doc(sessionId);

  return await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) {
      throw new HttpsError('not-found', 'Puzzle session not found.');
    }

    const session = sessionSnap.data();
    if (session.uid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Session belongs to a different user.');
    }

    if (session.status === 'completed' && session.submissionResult) {
      return {
        ...session.submissionResult,
        alreadyAwarded: true,
      };
    }

    if (session.status === 'abandoned') {
      throw new HttpsError('failed-precondition', 'This puzzle session was abandoned.');
    }

    const minMoves = Number(session.minRequiredMoves) || 1;
    if (moves < minMoves) {
      throw new HttpsError(
        'failed-precondition',
        `Solving this puzzle requires at least ${minMoves} moves.`
      );
    }

    const endMs = typeof session.pausedAtMs === 'number' ? session.pausedAtMs : Date.now();
    const activeDurationMs = Math.max(
      0,
      endMs - Number(session.startedAtMs || endMs) - Number(session.totalPausedMs || 0)
    );

    if (activeDurationMs < 800) {
      throw new HttpsError(
        'failed-precondition',
        'Completion time is unrealistically fast.'
      );
    }

    const elapsedSeconds = Math.max(1, Math.floor(activeDurationMs / 1000));
    const pointsAwarded = calculateAuthoritativeTimeScore(elapsedSeconds);
    const tier = getTierForSeconds(elapsedSeconds);

    const playerName = sanitizePlayerName(data.playerName || session.playerName) || 'Player';
    const region = sanitizeRegion(data.region || session.region);
    const playerId = createDeterministicPlayerId(playerName, region);
    const playerRef = db.collection('leaderboard').doc(playerId);

    const playerSnap = await tx.get(playerRef);
    const nowIso = new Date().toISOString();

    let cumulativeScore = pointsAwarded;
    let puzzlesSolved = 1;
    let bestTimeSeconds = elapsedSeconds;

    if (playerSnap.exists) {
      const existing = playerSnap.data();
      cumulativeScore = (Number(existing.cumulativeScore) || 0) + pointsAwarded;
      puzzlesSolved = (Number(existing.puzzlesSolved) || 0) + 1;
      bestTimeSeconds =
        typeof existing.bestTimeSeconds === 'number' && existing.bestTimeSeconds > 0
          ? Math.min(existing.bestTimeSeconds, elapsedSeconds)
          : elapsedSeconds;

      tx.update(playerRef, {
        playerName,
        region,
        cumulativeScore,
        puzzlesSolved,
        bestTimeSeconds,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(playerRef, {
        uid: request.auth.uid,
        playerId,
        playerName,
        region,
        cumulativeScore,
        puzzlesSolved,
        bestTimeSeconds,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      });
    }

    const submissionResult = {
      sessionId,
      elapsedSeconds,
      pointsAwarded,
      tierLabel: tier.label,
      cumulativeScore,
      puzzlesSolved,
      bestTimeSeconds,
      alreadyAwarded: false,
    };

    tx.update(sessionRef, {
      status: 'completed',
      completedAtMs: endMs,
      submissionResult,
    });

    return submissionResult;
  });
});
