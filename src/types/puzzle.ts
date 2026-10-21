export interface PuzzleImage {
  id: string;
  filename: string;
  src: string;
  title: string;
  category: string;
  subtitle: string;
}

export interface PuzzleTileData {
  /** Unique identifier for dnd-kit, e.g. "tile-0" */
  id: string;
  /** The original index (0 to gridSize*gridSize - 1) where this slice belongs in the solved image */
  correctIndex: number;
  /** Current position index on the board (0 to gridSize*gridSize - 1) */
  currentIndex: number;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won';

export type ActiveScreen = 'welcome' | 'gallery' | 'game';

export interface PlayerProfile {
  playerId: string;
  name: string;
  region: string;
}

export interface BestScoreRecord {
  moves: number;
  timeSeconds: number;
  points: number;
  achievedAt: string;
}

/** Keyed by imageId */
export type BestScoresMap = Record<string, BestScoreRecord>;

export interface UserPreferences {
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  showTileHints: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  region: string;
  cumulativeScore: number;
  puzzlesSolved: number;
  bestTimeSeconds: number | null;
  rank: number;
  updatedAt: string;
}

export interface LeaderboardState {
  playerEntry: LeaderboardEntry;
  totalPlayers: number;
  entries: LeaderboardEntry[];
}

export interface ScoreSubmissionResult {
  sessionId: string;
  elapsedSeconds: number;
  pointsAwarded: number;
  tierLabel: string;
  cumulativeScore: number;
  globalRank: number;
  previousRank: number | null;
  totalPlayers: number;
  alreadyAwarded: boolean;
  leaderboard: LeaderboardState;
}
