import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard-v5.json');

const MAX_BODY_BYTES = 32_768; // 32 KB strict request payload cap
const MAX_SESSIONS_IN_MEMORY = 2_000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
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
  { id: 'tier-under-30', label: 'Less than 30 seconds', minSeconds: 0, maxSeconds: 29, points: 1200 },
  { id: 'tier-30-60', label: '30-60 seconds inclusive', minSeconds: 30, maxSeconds: 60, points: 1000 },
  { id: 'tier-61-90', label: 'More than 60 seconds up to 90 seconds', minSeconds: 61, maxSeconds: 90, points: 750 },
  { id: 'tier-91-120', label: 'More than 90 seconds up to 120 seconds inclusive', minSeconds: 91, maxSeconds: 120, points: 500 },
  { id: 'tier-121-180', label: 'More than 120 seconds up to 180 seconds', minSeconds: 121, maxSeconds: 180, points: 300 },
  { id: 'tier-181-300', label: 'More than 180 seconds up to 300 seconds', minSeconds: 181, maxSeconds: 300, points: 200 },
  { id: 'tier-301-600', label: 'More than 300 seconds up to 600 seconds', minSeconds: 301, maxSeconds: 600, points: 100 },
  { id: 'tier-over-600', label: 'More than 600 seconds', minSeconds: 601, maxSeconds: null, points: 50 },
];

export function sanitizePlayerName(rawName) {
  const cleaned = String(rawName || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 32);
}

export function sanitizeRegion(rawRegion) {
  const cleaned = String(rawRegion || '').trim();
  if (ALLOWED_GHANA_REGIONS.has(cleaned)) {
    return cleaned;
  }
  return 'Greater Accra';
}

export function sanitizeImageId(rawImageId) {
  const cleaned = String(rawImageId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 64);
  return cleaned || 'coatoa';
}

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
      (tile.currentIndex === undefined || tile.currentIndex === index) &&
      tile.id === `tile-${index}`
    );
  });
}

/**
 * Computes the minimum number of 2-tile swaps mathematically required to solve a given initial permutation
 * using cycle decomposition: for N tiles and C disjoint cycles, minSwaps = N - C.
 */
export function computeMinimumSwapsForBoard(initialTiles, expectedGridSize = ALLOWED_GRID_SIZE) {
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

/**
 * Resolves the canonical player record in playersMap without ever overwriting a different player's record.
 */
function resolveOrCreatePlayer(playersMap, requestedPlayerId, rawPlayerName, rawRegion) {
  const cleanName = sanitizePlayerName(rawPlayerName) || 'Player';
  const cleanRegion = sanitizeRegion(rawRegion);
  const nameLower = cleanName.toLowerCase();
  const regionLower = cleanRegion.toLowerCase();

  // 1. Check if a player with the exact same name and region already exists in playersMap
  for (const existing of playersMap.values()) {
    if (
      String(existing.playerName || '').trim().toLowerCase() === nameLower &&
      String(existing.region || '').trim().toLowerCase() === regionLower
    ) {
      existing.playerName = cleanName;
      existing.region = cleanRegion;
      return existing;
    }
  }

  // 2. Check if requestedPlayerId exists and belongs to the SAME player name and region
  if (requestedPlayerId && playersMap.has(requestedPlayerId)) {
    const byId = playersMap.get(requestedPlayerId);
    if (
      String(byId.playerName || '').trim().toLowerCase() === nameLower &&
      String(byId.region || '').trim().toLowerCase() === regionLower
    ) {
      byId.playerName = cleanName;
      byId.region = cleanRegion;
      return byId;
    }
  }

  // 3. Otherwise create a distinct player entry so previous session players remain intact on the leaderboard
  let canonicalId = createDeterministicPlayerId(cleanName, cleanRegion);
  if (playersMap.has(canonicalId)) {
    const existingBySlug = playersMap.get(canonicalId);
    if (
      String(existingBySlug.playerName || '').trim().toLowerCase() !== nameLower ||
      String(existingBySlug.region || '').trim().toLowerCase() !== regionLower
    ) {
      canonicalId = `${canonicalId}-${crypto.randomUUID().slice(0, 6)}`;
    }
  }

  const newPlayer = {
    playerId: canonicalId,
    playerName: cleanName,
    region: cleanRegion,
    cumulativeScore: 0,
    puzzlesSolved: 0,
    bestTimeSeconds: null,
    updatedAt: new Date().toISOString(),
  };
  playersMap.set(canonicalId, newPlayer);
  return newPlayer;
}

function loadPlayersMap() {
  const map = new Map();
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && typeof item.playerId === 'string') {
            const cleanName = sanitizePlayerName(item.playerName);
            if (!cleanName) continue;
            map.set(item.playerId, {
              playerId: item.playerId,
              playerName: cleanName,
              region: sanitizeRegion(item.region),
              cumulativeScore: Math.max(0, Math.floor(Number(item.cumulativeScore) || 0)),
              puzzlesSolved: Math.max(0, Math.floor(Number(item.puzzlesSolved) || 0)),
              bestTimeSeconds:
                typeof item.bestTimeSeconds === 'number' && item.bestTimeSeconds > 0
                  ? Math.floor(item.bestTimeSeconds)
                  : null,
              updatedAt:
                typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
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

/**
 * Atomic file write via temporary file rename to prevent partial writes or corruption.
 */
function savePlayersMap(map) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${LEADERBOARD_FILE}.tmp`;
    const serialized = JSON.stringify(Array.from(map.values()), null, 2);
    fs.writeFileSync(tempFile, serialized, 'utf8');
    fs.renameSync(tempFile, LEADERBOARD_FILE);
  } catch {
    // Ignore write error
  }
}

function pruneStaleSessions(sessions) {
  const nowMono = performance.now();
  for (const [id, session] of sessions.entries()) {
    if (nowMono - session.startedAtMonoMs > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  if (sessions.size > MAX_SESSIONS_IN_MEMORY) {
    const excess = sessions.size - MAX_SESSIONS_IN_MEMORY;
    let removed = 0;
    for (const [id, session] of sessions.entries()) {
      if (session.status !== 'active') {
        sessions.delete(id);
        removed++;
        if (removed >= excess) break;
      }
    }
  }
}

function getActivePlayingPlayerIds(sessions) {
  const playingIds = new Set();
  for (const session of sessions.values()) {
    if (session && session.status === 'active') {
      playingIds.add(session.playerId);
    }
  }
  return playingIds;
}

function findExistingPlayer(playersMap, requestedPlayerId, playerName, region) {
  const cleanName = sanitizePlayerName(playerName).toLowerCase();
  const cleanRegion = sanitizeRegion(region).toLowerCase();

  if (cleanName && cleanName !== 'player') {
    for (const existing of playersMap.values()) {
      if (
        String(existing.playerName || '').trim().toLowerCase() === cleanName &&
        String(existing.region || '').trim().toLowerCase() === cleanRegion
      ) {
        return existing;
      }
    }
  }

  if (requestedPlayerId && playersMap.has(requestedPlayerId)) {
    const byId = playersMap.get(requestedPlayerId);
    if (!cleanName || String(byId.playerName || '').trim().toLowerCase() === cleanName) {
      return byId;
    }
  }

  return null;
}

function buildLeaderboardState(
  playersMap,
  sessions,
  requestedPlayerId,
  playerName = 'Player',
  region = 'Greater Accra'
) {
  const cleanName = sanitizePlayerName(playerName) || 'Player';
  const cleanRegion = sanitizeRegion(region);
  const targetPlayer = findExistingPlayer(playersMap, requestedPlayerId, cleanName, cleanRegion);
  const playingIds = getActivePlayingPlayerIds(sessions);

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
    isPlaying: playingIds.has(entry.playerId),
  }));

  const resolvedId = targetPlayer ? targetPlayer.playerId : requestedPlayerId;
  const playerEntry = rankedEntries.find((e) => e.playerId === resolvedId) || {
    playerId: resolvedId || 'anonymous',
    playerName: cleanName,
    region: cleanRegion,
    cumulativeScore: 0,
    puzzlesSolved: 0,
    bestTimeSeconds: null,
    rank: rankedEntries.length + 1,
    updatedAt: new Date().toISOString(),
    isPlaying: false,
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
    let byteLength = 0;
    req.on('data', (chunk) => {
      byteLength += chunk.length;
      if (byteLength > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload too large'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('Request body must be a JSON object'));
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  setSecurityHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function isLocalLoopbackRequest(req) {
  const remoteAddr = req.socket?.remoteAddress || '';
  return (
    remoteAddr === '127.0.0.1' ||
    remoteAddr === '::1' ||
    remoteAddr === '::ffff:127.0.0.1'
  );
}

export function createScoringMiddleware() {
  const playersMap = loadPlayersMap();
  const sessions = new Map();
  const sseClients = new Set();
  const presenceMap = new Map(); // connectionId -> { uid, playerId, playerName, region, isPlaying, state, lastChanged }

  function prunePresenceMap() {
    const now = Date.now();
    let changed = false;
    for (const [connId, item] of presenceMap.entries()) {
      if (now - item.lastChanged > 18_000) {
        presenceMap.delete(connId);
        changed = true;
      }
    }
    return changed;
  }

  function getActivePresenceList() {
    prunePresenceMap();
    return Array.from(presenceMap.values());
  }

  function broadcastLeaderboardUpdate(type = 'leaderboard_update') {
    if (sseClients.size === 0) return;
    const payload = JSON.stringify({
      type,
      onlineCount: Math.max(sseClients.size, presenceMap.size),
      timestamp: Date.now(),
    });
    for (const clientRes of sseClients) {
      try {
        clientRes.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(clientRes);
      }
    }
  }

  return async function scoringMiddleware(req, res, next) {
    if (!req.url || !req.url.startsWith('/api/')) {
      return next();
    }

    const urlObj = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname;

    try {
      // GET /api/leaderboard/stream (Server-Sent Events for live session updates)
      if (req.method === 'GET' && pathname === '/api/leaderboard/stream') {
        if (sseClients.size >= 100) {
          return sendJson(res, 429, { error: 'Too many live stream connections' });
        }
        res.statusCode = 200;
        setSecurityHeaders(res);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        sseClients.add(res);
        res.write(
          `data: ${JSON.stringify({
            type: 'connected',
            onlineCount: Math.max(sseClients.size, presenceMap.size),
            timestamp: Date.now(),
          })}\n\n`
        );
        broadcastLeaderboardUpdate('presence_update');

        req.on('close', () => {
          sseClients.delete(res);
          broadcastLeaderboardUpdate('presence_update');
        });
        return;
      }

      // POST /api/presence/heartbeat
      if (req.method === 'POST' && pathname === '/api/presence/heartbeat') {
        const body = await readJsonBody(req);
        const connectionId = String(body.connectionId || '').slice(0, 64);
        if (!connectionId) {
          return sendJson(res, 400, { error: 'Missing connectionId' });
        }
        const cleanName = sanitizePlayerName(body.playerName) || 'Guest Player';
        const cleanRegion = sanitizeRegion(body.region);
        const playerId = String(body.playerId || createDeterministicPlayerId(cleanName, cleanRegion)).slice(0, 80);
        const isPlaying = Boolean(body.isPlaying);

        const prev = presenceMap.get(connectionId);
        presenceMap.set(connectionId, {
          uid: connectionId,
          playerId,
          playerName: cleanName,
          region: cleanRegion,
          isPlaying,
          state: 'online',
          lastChanged: Date.now(),
        });

        let playerAdded = false;
        if (cleanName.length >= 2 && cleanName.toLowerCase() !== 'guest player' && cleanName.toLowerCase() !== 'player') {
          const sizeBefore = playersMap.size;
          resolveOrCreatePlayer(playersMap, playerId, cleanName, cleanRegion);
          if (playersMap.size !== sizeBefore) {
            savePlayersMap(playersMap);
            playerAdded = true;
          }
        }

        const participants = getActivePresenceList();
        if (
          !prev ||
          prev.playerName !== cleanName ||
          prev.region !== cleanRegion ||
          prev.isPlaying !== isPlaying ||
          playerAdded
        ) {
          broadcastLeaderboardUpdate('presence_update');
        }

        return sendJson(res, 200, {
          onlineCount: Math.max(participants.length, sseClients.size, 1),
          participants,
        });
      }

      // POST /api/presence/leave
      if (req.method === 'POST' && pathname === '/api/presence/leave') {
        const body = await readJsonBody(req);
        const connectionId = String(body.connectionId || '').slice(0, 64);
        if (connectionId && presenceMap.delete(connectionId)) {
          broadcastLeaderboardUpdate('presence_update');
        }
        return sendJson(res, 200, {
          onlineCount: getActivePresenceList().length,
        });
      }

      // GET /api/leaderboard
      if (req.method === 'GET' && pathname === '/api/leaderboard') {
        const playerId = String(urlObj.searchParams.get('playerId') || '').slice(0, 80);
        const playerName = sanitizePlayerName(urlObj.searchParams.get('playerName')) || 'Player';
        const region = sanitizeRegion(urlObj.searchParams.get('region'));

        if (playerName.length >= 2 && playerName.toLowerCase() !== 'player') {
          const hadBefore = playersMap.size;
          resolveOrCreatePlayer(playersMap, playerId, playerName, region);
          if (playersMap.size !== hadBefore) {
            savePlayersMap(playersMap);
            broadcastLeaderboardUpdate();
          }
        }

        const state = buildLeaderboardState(playersMap, sessions, playerId, playerName, region);
        return sendJson(res, 200, state);
      }

      // POST /api/leaderboard/sync
      if (req.method === 'POST' && pathname === '/api/leaderboard/sync') {
        const body = await readJsonBody(req);
        const incoming = Array.isArray(body.entries) ? body.entries.slice(0, 200) : [];
        let changed = false;

        for (const item of incoming) {
          if (!item || typeof item !== 'object') continue;
          const cleanName = sanitizePlayerName(item.playerName);
          if (!cleanName || cleanName.length < 2 || cleanName.toLowerCase() === 'player') {
            continue;
          }
          const cleanRegion = sanitizeRegion(item.region);
          const existing = resolveOrCreatePlayer(
            playersMap,
            String(item.playerId || ''),
            cleanName,
            cleanRegion
          );
          const incomingScore = Math.max(0, Math.floor(Number(item.cumulativeScore) || 0));
          const incomingSolved = Math.max(0, Math.floor(Number(item.puzzlesSolved) || 0));
          const incomingBest =
            typeof item.bestTimeSeconds === 'number' && item.bestTimeSeconds > 0
              ? Math.floor(item.bestTimeSeconds)
              : null;

          if (incomingScore > existing.cumulativeScore) {
            existing.cumulativeScore = incomingScore;
            changed = true;
          }
          if (incomingSolved > existing.puzzlesSolved) {
            existing.puzzlesSolved = incomingSolved;
            changed = true;
          }
          if (
            incomingBest !== null &&
            (existing.bestTimeSeconds === null || incomingBest < existing.bestTimeSeconds)
          ) {
            existing.bestTimeSeconds = incomingBest;
            changed = true;
          }
        }

        if (changed) {
          savePlayersMap(playersMap);
          broadcastLeaderboardUpdate();
        }
        return sendJson(res, 200, { synced: true, totalPlayers: playersMap.size });
      }

      // POST /api/player/register
      if (req.method === 'POST' && pathname === '/api/player/register') {
        const body = await readJsonBody(req);
        const requestedPlayerId = String(body.playerId || '').slice(0, 80);
        const playerName = sanitizePlayerName(body.playerName);
        const region = sanitizeRegion(body.region);

        if (playerName.length < 2) {
          return sendJson(res, 400, {
            error: 'Player name must be between 2 and 32 characters.',
          });
        }

        const resolvedPlayer = resolveOrCreatePlayer(
          playersMap,
          requestedPlayerId,
          playerName,
          region
        );
        savePlayersMap(playersMap);

        const state = buildLeaderboardState(
          playersMap,
          sessions,
          resolvedPlayer.playerId,
          resolvedPlayer.playerName,
          resolvedPlayer.region
        );
        broadcastLeaderboardUpdate();
        return sendJson(res, 200, state);
      }

      // POST /api/leaderboard/clear (restricted to local loopback administration)
      if (req.method === 'POST' && pathname === '/api/leaderboard/clear') {
        if (!isLocalLoopbackRequest(req)) {
          return sendJson(res, 403, { error: 'Forbidden: local administrative access only' });
        }
        playersMap.clear();
        sessions.clear();
        savePlayersMap(playersMap);
        broadcastLeaderboardUpdate();
        return sendJson(res, 200, { cleared: true });
      }

      // POST /api/puzzle/start
      if (req.method === 'POST' && pathname === '/api/puzzle/start') {
        pruneStaleSessions(sessions);

        const body = await readJsonBody(req);
        const requestedPlayerId = String(body.playerId || 'anonymous-player').slice(0, 80);
        const playerName = sanitizePlayerName(body.playerName) || 'Player';
        const region = sanitizeRegion(body.region);
        const imageId = sanitizeImageId(body.imageId);
        const gridSize = ALLOWED_GRID_SIZE;
        const minRequiredMoves = computeMinimumSwapsForBoard(body.initialTiles, gridSize);

        const resolvedPlayer = resolveOrCreatePlayer(
          playersMap,
          requestedPlayerId,
          playerName,
          region
        );
        const playerId = resolvedPlayer.playerId;

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
          playerName: resolvedPlayer.playerName,
          region: resolvedPlayer.region,
          imageId,
          gridSize,
          minRequiredMoves,
          startedAtMonoMs: nowMono,
          pausedAtMonoMs: null,
          totalPausedMs: 0,
          status: 'active',
          submissionResult: null,
        });

        savePlayersMap(playersMap);
        const leaderboard = buildLeaderboardState(
          playersMap,
          sessions,
          playerId,
          resolvedPlayer.playerName,
          resolvedPlayer.region
        );
        broadcastLeaderboardUpdate();

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
        broadcastLeaderboardUpdate();
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
        broadcastLeaderboardUpdate();
        return sendJson(res, 200, { status: 'active' });
      }

      // POST /api/puzzle/abandon
      if (req.method === 'POST' && pathname === '/api/puzzle/abandon') {
        const body = await readJsonBody(req);
        const session = sessions.get(String(body.sessionId || ''));
        if (session && (session.status === 'active' || session.status === 'paused')) {
          session.status = 'abandoned';
          broadcastLeaderboardUpdate();
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

        const moves = Math.floor(Number(body.moves));
        const minMoves = session.minRequiredMoves || 1;
        if (!Number.isFinite(moves) || moves < minMoves) {
          return sendJson(res, 400, {
            error: `Invalid move count: solving this board requires at least ${minMoves} moves.`,
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

        // Reject impossible sub-second automated script submissions
        if (activeDurationMs < 800) {
          return sendJson(res, 400, {
            error: 'Completion time is unrealistically fast. Points cannot be awarded.',
          });
        }

        const elapsedSeconds = Math.max(1, Math.floor(activeDurationMs / 1000));
        const pointsAwarded = calculateAuthoritativeTimeScore(elapsedSeconds);
        const tier = getTierForSeconds(elapsedSeconds);

        const beforeState = buildLeaderboardState(
          playersMap,
          sessions,
          session.playerId,
          session.playerName,
          session.region
        );
        const previousRank =
          beforeState.playerEntry.puzzlesSolved > 0 ? beforeState.playerEntry.rank : null;

        const existingPlayer = resolveOrCreatePlayer(
          playersMap,
          session.playerId,
          session.playerName,
          session.region
        );

        const updatedPlayer = {
          ...existingPlayer,
          cumulativeScore: existingPlayer.cumulativeScore + pointsAwarded,
          puzzlesSolved: existingPlayer.puzzlesSolved + 1,
          bestTimeSeconds:
            existingPlayer.bestTimeSeconds === null
              ? elapsedSeconds
              : Math.min(existingPlayer.bestTimeSeconds, elapsedSeconds),
          updatedAt: new Date().toISOString(),
        };

        playersMap.set(updatedPlayer.playerId, updatedPlayer);
        session.status = 'completed';
        savePlayersMap(playersMap);

        const updatedLeaderboard = buildLeaderboardState(
          playersMap,
          sessions,
          updatedPlayer.playerId,
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

        session.submissionResult = result;
        broadcastLeaderboardUpdate();

        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    } catch (err) {
      return sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Bad request',
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
