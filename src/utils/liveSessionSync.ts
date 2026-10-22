import { LeaderboardEntry } from '../types/puzzle';
import { createPlayerIdFromProfile } from '../shared/scoring';

export type RawLeaderboardEntry = Omit<LeaderboardEntry, 'rank'> & {
  lastSeenAt?: number;
};

const TOPIC_PREFIX = '1ghimagepuzzle/v6/session';
const PLAYER_TOPIC_PREFIX = `${TOPIC_PREFIX}/players/`;
const ROSTER_SNAPSHOT_TOPIC = `${TOPIC_PREFIX}/roster/snapshot`;
const LIVE_EVENTS_TOPIC = `${TOPIC_PREFIX}/events`;

const PUBLIC_WSS_MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const PLAYING_STATUS_TTL_MS = 10 * 60 * 1000; // 10 minutes max active playing indicator without update

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeMqttVariableLength(length: number): number[] {
  const bytes: number[] = [];
  let rem = length;
  do {
    let encodedByte = rem % 128;
    rem = Math.floor(rem / 128);
    if (rem > 0) {
      encodedByte |= 128;
    }
    bytes.push(encodedByte);
  } while (rem > 0);
  return bytes;
}

function encodeMqttUtf8(str: string): Uint8Array {
  const utf8 = textEncoder.encode(str);
  const out = new Uint8Array(2 + utf8.length);
  out[0] = (utf8.length >> 8) & 0xff;
  out[1] = utf8.length & 0xff;
  out.set(utf8, 2);
  return out;
}

function buildMqttConnectPacket(clientId: string, keepAliveSeconds = 30): Uint8Array {
  const protocolName = encodeMqttUtf8('MQTT');
  const connectFlags = 0x02; // Clean Session
  const varHeader = new Uint8Array(protocolName.length + 4);
  varHeader.set(protocolName, 0);
  varHeader[protocolName.length] = 0x04; // Protocol Level 4 (MQTT 3.1.1)
  varHeader[protocolName.length + 1] = connectFlags;
  varHeader[protocolName.length + 2] = (keepAliveSeconds >> 8) & 0xff;
  varHeader[protocolName.length + 3] = keepAliveSeconds & 0xff;

  const payload = encodeMqttUtf8(clientId);
  const remLenBytes = encodeMqttVariableLength(varHeader.length + payload.length);

  const packet = new Uint8Array(1 + remLenBytes.length + varHeader.length + payload.length);
  packet[0] = 0x10; // CONNECT
  packet.set(remLenBytes, 1);
  packet.set(varHeader, 1 + remLenBytes.length);
  packet.set(payload, 1 + remLenBytes.length + varHeader.length);
  return packet;
}

function buildMqttSubscribePacket(packetId: number, topics: string[]): Uint8Array {
  const topicChunks = topics.map((t) => {
    const encoded = encodeMqttUtf8(t);
    const withQos = new Uint8Array(encoded.length + 1);
    withQos.set(encoded, 0);
    withQos[encoded.length] = 0x00; // QoS 0
    return withQos;
  });

  const payloadLength = topicChunks.reduce((acc, c) => acc + c.length, 0);
  const remLenBytes = encodeMqttVariableLength(2 + payloadLength);

  const packet = new Uint8Array(1 + remLenBytes.length + 2 + payloadLength);
  packet[0] = 0x82; // SUBSCRIBE
  packet.set(remLenBytes, 1);
  let offset = 1 + remLenBytes.length;
  packet[offset++] = (packetId >> 8) & 0xff;
  packet[offset++] = packetId & 0xff;

  for (const chunk of topicChunks) {
    packet.set(chunk, offset);
    offset += chunk.length;
  }
  return packet;
}

function buildMqttPublishPacket(topic: string, payloadStr: string, retain = false): Uint8Array {
  const topicBytes = encodeMqttUtf8(topic);
  const payloadBytes = textEncoder.encode(payloadStr);
  const remLength = topicBytes.length + payloadBytes.length;
  const remLenBytes = encodeMqttVariableLength(remLength);

  const packet = new Uint8Array(1 + remLenBytes.length + remLength);
  packet[0] = retain ? 0x31 : 0x30; // PUBLISH QoS 0, optional RETAIN flag
  packet.set(remLenBytes, 1);
  packet.set(topicBytes, 1 + remLenBytes.length);
  packet.set(payloadBytes, 1 + remLenBytes.length + topicBytes.length);
  return packet;
}

function buildMqttPingReqPacket(): Uint8Array {
  return new Uint8Array([0xc0, 0x00]);
}

interface ParsedPublishPacket {
  topic: string;
  payload: string;
}

function parseIncomingMqttPackets(buffer: Uint8Array): {
  messages: ParsedPublishPacket[];
  connAckReceived: boolean;
  consumedBytes: number;
} {
  const messages: ParsedPublishPacket[] = [];
  let connAckReceived = false;
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 2 > buffer.length) break;

    const headerByte = buffer[offset];
    const packetType = headerByte >> 4;
    const qos = (headerByte >> 1) & 0x03;

    let multiplier = 1;
    let remLength = 0;
    let lenBytes = 0;
    let completeLength = false;

    for (let i = 1; i <= 4; i++) {
      if (offset + i >= buffer.length) {
        break;
      }
      const encodedByte = buffer[offset + i];
      remLength += (encodedByte & 127) * multiplier;
      multiplier *= 128;
      lenBytes = i;
      if ((encodedByte & 128) === 0) {
        completeLength = true;
        break;
      }
    }

    if (!completeLength) break;

    const packetTotalLen = 1 + lenBytes + remLength;
    if (offset + packetTotalLen > buffer.length) break;

    const bodyStart = offset + 1 + lenBytes;
    const bodyEnd = offset + packetTotalLen;

    if (packetType === 2) {
      // CONNACK
      connAckReceived = true;
    } else if (packetType === 3 && bodyStart + 2 <= bodyEnd) {
      // PUBLISH
      const topicLen = (buffer[bodyStart] << 8) | buffer[bodyStart + 1];
      let payloadStart = bodyStart + 2 + topicLen;
      if (qos > 0) {
        payloadStart += 2; // Packet identifier for QoS 1/2
      }
      if (payloadStart <= bodyEnd) {
        const topic = textDecoder.decode(buffer.subarray(bodyStart + 2, bodyStart + 2 + topicLen));
        const payload = textDecoder.decode(buffer.subarray(payloadStart, bodyEnd));
        messages.push({ topic, payload });
      }
    }

    offset += packetTotalLen;
  }

  return { messages, connAckReceived, consumedBytes: offset };
}

/**
 * Normalizes and validates a candidate player entry so malformed payloads are ignored.
 */
export function sanitizeEntry(raw: unknown): RawLeaderboardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const playerName = String(obj.playerName ?? '').trim().slice(0, 32);
  if (!playerName || playerName.length < 2) return null;
  // Do not sync the unconfigured default placeholder name "Player"
  if (playerName.toLowerCase() === 'player' && Number(obj.cumulativeScore || 0) === 0) {
    return null;
  }

  const region = String(obj.region ?? 'Greater Accra').trim() || 'Greater Accra';
  const canonicalId = createPlayerIdFromProfile(playerName, region);
  const cumulativeScore = Math.max(0, Math.floor(Number(obj.cumulativeScore) || 0));
  const puzzlesSolved = Math.max(0, Math.floor(Number(obj.puzzlesSolved) || 0));
  const rawBest = obj.bestTimeSeconds;
  const bestTimeSeconds =
    typeof rawBest === 'number' && Number.isFinite(rawBest) && rawBest > 0
      ? Math.floor(rawBest)
      : null;
  const updatedAt =
    typeof obj.updatedAt === 'string' && obj.updatedAt
      ? obj.updatedAt
      : new Date().toISOString();
  const lastSeenAt =
    typeof obj.lastSeenAt === 'number' && Number.isFinite(obj.lastSeenAt)
      ? obj.lastSeenAt
      : Date.now();
  const isPlaying =
    Boolean(obj.isPlaying) && Date.now() - lastSeenAt < PLAYING_STATUS_TTL_MS;

  return {
    playerId: canonicalId,
    playerName,
    region,
    cumulativeScore,
    puzzlesSolved,
    bestTimeSeconds,
    updatedAt,
    isPlaying,
    lastSeenAt,
  };
}

/**
 * Conflict-free merge of two entries for the same player.
 * Preserves the highest cumulativeScore & puzzlesSolved, lowest bestTimeSeconds,
 * and the freshest playing status.
 */
export function mergeTwoPlayerEntries(
  existing: RawLeaderboardEntry,
  incoming: RawLeaderboardEntry
): RawLeaderboardEntry {
  const existingSeen = existing.lastSeenAt ?? new Date(existing.updatedAt).getTime() ?? 0;
  const incomingSeen = incoming.lastSeenAt ?? new Date(incoming.updatedAt).getTime() ?? 0;
  const isIncomingNewer = incomingSeen >= existingSeen;

  const cumulativeScore = Math.max(existing.cumulativeScore, incoming.cumulativeScore);
  const puzzlesSolved = Math.max(existing.puzzlesSolved, incoming.puzzlesSolved);

  let bestTimeSeconds: number | null = null;
  if (existing.bestTimeSeconds !== null && incoming.bestTimeSeconds !== null) {
    bestTimeSeconds = Math.min(existing.bestTimeSeconds, incoming.bestTimeSeconds);
  } else {
    bestTimeSeconds = existing.bestTimeSeconds ?? incoming.bestTimeSeconds;
  }

  const latestSeen = Math.max(existingSeen, incomingSeen);
  const rawIsPlaying = isIncomingNewer ? incoming.isPlaying : existing.isPlaying;
  const isPlaying = Boolean(rawIsPlaying) && Date.now() - latestSeen < PLAYING_STATUS_TTL_MS;

  return {
    playerId: existing.playerId,
    playerName: isIncomingNewer ? incoming.playerName : existing.playerName,
    region: isIncomingNewer ? incoming.region : existing.region,
    cumulativeScore,
    puzzlesSolved,
    bestTimeSeconds,
    updatedAt:
      incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : existing.updatedAt,
    isPlaying,
    lastSeenAt: latestSeen,
  };
}

/**
 * Singleton manager that maintains real-time WebSocket connections to public MQTT brokers
 * and synchronizes the session leaderboard across all participants and devices.
 */
class LiveSessionSyncManager {
  private entriesMap = new Map<string, RawLeaderboardEntry>();
  private listeners = new Set<() => void>();
  private connections = new Map<string, { ws: WebSocket; ready: boolean; pingTimer?: number }>();
  private started = false;
  private localSelfEntry: RawLeaderboardEntry | null = null;
  private clientId = `1gh-${Math.random().toString(36).slice(2, 10)}`;

  public init(initialEntries: RawLeaderboardEntry[] = []): void {
    for (const item of initialEntries) {
      this.upsertEntryInternal(item);
    }

    if (this.started || typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }
    this.started = true;

    for (const brokerUrl of PUBLIC_WSS_MQTT_BROKERS) {
      this.connectBroker(brokerUrl);
    }
  }

  public getEntries(): RawLeaderboardEntry[] {
    return Array.from(this.entriesMap.values());
  }

  public mergeExternalEntries(entries: unknown[]): boolean {
    let changed = false;
    for (const raw of entries) {
      const sanitized = sanitizeEntry(raw);
      if (sanitized && this.upsertEntryInternal(sanitized)) {
        changed = true;
      }
    }
    if (changed) {
      this.notifyListeners();
    }
    return changed;
  }

  public publishPlayerEntry(entry: RawLeaderboardEntry): void {
    const sanitized = sanitizeEntry({
      ...entry,
      lastSeenAt: Date.now(),
    });
    if (!sanitized) return;

    this.localSelfEntry = sanitized;
    this.upsertEntryInternal(sanitized);
    this.notifyListeners();

    const playerPayload = JSON.stringify(sanitized);
    const playerTopic = `${PLAYER_TOPIC_PREFIX}${sanitized.playerId}`;

    // 1. Publish retained message for this specific player so any future participant gets it immediately
    this.broadcastMqtt(playerTopic, playerPayload, true);

    // 2. Publish updated retained roster snapshot so new participants get the full list in 1 message
    this.publishRosterSnapshot();

    // 3. Publish live event for instant push
    this.broadcastMqtt(
      LIVE_EVENTS_TOPIC,
      JSON.stringify({
        type: 'player_update',
        sender: this.clientId,
        player: sanitized,
        timestamp: Date.now(),
      }),
      false
    );
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.init();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publishRosterSnapshot(): void {
    const allEntries = this.getEntries();
    if (allEntries.length === 0) return;
    const snapshotPayload = JSON.stringify({
      updatedAt: Date.now(),
      entries: allEntries.slice(0, 150),
    });
    this.broadcastMqtt(ROSTER_SNAPSHOT_TOPIC, snapshotPayload, true);
  }

  private upsertEntryInternal(candidate: RawLeaderboardEntry): boolean {
    const existing = this.entriesMap.get(candidate.playerId);
    if (!existing) {
      this.entriesMap.set(candidate.playerId, candidate);
      return true;
    }

    const merged = mergeTwoPlayerEntries(existing, candidate);
    const changed =
      merged.cumulativeScore !== existing.cumulativeScore ||
      merged.puzzlesSolved !== existing.puzzlesSolved ||
      merged.bestTimeSeconds !== existing.bestTimeSeconds ||
      merged.isPlaying !== existing.isPlaying ||
      merged.playerName !== existing.playerName ||
      merged.region !== existing.region;

    this.entriesMap.set(candidate.playerId, merged);
    return changed;
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  }

  private broadcastMqtt(topic: string, payload: string, retain: boolean): void {
    const packet = buildMqttPublishPacket(topic, payload, retain);
    for (const conn of this.connections.values()) {
      if (conn.ready && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(packet);
        } catch {
          // Ignore send failure
        }
      }
    }
  }

  private connectBroker(brokerUrl: string): void {
    try {
      const ws = new WebSocket(brokerUrl, 'mqtt');
      ws.binaryType = 'arraybuffer';

      const connState: { ws: WebSocket; ready: boolean; pingTimer?: number } = {
        ws,
        ready: false,
      };
      this.connections.set(brokerUrl, connState);

      let recvBuffer = new Uint8Array(0);

      ws.onopen = () => {
        try {
          const connectPkt = buildMqttConnectPacket(
            `${this.clientId}-${Math.random().toString(36).slice(2, 6)}`,
            30
          );
          ws.send(connectPkt);
        } catch {
          // Ignore error
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const chunk = new Uint8Array(event.data);
        const combined = new Uint8Array(recvBuffer.length + chunk.length);
        combined.set(recvBuffer, 0);
        combined.set(chunk, recvBuffer.length);

        const { messages, connAckReceived, consumedBytes } =
          parseIncomingMqttPackets(combined);
        recvBuffer = combined.slice(consumedBytes);

        if (connAckReceived && !connState.ready) {
          connState.ready = true;
          try {
            // Subscribe to all per-player retained topics, the roster snapshot, and live events
            const subPkt = buildMqttSubscribePacket(1, [
              `${PLAYER_TOPIC_PREFIX}+`,
              ROSTER_SNAPSHOT_TOPIC,
              LIVE_EVENTS_TOPIC,
            ]);
            ws.send(subPkt);

            // Announce our own player entry if we have one
            if (this.localSelfEntry) {
              const selfPayload = JSON.stringify(this.localSelfEntry);
              ws.send(
                buildMqttPublishPacket(
                  `${PLAYER_TOPIC_PREFIX}${this.localSelfEntry.playerId}`,
                  selfPayload,
                  true
                )
              );
            }

            // Ask active peers to broadcast their roster
            ws.send(
              buildMqttPublishPacket(
                LIVE_EVENTS_TOPIC,
                JSON.stringify({
                  type: 'sync_request',
                  sender: this.clientId,
                  timestamp: Date.now(),
                }),
                false
              )
            );
          } catch {
            // Ignore error
          }

          connState.pingTimer = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(buildMqttPingReqPacket());
              } catch {
                // Ignore
              }
            }
          }, 25000);
        }

        let anyUpdated = false;
        for (const msg of messages) {
          if (this.handleMqttMessage(msg.topic, msg.payload)) {
            anyUpdated = true;
          }
        }

        if (anyUpdated) {
          this.notifyListeners();
        }
      };

      ws.onclose = () => {
        if (connState.pingTimer) {
          window.clearInterval(connState.pingTimer);
        }
        this.connections.delete(brokerUrl);
        // Reconnect with backoff
        window.setTimeout(() => {
          this.connectBroker(brokerUrl);
        }, 5000);
      };

      ws.onerror = () => {
        // Error handled by onclose reconnect
      };
    } catch {
      // Ignore connection setup error
    }
  }

  private handleMqttMessage(topic: string, payload: string): boolean {
    if (!payload) return false;
    try {
      const parsed = JSON.parse(payload);
      if (topic.startsWith(PLAYER_TOPIC_PREFIX)) {
        const sanitized = sanitizeEntry(parsed);
        if (sanitized) {
          return this.upsertEntryInternal(sanitized);
        }
      } else if (topic === ROSTER_SNAPSHOT_TOPIC) {
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        let changed = false;
        for (const item of entries) {
          const sanitized = sanitizeEntry(item);
          if (sanitized && this.upsertEntryInternal(sanitized)) {
            changed = true;
          }
        }
        return changed;
      } else if (topic === LIVE_EVENTS_TOPIC) {
        if (parsed?.sender === this.clientId) return false;
        if (parsed?.type === 'player_update' && parsed.player) {
          const sanitized = sanitizeEntry(parsed.player);
          if (sanitized) {
            return this.upsertEntryInternal(sanitized);
          }
        } else if (parsed?.type === 'sync_request') {
          if (this.localSelfEntry) {
            const selfPayload = JSON.stringify(this.localSelfEntry);
            this.broadcastMqtt(
              `${PLAYER_TOPIC_PREFIX}${this.localSelfEntry.playerId}`,
              selfPayload,
              true
            );
          }
          this.publishRosterSnapshot();
        }
      }
    } catch {
      // Ignore malformed JSON
    }
    return false;
  }
}

export const liveSessionSync = new LiveSessionSyncManager();
