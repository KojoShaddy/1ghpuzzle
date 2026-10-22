import React from 'react';
import {
  Eye,
  EyeOff,
  Pause,
  Play,
  Shuffle,
} from 'lucide-react';
import { GameStatus } from '../types/puzzle';

interface GameControlsProps {
  status: GameStatus;
  showReferenceOverlay: boolean;
  onTogglePause: () => void;
  onToggleReferenceOverlay: () => void;
  onNextPhoto: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  status,
  showReferenceOverlay,
  onTogglePause,
  onToggleReferenceOverlay,
  onNextPhoto,
}) => {
  return (
    <section
      aria-label="Game Controls"
      className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-3 sm:p-3.5"
    >
      {/* Primary Action Buttons Row: Pause, Peek Target, Next Photo */}
      <div className="grid grid-cols-3 gap-2">
        {/* Pause / Resume */}
        <button
          id="control-pause-btn"
          type="button"
          onClick={onTogglePause}
          disabled={status === 'won'}
          className={`min-h-[42px] px-2.5 sm:px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            status === 'paused'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {status === 'paused' ? (
            <>
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span className="truncate">Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 shrink-0" />
              <span className="truncate">Pause</span>
            </>
          )}
        </button>

        {/* Reference Original Image Overlay Toggle */}
        <button
          id="control-preview-btn"
          type="button"
          onClick={onToggleReferenceOverlay}
          disabled={status !== 'playing'}
          aria-pressed={showReferenceOverlay}
          className={`min-h-[42px] px-2.5 sm:px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none ${
            showReferenceOverlay
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {showReferenceOverlay ? (
            <>
              <EyeOff className="w-4 h-4 shrink-0" />
              <span className="truncate">Hide Target</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 shrink-0" />
              <span className="truncate">Peek Target</span>
            </>
          )}
        </button>

        {/* Next Photo */}
        <button
          id="control-next-photo-btn"
          type="button"
          onClick={onNextPhoto}
          className="min-h-[42px] px-2.5 sm:px-3 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Shuffle className="w-4 h-4 shrink-0" />
          <span className="truncate">Next Photo</span>
        </button>
      </div>
    </section>
  );
};


