import React from 'react';
import {
  Eye,
  EyeOff,
  Grid,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Trophy,
} from 'lucide-react';
import { PUZZLE_IMAGES } from '../data/puzzles';
import { GameStatus, PuzzleImage } from '../types/puzzle';

interface GameControlsProps {
  status: GameStatus;
  selectedImage: PuzzleImage;
  showReferenceOverlay: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onToggleReferenceOverlay: () => void;
  onSelectImage: (image: PuzzleImage, startImmediately?: boolean) => void;
  onNextPhoto: () => void;
  onGoToGallery: () => void;
  onOpenRules: () => void;
  onOpenLeaderboard: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  status,
  selectedImage,
  showReferenceOverlay,
  onTogglePause,
  onRestart,
  onToggleReferenceOverlay,
  onSelectImage,
  onNextPhoto,
  onGoToGallery,
  onOpenRules,
  onOpenLeaderboard,
}) => {
  return (
    <section
      aria-label="Game Controls"
      className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-3 sm:p-4 space-y-4"
    >
      {/* Primary Action Buttons Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
        {/* Pause / Resume */}
        <button
          id="control-pause-btn"
          type="button"
          onClick={onTogglePause}
          disabled={status === 'won'}
          className={`min-h-[44px] px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            status === 'paused'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {status === 'paused' ? (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </>
          )}
        </button>

        {/* Restart Puzzle */}
        <button
          id="control-restart-btn"
          type="button"
          onClick={onRestart}
          className="min-h-[44px] px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restart</span>
        </button>

        {/* Reference Original Image Overlay Toggle */}
        <button
          id="control-preview-btn"
          type="button"
          onClick={onToggleReferenceOverlay}
          disabled={status !== 'playing'}
          aria-pressed={showReferenceOverlay}
          className={`min-h-[44px] px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:pointer-events-none ${
            showReferenceOverlay
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {showReferenceOverlay ? (
            <>
              <EyeOff className="w-4 h-4" />
              <span>Hide Target</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              <span>Peek Target</span>
            </>
          )}
        </button>

        {/* Another Photo */}
        <button
          id="control-next-photo-btn"
          type="button"
          onClick={onNextPhoto}
          className="min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Shuffle className="w-4 h-4" />
          <span>Another Photo</span>
        </button>
      </div>

      {/* Quick Picture Switcher Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="quick-picture-select"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Switch Picture
          </label>
          <button
            id="control-gallery-link-btn"
            type="button"
            onClick={onGoToGallery}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>All Pictures</span>
          </button>
        </div>

        <select
          id="quick-picture-select"
          value={selectedImage.id}
          onChange={(e) => {
            const found = PUZZLE_IMAGES.find((img) => img.id === e.target.value);
            if (found) onSelectImage(found, true);
          }}
          className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {PUZZLE_IMAGES.map((img) => (
            <option key={img.id} value={img.id}>
              {img.title} - {img.category}
            </option>
          ))}
        </select>
      </div>

      {/* Bottom Scoring Rules, Leaderboard & Gallery Links */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <button
          id="control-rules-btn"
          type="button"
          onClick={onOpenRules}
          className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Scoring Rules</span>
        </button>

        <button
          id="control-leaderboard-btn"
          type="button"
          onClick={onOpenLeaderboard}
          className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Trophy className="w-4 h-4" />
          <span>Full Leaderboard</span>
        </button>

        <button
          id="control-return-gallery-btn"
          type="button"
          onClick={onGoToGallery}
          className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Grid className="w-4 h-4" />
          <span>Gallery</span>
        </button>
      </div>
    </section>
  );
};
