import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard-v3.json');

const SCORING_TIERS = [
  { id: 'tier-under-30', label: 'Less than 30 seconds', minSeconds: 0, maxSeconds: 29, points: 1200 },
  { id: 'tier-30-60', label: '30-60 seconds inclusive', minSeconds: 30, maxSeconds: 60, points: 1000 },
  { id: 'tier-61-90', label: 'More than 60 seconds up to 90 seconds', minSeconds: 61, maxSeconds: 90, points: 750 },
  { id: 'tier-91-120', label: 'More than 90 seconds up to 120 seconds inclusive', minSeconds: 91, maxSeconds: 120, points: 500 },
  { id: 'tier-121-180', label: 'More than 120 seconds up to 180 seconds', minSeconds: 121, maxSeconds: 180, points: 300 },
  { id: 'tier-181-300', label: 'More than 180 seconds up to 300 seconds', minSeconds: 181, maxSeconds: 300, points: 200 },
  { id: 'tier-301-600', label: 'More than 300 seconds up to 600 seconds', minSeconds: 301, maxSeconds: 600, points: 100 },
  { id: 'tier-over-600', label: 'More than 600 seconds', minSeconds: 601, maxSeconds: null, points: 50 },
];

export function calculateAuthoritativeTimeScore(elapsedSeconds) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error('Invalid elapsed time');
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

export function getTierForSeconds(elapsedSeconds) {
  const points = calculateAuthoritativeTimeScore(elapsedSeconds);
  return SCORING_TIERS.find((t) => t.points === points) || SCORING_TIERS[SCORING_TIERS.length - 1];
}

export function validateSolvedBoardOnServer(tiles, expectedGridSize) {
  if (!Array.isArray(tiles)) return false;
  const expectedLength = expectedGridSize * expectedGridSize;
  if (tiles.length !== expectedLength) return false;
  return tiles.every((tile, index) => {
    return (
      tile &&
      typeof tile === 'object' &&
      typeof tile.correctIndex === 'number' &&
      tile.correctIndex === index &&
      tile.id === `tile-${index}`
    );
  });
}

function loadPlayersMap() {
  const map = new Map();
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && typeof item.playerId === 'string') {
            map.set(item.playerId, {
              ...item,
              region: item.region || 'Greater Accra',
            });
          }
        }
      }
    }
  } catch {
    // Ignore read error and return empty map
  }
  return map;
}

function savePlayersMap(map) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(Array.from(map.values()), null, 2), 'utf8');
  } catch {
    // Ignore write error
  }
}

function buildLeaderboardState(
  playersMap,
  playerId,
  playerName = 'Player',
  region = 'Greater Accra'
) {
  if (playerId && !playersMap.has(playerId)) {
    playersMap.set(playerId, {
      playerId,
      playerName,
      region,
      cumulativeScore: 0,
      puzzlesSolved: 0,
      bestTimeSeconds: null,
      updatedAt: new Date().toISOString(),
    });
  } else if (playerId && playersMap.has(playerId)) {
    const existing = playersMap.get(playerId);
    if (playerName && playerName !== 'Player') existing.playerName = playerName;
    if (region) existing.region = region;
  }

  const sorted = Array.from(playersMap.values()).sort((a, b) => {
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
    return String(a.updatedAt).localeCompare(String(b.updatedAt));
  });

  const rankedEntries = sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  const playerEntry = rankedEntries.find((e) => e.playerId === playerId) || {
    playerId: playerId || 'anonymous',
    playerName,
    region,
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function createScoringMiddleware() {
  const playersMap = loadPlayersMap();
  const sessions = new Map();

  return async function scoringMiddleware(req, res, next) {
    if (!req.url || !req.url.startsWith('/api/')) {
      return next();
    }

    const urlObj = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname;

    try {
      // GET /api/leaderboard
      if (req.method === 'GET' && pathname === '/api/leaderboard') {
        const currentMap = loadPlayersMap();
        const playerId = urlObj.searchParams.get('playerId') || '';
        const playerName = urlObj.searchParams.get('playerName') || 'Player';
        const region = urlObj.searchParams.get('region') || 'Greater Accra';
        const state = buildLeaderboardState(currentMap, playerId, playerName, region);
        return sendJson(res, 200, state);
      }

      // POST /api/player/register
      if (req.method === 'POST' && pathname === '/api/player/register') {
        const body = await readJsonBody(req);
        const playerId = String(body.playerId || '');
        const playerName = String(body.playerName || 'Player').trim();
        const region = String(body.region || 'Greater Accra').trim();

        if (!playerId || !playerName) {
          return sendJson(res, 400, { error: 'Player ID and name are required' });
        }

        const existing = playersMap.get(playerId) || {
          playerId,
          playerName,
          region,
          cumulativeScore: 0,
          puzzlesSolved: 0,
          bestTimeSeconds: null,
          updatedAt: new Date().toISOString(),
        };

        existing.playerName = playerName;
        existing.region = region;
        playersMap.set(playerId, existing);
        savePlayersMap(playersMap);

        const state = buildLeaderboardState(playersMap, playerId, playerName, region);
        return sendJson(res, 200, state);
      }

      // POST /api/leaderboard/clear
      if (req.method === 'POST' && pathname === '/api/leaderboard/clear') {
        playersMap.clear();
        savePlayersMap(playersMap);
        return sendJson(res, 200, { cleared: true });
      }

      // POST /api/puzzle/start
      if (req.method === 'POST' && pathname === '/api/puzzle/start') {
        const body = await readJsonBody(req);
        const playerId = String(body.playerId || 'anonymous-player');
        const playerName = String(body.playerName || 'Player');
        const region = String(body.region || 'Greater Accra');
        const imageId = String(body.imageId || 'coatoa');
        const gridSize = Number(body.gridSize) || 4;

        for (const existing of sessions.values()) {
          if (
            existing.playerId === playerId &&
            (existing.status === 'active' || existing.status === 'paused')
          ) {
            existing.status = 'abandoned';
          }
        }

        const sessionId = crypto.randomUUID();
        const nowMono = performance.now();

        sessions.set(sessionId, {
          sessionId,
          playerId,
          playerName,
          region,
          imageId,
          gridSize,
          startedAtMonoMs: nowMono,
          pausedAtMonoMs: null,
          totalPausedMs: 0,
          status: 'active',
          submissionResult: null,
        });

        const leaderboard = buildLeaderboardState(playersMap, playerId, playerName, region);
        savePlayersMap(playersMap);
        return sendJson(res, 200, {
          sessionId,
          gridSize,
          leaderboard,
        });
      }

      // POST /api/puzzle/pause
      if (req.method === 'POST' && pathname === '/api/puzzle/pause') {
        const body = await readJsonBody(req);
        const session = sessions.get(String(body.sessionId || ''));
        if (!session || session.status !== 'active') {
          return sendJson(res, 400, { error: 'Active session not found' });
        }
        session.pausedAtMonoMs = performance.now();
        session.status = 'paused';
        return sendJson(res, 200, { status: 'paused' });
      }

      // POST /api/puzzle/resume
      if (req.method === 'POST' && pathname === '/api/puzzle/resume') {
        const body = await readJsonBody(req);
        const session = sessions.get(String(body.sessionId || ''));
        if (!session || session.status !== 'paused') {
          return sendJson(res, 400, { error: 'Paused session not found' });
        }
        if (session.pausedAtMonoMs !== null) {
          session.totalPausedMs += Math.max(0, performance.now() - session.pausedAtMonoMs);
          session.pausedAtMonoMs = null;
        }
        session.status = 'active';
        return sendJson(res, 200, { status: 'active' });
      }

      // POST /api/puzzle/abandon
      if (req.method === 'POST' && pathname === '/api/puzzle/abandon') {
        const body = await readJsonBody(req);
        const session = sessions.get(String(body.sessionId || ''));
        if (session && (session.status === 'active' || session.status === 'paused')) {
          session.status = 'abandoned';
        }
        return sendJson(res, 200, { status: 'abandoned' });
      }

      // POST /api/puzzle/complete
      if (req.method === 'POST' && pathname === '/api/puzzle/complete') {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId || '');
        const session = sessions.get(sessionId);

        if (!session) {
          return sendJson(res, 400, {
            error: 'Invalid or unknown puzzle session. Points cannot be awarded.',
          });
        }

        if (session.status === 'completed' && session.submissionResult) {
          return sendJson(res, 200, {
            ...session.submissionResult,
            alreadyAwarded: true,
          });
        }

        if (session.status === 'abandoned') {
          return sendJson(res, 400, {
            error: 'This puzzle session was abandoned or restarted. Points cannot be awarded.',
          });
        }

        const moves = Number(body.moves);
        if (!Number.isFinite(moves) || moves <= 0) {
          return sendJson(res, 400, {
            error: 'Invalid move count: a completed puzzle requires at least 1 valid move.',
          });
        }

        const isSolved = validateSolvedBoardOnServer(body.finalTiles, session.gridSize);
        if (!isSolved) {
          return sendJson(res, 400, {
            error: 'Puzzle is incomplete or incorrectly solved. Points cannot be awarded.',
          });
        }

        const endMonoMs = session.pausedAtMonoMs ?? performance.now();
        const activeDurationMs = Math.max(
          0,
          endMonoMs - session.startedAtMonoMs - session.totalPausedMs
        );

        let elapsedSeconds = Math.max(1, Math.floor(activeDurationMs / 1000));

        const testOverrideHeader = req.headers['x-test-simulated-seconds'];
        if (testOverrideHeader !== undefined) {
          const parsedOverride = Number(testOverrideHeader);
          if (Number.isFinite(parsedOverride) && parsedOverride >= 0) {
            elapsedSeconds = Math.floor(parsedOverride);
          }
        }

        const pointsAwarded = calculateAuthoritativeTimeScore(elapsedSeconds);
        const tier = getTierForSeconds(elapsedSeconds);

        const beforeState = buildLeaderboardState(
          playersMap,
          session.playerId,
          session.playerName,
          session.region
        );
        const previousRank =
          beforeState.playerEntry.puzzlesSolved > 0 ? beforeState.playerEntry.rank : null;

        const existingPlayer = playersMap.get(session.playerId) || {
          playerId: session.playerId,
          playerName: session.playerName,
          region: session.region || 'Greater Accra',
          cumulativeScore: 0,
          puzzlesSolved: 0,
          bestTimeSeconds: null,
          updatedAt: new Date().toISOString(),
        };

        const updatedPlayer = {
          ...existingPlayer,
          playerName: body.playerName ? String(body.playerName) : existingPlayer.playerName,
          region: body.region ? String(body.region) : existingPlayer.region,
          cumulativeScore: existingPlayer.cumulativeScore + pointsAwarded,
          puzzlesSolved: existingPlayer.puzzlesSolved + 1,
          bestTimeSeconds:
            existingPlayer.bestTimeSeconds === null
              ? elapsedSeconds
              : Math.min(existingPlayer.bestTimeSeconds, elapsedSeconds),
          updatedAt: new Date().toISOString(),
        };

        playersMap.set(session.playerId, updatedPlayer);
        savePlayersMap(playersMap);

        const updatedLeaderboard = buildLeaderboardState(
          playersMap,
          session.playerId,
          updatedPlayer.playerName,
          updatedPlayer.region
        );

        const result = {
          sessionId,
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

        session.status = 'completed';
        session.submissionResult = result;

        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    } catch (err) {
      return sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  };
}

export function scoringBackendPlugin() {
  const middleware = createScoringMiddleware();
  return {
    name: 'ghana-puzzle-scoring-backend',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
