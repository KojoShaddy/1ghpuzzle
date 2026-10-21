import React, { useState } from 'react';
import { Check, ImageOff, Play, Trophy } from 'lucide-react';
import { BestScoreRecord, PuzzleImage } from '../types/puzzle';
import { calculateTimeScore } from '../shared/scoring';
import { formatTimeHuman } from '../utils/puzzleUtils';

interface PuzzleCardProps {
  image: PuzzleImage;
  isSelected: boolean;
  bestScore?: BestScoreRecord;
  onSelect: (image: PuzzleImage) => void;
  onPlayNow: (image: PuzzleImage) => void;
}

export const PuzzleCard: React.FC<PuzzleCardProps> = ({
  image,
  isSelected,
  bestScore,
  onSelect,
  onPlayNow,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const bestPoints = bestScore
    ? bestScore.points ?? calculateTimeScore(bestScore.timeSeconds)
    : null;

  return (
    <div
      onClick={() => onSelect(image)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(image);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Select ${image.title} puzzle`}
      id={`gallery-card-${image.id}`}
      className={`group relative flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isSelected
          ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-sm'
          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/70 hover:shadow-sm'
      }`}
    >
      {/* Square Thumbnail Container */}
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800" />
        )}

        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-400">
            <ImageOff className="w-8 h-8 mb-1.5" />
            <span className="text-xs font-medium">Image unavailable</span>
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900/75 text-white backdrop-blur-sm truncate">
            {image.category}
          </span>

          {isSelected && (
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </span>
          )}
        </div>

        {/* Best Score Badge */}
        {bestScore && bestPoints !== null && (
          <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/95 text-slate-950 shadow-sm backdrop-blur-sm">
            <Trophy className="w-3 h-3 shrink-0" />
            <span>
              {bestPoints.toLocaleString()} pts • {formatTimeHuman(bestScore.timeSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2 flex-1">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
            {image.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {image.subtitle}
          </p>
        </div>

        <button
          id={`play-card-${image.id}-btn`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlayNow(image);
          }}
          aria-label={`Play ${image.title} now`}
          className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="hidden xs:inline">Play</span>
        </button>
      </div>
    </div>
  );
};
