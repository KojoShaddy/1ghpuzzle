import React from 'react';
import { Award, CheckCircle2, Clock, Footprints, Trophy } from 'lucide-react';
import { BestScoreRecord, GameStatus, LeaderboardState, PuzzleImage } from '../types/puzzle';
import { calculateTimeScore } from '../shared/scoring';
import { formatTimeHuman, formatTimeMMSS } from '../utils/puzzleUtils';

interface GameStatsProps {
  image: PuzzleImage;
  moves: number;
  elapsedSeconds: number;
  correctCount: number;
  totalTiles: number;
  progressPercentage: number;
  status: GameStatus;
  bestScore?: BestScoreRecord;
  leaderboard: LeaderboardState;
}

export const GameStats: React.FC<GameStatsProps> = ({
  image,
  moves,
  elapsedSeconds,
  correctCount,
  totalTiles,
  progressPercentage,
  status,
  bestScore,
  leaderboard,
}) => {
  const currentPotentialPoints = calculateTimeScore(elapsedSeconds);
  const { playerEntry } = leaderboard;

  return (
    <section
      aria-label="Game Statistics"
      className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-3 sm:p-4 space-y-3"
    >
      {/* Top Row: Image Title & Player Global Rank */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <img
            src={image.src}
            alt=""
            aria-hidden="true"
            className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="min-w-0">
            <h1
              id="active-puzzle-title"
              className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate"
            >
              {image.title}
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {image.category}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Global Rank #{playerEntry.rank}
          </span>
          <span className="font-display font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
            {playerEntry.cumulativeScore.toLocaleString()} pts
          </span>
        </div>
      </div>

      {/* Key Metrics Grid: Moves, Time, Potential Points, Aligned */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {/* Moves Counter */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Footprints className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Moves</span>
          </div>
          <div
            id="stat-moves-value"
            aria-live="polite"
            className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums mt-0.5"
          >
            {moves}
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">{status === 'paused' ? 'Paused' : 'Time'}</span>
          </div>
          <div
            id="stat-time-value"
            className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums mt-0.5"
          >
            {formatTimeMMSS(elapsedSeconds)}
          </div>
        </div>

        {/* Current Tier Points */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Award className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">Tier Pts</span>
          </div>
          <div
            id="stat-tier-points-value"
            className="font-display font-extrabold text-base sm:text-lg text-amber-600 dark:text-amber-400 tabular-nums mt-0.5"
          >
            {currentPotentialPoints.toLocaleString()}
          </div>
        </div>

        {/* Aligned Tiles Progress */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 border border-slate-200/60 dark:border-slate-700/50">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-teal-500 shrink-0" />
            <span className="truncate">Aligned</span>
          </div>
          <div
            id="stat-progress-value"
            className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tabular-nums mt-0.5"
          >
            {correctCount}/{totalTiles}
          </div>
        </div>
      </div>

      {/* Progress Bar & Best Score Footer */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            Board Completion: <strong>{progressPercentage}%</strong>
          </span>
          {bestScore ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Trophy className="w-3.5 h-3.5" />
              Best: {bestScore.points?.toLocaleString() ?? calculateTimeScore(bestScore.timeSeconds).toLocaleString()} pts ({formatTimeHuman(bestScore.timeSeconds)})
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">No record set yet</span>
          )}
        </div>

        <div
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Puzzle completion progress"
          className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
        >
          <div
            style={{ width: `${progressPercentage}%` }}
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
          />
        </div>
      </div>
    </section>
  );
};
