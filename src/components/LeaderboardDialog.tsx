import React, { useEffect, useRef } from 'react';
import { Award, Crown, Medal, Trophy, User, X } from 'lucide-react';
import { LeaderboardState } from '../types/puzzle';
import { formatTimeHuman } from '../utils/puzzleUtils';

interface LeaderboardDialogProps {
  isOpen: boolean;
  leaderboard: LeaderboardState;
  onClose: () => void;
}

export const LeaderboardDialog: React.FC<LeaderboardDialogProps> = ({
  isOpen,
  leaderboard,
  onClose,
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

  const { playerEntry, totalPlayers, entries } = leaderboard;

  return (
    <dialog
      ref={dialogRef}
      id="leaderboard-dialog"
      aria-labelledby="leaderboard-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-2xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0 border border-slate-200 dark:border-slate-800 shadow-xl animate-pop-in"
    >
      <div className="p-5 sm:p-6 space-y-5 max-h-[88dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="leaderboard-dialog-title"
                className="font-display font-bold text-xl text-slate-900 dark:text-white"
              >
                Global Leaderboard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cumulative points and global rankings across all completed puzzles
              </p>
            </div>
          </div>

          <button
            id="close-leaderboard-x-btn"
            type="button"
            onClick={onClose}
            aria-label="Close global leaderboard"
            className="min-w-[44px] min-h-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player's Current Standing Summary Banner */}
        <div className="rounded-2xl bg-emerald-700 p-4 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-100">
                <User className="w-3.5 h-3.5" />
                {playerEntry.playerName} - {playerEntry.region} Region
              </span>
              <div className="font-display font-extrabold text-2xl sm:text-3xl mt-0.5">
                Rank <span id="leaderboard-player-rank">#{playerEntry.rank}</span>{' '}
                <span className="text-sm font-medium text-emerald-100">
                  of {totalPlayers}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="block text-xs text-emerald-100">Cumulative Score</span>
                <span
                  id="leaderboard-player-total-score"
                  className="font-display font-extrabold text-xl sm:text-2xl tabular-nums"
                >
                  {playerEntry.cumulativeScore.toLocaleString()} pts
                </span>
              </div>

              <div className="text-right border-l border-white/20 pl-4">
                <span className="block text-xs text-emerald-100">Solved</span>
                <span className="font-display font-extrabold text-xl sm:text-2xl tabular-nums">
                  {playerEntry.puzzlesSolved}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Standings Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 sm:px-4">Rank</th>
                <th className="py-2.5 px-3 sm:px-4">Player</th>
                <th className="py-2.5 px-3 sm:px-4">Region</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Solved</th>
                <th className="py-2.5 px-3 sm:px-4 text-right hidden xs:table-cell">Best Time</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Total Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
              {entries.map((entry) => {
                const isYou = entry.playerId === playerEntry.playerId;
                return (
                  <tr
                    key={entry.playerId}
                    className={
                      isYou
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 font-semibold'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }
                  >
                    <td className="py-2.5 px-3 sm:px-4 tabular-nums">
                      <span className="inline-flex items-center gap-1.5 font-display font-bold">
                        {entry.rank === 1 ? (
                          <Crown className="w-4 h-4 text-amber-500" />
                        ) : entry.rank === 2 ? (
                          <Medal className="w-4 h-4 text-slate-400" />
                        ) : entry.rank === 3 ? (
                          <Award className="w-4 h-4 text-amber-700 dark:text-amber-600" />
                        ) : null}
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:px-4">
                      <span className="text-slate-900 dark:text-white">
                        {entry.playerName}
                      </span>
                      {isYou && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-600 text-white">
                          You
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-600 dark:text-slate-300">
                      {entry.region}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right tabular-nums text-slate-600 dark:text-slate-300">
                      {entry.puzzlesSolved}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right tabular-nums text-slate-600 dark:text-slate-300 hidden xs:table-cell">
                      {entry.bestTimeSeconds !== null
                        ? formatTimeHuman(entry.bestTimeSeconds)
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right font-display font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {entry.cumulativeScore.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            id="close-leaderboard-done-btn"
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
};
