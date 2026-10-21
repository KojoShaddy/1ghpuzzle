import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { Eye, Play, Hand } from 'lucide-react';
import { GameStatus, PuzzleImage, PuzzleTileData } from '../types/puzzle';
import { getTileBackgroundStyle } from '../utils/puzzleUtils';
import { PuzzleTile } from './PuzzleTile';

interface PuzzleBoardProps {
  tiles: PuzzleTileData[];
  gridSize: number;
  image: PuzzleImage;
  status: GameStatus;
  selectedTileId: string | null;
  lastMovedTileIds: [string, string] | null;
  showTileHints: boolean;
  showReferenceOverlay: boolean;
  onSwapTiles: (firstId: string, secondId: string) => void;
  onSelectOrSwapTile: (tileId: string) => void;
  onResume: () => void;
  onToggleReferenceOverlay: () => void;
}

export const PuzzleBoard: React.FC<PuzzleBoardProps> = React.memo(
  ({
    tiles,
    gridSize,
    image,
    status,
    selectedTileId,
    lastMovedTileIds,
    showTileHints,
    showReferenceOverlay,
    onSwapTiles,
    onSelectOrSwapTile,
    onResume,
    onToggleReferenceOverlay,
  }) => {
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
      useSensor(MouseSensor, {
        activationConstraint: {
          distance: 6,
        },
      }),
      useSensor(TouchSensor, {
        activationConstraint: {
          distance: 6,
        },
      })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
      setActiveDragId(String(event.active.id));
    }, []);

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (over && active.id !== over.id) {
          onSwapTiles(String(active.id), String(over.id));
        }
      },
      [onSwapTiles]
    );

    const handleDragCancel = useCallback(() => {
      setActiveDragId(null);
    }, []);

    // Keyboard grid navigation with arrow keys
    const handleKeyNavigate = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>, boardIndex: number) => {
        const total = gridSize * gridSize;
        let nextIndex: number | null = null;

        switch (e.key) {
          case 'ArrowRight':
            nextIndex = (boardIndex + 1) % total;
            break;
          case 'ArrowLeft':
            nextIndex = (boardIndex - 1 + total) % total;
            break;
          case 'ArrowDown':
            nextIndex = (boardIndex + gridSize) % total;
            break;
          case 'ArrowUp':
            nextIndex = (boardIndex - gridSize + total) % total;
            break;
          default:
            return;
        }

        if (nextIndex !== null) {
          e.preventDefault();
          const nextEl = document.getElementById(`puzzle-tile-pos-${nextIndex}`);
          nextEl?.focus();
        }
      },
      [gridSize]
    );

    const activeTile = activeDragId ? tiles.find((t) => t.id === activeDragId) : null;

    return (
      <div className="w-full flex flex-col items-center">
        {/* Square Responsive Board Container with nearly seamless 1px hairline gap */}
        <div
          id="puzzle-board-container"
          className="relative w-full max-w-[min(94vw,480px)] sm:max-w-[480px] aspect-square rounded-2xl p-1.5 bg-slate-900 dark:bg-slate-900 shadow-2xl shadow-slate-950/20 border border-slate-800 select-none"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div
              id="puzzle-grid"
              role="grid"
              aria-label={`${image.title} puzzle board`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
              }}
              className={`w-full h-full grid rounded-xl overflow-hidden bg-slate-950/60 ${
                status === 'won' ? 'gap-0' : 'gap-[1px]'
              } ${status === 'paused' ? 'invisible pointer-events-none' : ''}`}
            >
              {tiles.map((tile, index) => (
                <PuzzleTile
                  key={tile.id}
                  tile={tile}
                  boardIndex={index}
                  gridSize={gridSize}
                  imageSrc={image.src}
                  isSelected={selectedTileId === tile.id}
                  isRecentlyMoved={Boolean(
                    lastMovedTileIds &&
                      (lastMovedTileIds[0] === tile.id || lastMovedTileIds[1] === tile.id)
                  )}
                  showHint={showTileHints}
                  disabled={status !== 'playing'}
                  onSelectOrSwap={onSelectOrSwapTile}
                  onKeyNavigate={handleKeyNavigate}
                />
              ))}
            </div>

            <DragOverlay adjustScale={false} dropAnimation={null}>
              {activeTile ? (
                <div
                  style={getTileBackgroundStyle(
                    image.src,
                    activeTile.correctIndex,
                    gridSize
                  )}
                  className="w-full h-full aspect-square shadow-2xl ring-2 ring-emerald-400 scale-105 cursor-grabbing bg-no-repeat pointer-events-none"
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Reference Original Image Overlay (when toggled on mobile/desktop) */}
          {showReferenceOverlay && status === 'playing' && (
            <div
              id="reference-image-overlay"
              onClick={onToggleReferenceOverlay}
              className="absolute inset-1.5 z-30 rounded-xl overflow-hidden bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer animate-pop-in"
            >
              <img
                src={image.src}
                alt={`Original reference for ${image.title}`}
                className="w-full h-full object-fill"
              />
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-950/85 text-white text-xs font-semibold backdrop-blur-md">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  Original Picture Preview
                </span>
                <span className="text-emerald-300 underline">Tap to hide</span>
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {status === 'paused' && (
            <div
              id="pause-overlay"
              className="absolute inset-0 z-40 rounded-2xl bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white animate-pop-in"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-3">
                <Play className="w-7 h-7 fill-current ml-0.5" />
              </div>
              <h3 className="font-display font-bold text-xl sm:text-2xl">Game Paused</h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xs">
                The timer is paused. Ready to jump back in and finish solving{' '}
                <strong className="text-white">{image.title}</strong>?
              </p>
              <button
                id="resume-overlay-btn"
                type="button"
                onClick={onResume}
                className="mt-5 min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm sm:text-base inline-flex items-center gap-2 shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Game</span>
              </button>
            </div>
          )}
        </div>

        {/* Helpful Micro-Interaction Hint Bar below the board */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 text-center px-2">
          <Hand className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {selectedTileId
              ? 'Tile selected! Tap any other tile to swap positions.'
              : 'Drag & drop any tile to swap, or tap two tiles in a row.'}
          </span>
        </div>
      </div>
    );
  }
);

PuzzleBoard.displayName = 'PuzzleBoard';
