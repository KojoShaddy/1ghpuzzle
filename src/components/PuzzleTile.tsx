import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check } from 'lucide-react';
import { PuzzleTileData } from '../types/puzzle';
import { getTileBackgroundStyle } from '../utils/puzzleUtils';

interface PuzzleTileProps {
  tile: PuzzleTileData;
  boardIndex: number;
  gridSize: number;
  imageSrc: string;
  isSelected: boolean;
  isRecentlyMoved: boolean;
  showHint: boolean;
  disabled: boolean;
  onSelectOrSwap: (tileId: string) => void;
  onKeyNavigate: (e: React.KeyboardEvent<HTMLButtonElement>, boardIndex: number) => void;
}

export const PuzzleTile: React.FC<PuzzleTileProps> = React.memo(
  ({
    tile,
    boardIndex,
    gridSize,
    imageSrc,
    isSelected,
    isRecentlyMoved,
    showHint,
    disabled,
    onSelectOrSwap,
    onKeyNavigate,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef: setDraggableRef,
      transform,
      isDragging,
    } = useDraggable({
      id: tile.id,
      disabled,
    });

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: tile.id,
      disabled,
    });

    const setCombinedRef = (node: HTMLButtonElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    };

    const isCorrectSpot = tile.correctIndex === boardIndex;
    const bgStyle = getTileBackgroundStyle(imageSrc, tile.correctIndex, gridSize);

    const style: React.CSSProperties = {
      ...bgStyle,
      transform: transform ? CSS.Translate.toString(transform) : undefined,
      zIndex: isDragging ? 40 : isOver || isSelected ? 20 : 1,
    };

    const row = Math.floor(boardIndex / gridSize) + 1;
    const col = (boardIndex % gridSize) + 1;

    return (
      <button
        ref={setCombinedRef}
        id={`puzzle-tile-pos-${boardIndex}`}
        data-tile-id={tile.id}
        data-correct-index={tile.correctIndex}
        data-board-index={boardIndex}
        type="button"
        disabled={disabled}
        onClick={() => onSelectOrSwap(tile.id)}
        onKeyDown={(e) => onKeyNavigate(e, boardIndex)}
        {...listeners}
        {...attributes}
        aria-label={`Row ${row} Column ${col}, Piece ${tile.correctIndex + 1}${
          isSelected ? ' (Selected to swap)' : ''
        }${showHint && isCorrectSpot ? ' (In correct spot)' : ''}`}
        aria-pressed={isSelected}
        style={style}
        className={`puzzle-tile-surface relative w-full h-full aspect-square m-0 p-0 border-0 rounded-none overflow-hidden bg-no-repeat transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
          isDragging
            ? 'opacity-40 ring-2 ring-inset ring-emerald-400 cursor-grabbing'
            : 'cursor-grab active:cursor-grabbing'
        } ${
          isOver && !isDragging
            ? 'ring-2 ring-inset ring-amber-400 brightness-110'
            : ''
        } ${
          isSelected && !isDragging
            ? 'ring-2 ring-inset ring-emerald-400 brightness-105'
            : ''
        } ${isRecentlyMoved ? 'animate-tile-pulse' : ''}`}
      >
        {/* Selected overlay highlight */}
        {isSelected && !isDragging && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-emerald-500/25 pointer-events-none"
          />
        )}

        {/* Drop target highlight overlay */}
        {isOver && !isDragging && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-amber-400/25 pointer-events-none"
          />
        )}

        {/* Optional Hint Indicator when tile is in its correct slot */}
        {showHint && isCorrectSpot && !isDragging && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-sm pointer-events-none"
          >
            <Check className="w-2 h-2 stroke-[3]" />
          </span>
        )}
      </button>
    );
  }
);

PuzzleTile.displayName = 'PuzzleTile';
