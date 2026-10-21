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
} from 'lucide-react';
import { PuzzleImage, ScoreSubmissionResult } from '../types/puzzle';
import { calculateTimeScore, getScoringTierForTime } from '../shared/scoring';
import { formatTimeHuman, formatTimeMMSS } from '../utils/puzzleUtils';

interface VictoryDialogProps {
  isOpen: boolean;
  image: PuzzleImage;
  moves: number;
  elapsedSeconds: number;
  isNewRecord: boolean;
  scoreResult: ScoreSubmissionResult | null;
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
  const tierLabel = scoreResult
    ? scoreResult.tierLabel
    : getScoringTierForTime(finalSeconds).label;
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
      onCancel={(e) => {
        e.preventDefault();
        onPlayAgain();
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0 border border-slate-200 dark:border-slate-800 shadow-xl animate-pop-in"
    >
      {/* Top Celebration Banner */}
      <div className="relative bg-emerald-700 p-5 sm:p-6 text-center text-white overflow-hidden">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-800 mb-2.5">
          <Trophy className="w-8 h-8 text-amber-300" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
          {isNewRecord && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-sm">
              <Medal className="w-3.5 h-3.5" />
              New Personal Best!
            </span>
          )}
          {rankImproved && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-800 shadow-sm">
              <TrendingUp className="w-3.5 h-3.5" />
              Rank Up: #{previousRank} to #{globalRank}
            </span>
          )}
        </div>

        <h2 id="victory-title" className="font-display font-extrabold text-2xl sm:text-3xl">
          Puzzle Completed!
        </h2>
        <p className="text-sm text-emerald-50 mt-0.5">
          You reconstructed <strong>{image.title}</strong>
        </p>
      </div>

      {/* Points Earned & Completion Stats */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Highlighted Points Earned Banner */}
        <div className="rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              <Award className="w-4 h-4" />
              Points Earned
            </span>
            <span className="block text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Tier: {tierLabel}
            </span>
          </div>
          <div
            id="victory-points-earned"
            className="font-display font-extrabold text-2xl sm:text-3xl text-amber-600 dark:text-amber-400 tabular-nums shrink-0"
          >
            +{pointsEarned.toLocaleString()} pts
          </div>
        </div>

        {/* Completed Picture & Time/Moves Grid */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
          <img
            src={image.src}
            alt={`Completed puzzle: ${image.title}`}
            className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-500 shadow-md shrink-0"
          />
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Time Taken
              </span>
              <span
                id="victory-time-count"
                className="block font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums mt-0.5"
              >
                {formatTimeMMSS(finalSeconds)}
              </span>
              <span className="block text-[11px] text-slate-400">
                ({finalSeconds}s • {formatTimeHuman(finalSeconds)})
              </span>
            </div>

            <div>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Footprints className="w-3.5 h-3.5 text-emerald-500" />
                Total Moves
              </span>
              <span
                id="victory-moves-count"
                className="block font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums mt-0.5"
              >
                {moves}
              </span>
            </div>
          </div>
        </div>

        {/* Cumulative Leaderboard Summary */}
        <div className="rounded-2xl bg-slate-100/80 dark:bg-slate-800/90 px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-xs">
              Cumulative Total
            </span>
            <strong
              id="victory-cumulative-score"
              className="font-display font-extrabold text-base text-slate-900 dark:text-white tabular-nums"
            >
              {cumulativeScore.toLocaleString()} pts
            </strong>
          </div>

          {globalRank !== null && (
            <div className="text-right">
              <span className="text-slate-500 dark:text-slate-400 block text-xs">
                Global Rank
              </span>
              <strong
                id="victory-global-rank"
                className="font-display font-extrabold text-base text-emerald-600 dark:text-emerald-400 tabular-nums"
              >
                #{globalRank}
              </strong>
            </div>
          )}

          <button
            id="victory-open-leaderboard-btn"
            type="button"
            onClick={onOpenLeaderboard}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
          >
            Leaderboard
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            id="victory-next-puzzle-btn"
            type="button"
            onClick={onNextPuzzle}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span>Next Puzzle</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              id="victory-play-again-btn"
              type="button"
              onClick={onPlayAgain}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Play Again</span>
            </button>

            <button
              id="victory-gallery-btn"
              type="button"
              onClick={onChooseAnother}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Grid className="w-4 h-4" />
              <span>Choose Picture</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
