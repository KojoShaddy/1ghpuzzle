import React, { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Award,
  Clock,
  Footprints,
  Grid,
  Medal,
  RotateCcw,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { PuzzleImage, ScoreSubmissionResult } from '../types/puzzle';
import { calculateTimeScore } from '../shared/scoring';
import { formatTimeMMSS } from '../utils/puzzleUtils';

interface VictoryDialogProps {
  isOpen: boolean;
  image: PuzzleImage;
  moves: number;
  elapsedSeconds: number;
  isNewRecord: boolean;
  scoreResult: ScoreSubmissionResult | null;
  onClose: () => void;
  onPlayAgain: () => void;
  onNextPuzzle: () => void;
  onChooseAnother: () => void;
  onOpenLeaderboard: () => void;
}

export const VictoryDialog: React.FC<VictoryDialogProps> = ({
  isOpen,
  image,
  moves,
  elapsedSeconds,
  isNewRecord,
  scoreResult,
  onClose,
  onPlayAgain,
  onNextPuzzle,
  onChooseAnother,
  onOpenLeaderboard,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const finalSeconds = scoreResult ? scoreResult.elapsedSeconds : elapsedSeconds;
  const pointsEarned = scoreResult
    ? scoreResult.pointsAwarded
    : calculateTimeScore(finalSeconds);
  const cumulativeScore = scoreResult ? scoreResult.cumulativeScore : pointsEarned;
  const globalRank = scoreResult ? scoreResult.globalRank : null;
  const previousRank = scoreResult ? scoreResult.previousRank : null;
  const rankImproved =
    globalRank !== null && previousRank !== null && globalRank < previousRank;

  return (
    <dialog
      ref={dialogRef}
      id="victory-dialog"
      aria-labelledby="victory-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-sm rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-pop-in"
    >
      {/* Clean Celebration Header */}
      <div className="relative bg-emerald-700 px-5 py-6 text-center text-white">
        <button
          id="close-victory-x-btn"
          type="button"
          onClick={onClose}
          aria-label="Close puzzle completed dialog"
          className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl inline-flex items-center justify-center text-emerald-100 hover:text-white bg-emerald-800/60 hover:bg-emerald-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative inline-block mb-3">
          <img
            src={image.src}
            alt={`Completed puzzle: ${image.title}`}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-300 shadow-lg mx-auto"
          />
          <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
            <Trophy className="w-4 h-4" />
          </span>
        </div>

        {(isNewRecord || rankImproved) && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1.5">
            {isNewRecord && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950">
                <Medal className="w-3 h-3" />
                New Personal Best
              </span>
            )}
            {rankImproved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-emerald-800">
                <TrendingUp className="w-3 h-3" />
                Rank #{globalRank}
              </span>
            )}
          </div>
        )}

        <h2 id="victory-title" className="font-display font-extrabold text-xl sm:text-2xl">
          Puzzle Completed!
        </h2>
        <p className="text-xs sm:text-sm text-emerald-100 mt-0.5 truncate">
          {image.title}
        </p>
      </div>

      {/* Streamlined Stats & Actions */}
      <div className="p-5 space-y-4">
        {/* 3-Column Core Stats: Points, Time, Moves */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 p-2.5">
            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Award className="w-3 h-3" />
              Points
            </span>
            <div
              id="victory-points-earned"
              className="font-display font-extrabold text-base sm:text-lg text-amber-600 dark:text-amber-400 tabular-nums mt-0.5"
            >
              +{pointsEarned.toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 p-2.5">
            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 text-amber-500" />
              Time
            </span>
            <div
              id="victory-time-count"
              className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums mt-0.5"
            >
              {formatTimeMMSS(finalSeconds)}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60 p-2.5">
            <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Footprints className="w-3 h-3 text-emerald-500" />
              Moves
            </span>
            <div
              id="victory-moves-count"
              className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums mt-0.5"
            >
              {moves}
            </div>
          </div>
        </div>

        {/* Single Compact Total & Rank Row */}
        <div className="rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 px-3.5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span>
              Total:{' '}
              <strong
                id="victory-cumulative-score"
                className="font-display font-bold text-slate-900 dark:text-white tabular-nums"
              >
                {cumulativeScore.toLocaleString()} pts
              </strong>
            </span>
            {globalRank !== null && (
              <span>
                Rank:{' '}
                <strong
                  id="victory-global-rank"
                  className="font-display font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
                >
                  #{globalRank}
                </strong>
              </span>
            )}
          </div>

          <button
            id="victory-open-leaderboard-btn"
            type="button"
            onClick={onOpenLeaderboard}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Leaderboard
          </button>
        </div>

        {/* Clean Action Buttons */}
        <div className="space-y-2">
          <button
            id="victory-next-puzzle-btn"
            type="button"
            onClick={onNextPuzzle}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
          >
            <span>Next Puzzle</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              id="victory-play-again-btn"
              type="button"
              onClick={onPlayAgain}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Play Again</span>
            </button>

            <button
              id="victory-gallery-btn"
              type="button"
              onClick={onChooseAnother}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Gallery</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};

