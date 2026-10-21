import { PuzzleTileData } from '../types/puzzle';
import { DEFAULT_GRID_SIZE } from '../data/puzzles';

/**
 * Checks whether every tile in the array is in its solved position (`correctIndex === index`).
 */
export function isPuzzleSolved(tiles: PuzzleTileData[]): boolean {
  if (tiles.length === 0) return false;
  return tiles.every((tile, index) => tile.correctIndex === index);
}

/**
 * Counts how many tiles are currently placed in their correct target position.
 */
export function countCorrectTiles(tiles: PuzzleTileData[]): number {
  return tiles.reduce(
    (acc, tile, index) => (tile.correctIndex === index ? acc + 1 : acc),
    0
  );
}

/**
 * Calculates puzzle completion progress as a percentage (0 to 100).
 */
export function calculateProgressPercentage(tiles: PuzzleTileData[]): number {
  if (tiles.length === 0) return 0;
  return Math.round((countCorrectTiles(tiles) / tiles.length) * 100);
}

/**
 * Generates a fresh, shuffled set of tiles for the puzzle grid.
 * Uses Fisher-Yates shuffle and guarantees the resulting arrangement is NOT already solved
 * and has a genuine scramble.
 */
export function createShuffledTiles(gridSize: number = DEFAULT_GRID_SIZE): PuzzleTileData[] {
  const totalTiles = gridSize * gridSize;
  const indices = Array.from({ length: totalTiles }, (_, i) => i);

  let shuffled = [...indices];
  let attempts = 0;

  do {
    shuffled = [...indices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    attempts++;
    // Ensure at least 75% of tiles are displaced so the shuffle feels genuine
    const stayCount = shuffled.filter((val, idx) => val === idx).length;
    if (stayCount <= Math.floor(totalTiles * 0.25) && !shuffled.every((v, idx) => v === idx)) {
      break;
    }
  } while (attempts < 25);

  // Absolute safeguard: if still solved, swap the first two tiles
  if (shuffled.every((val, idx) => val === idx)) {
    const temp = shuffled[0];
    shuffled[0] = shuffled[1];
    shuffled[1] = temp;
  }

  return shuffled.map((correctIndex, currentIndex) => ({
    id: `tile-${correctIndex}`,
    correctIndex,
    currentIndex,
  }));
}

/**
 * Swaps two tiles in the board array by their tile IDs (`firstTileId` and `secondTileId`).
 * Fixes the legacy adjacent-sibling swap bug by performing a clean immutable array swap.
 */
export function swapTilesById(
  tiles: PuzzleTileData[],
  firstTileId: string,
  secondTileId: string
): { nextTiles: PuzzleTileData[]; didSwap: boolean } {
  if (firstTileId === secondTileId) {
    return { nextTiles: tiles, didSwap: false };
  }

  const indexA = tiles.findIndex((t) => t.id === firstTileId);
  const indexB = tiles.findIndex((t) => t.id === secondTileId);

  if (indexA === -1 || indexB === -1 || indexA === indexB) {
    return { nextTiles: tiles, didSwap: false };
  }

  const nextTiles = [...tiles];
  const tileA = nextTiles[indexA];
  const tileB = nextTiles[indexB];

  nextTiles[indexA] = { ...tileB, currentIndex: indexA };
  nextTiles[indexB] = { ...tileA, currentIndex: indexB };

  return { nextTiles, didSwap: true };
}

/**
 * Computes CSS background properties for slicing an image across `gridSize x gridSize` tiles.
 * Preserves exact mathematical cropping and alignment so tiles form one continuous picture.
 */
export function getTileBackgroundStyle(
  imageSrc: string,
  correctIndex: number,
  gridSize: number = DEFAULT_GRID_SIZE
): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
} {
  const percentage = 100 / (gridSize - 1);
  const col = correctIndex % gridSize;
  const row = Math.floor(correctIndex / gridSize);

  const xPos = `${(percentage * col).toFixed(4)}%`;
  const yPos = `${(percentage * row).toFixed(4)}%`;

  return {
    backgroundImage: `url("${imageSrc}")`,
    backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
    backgroundPosition: `${xPos} ${yPos}`,
  };
}

/**
 * Formats elapsed seconds into MM:SS string (e.g. "01:24").
 */
export function formatTimeMMSS(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats elapsed seconds into a human-readable string (e.g., "1m 24s" or "42s").
 */
export function formatTimeHuman(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Returns the storage key for best scores of a given image.
 */
export function getScoreKey(imageId: string): string {
  return `${imageId}-${DEFAULT_GRID_SIZE}`;
}
