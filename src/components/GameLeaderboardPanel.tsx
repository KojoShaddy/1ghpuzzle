import React from 'react';
import { Award, Crown, Medal, Trophy } from 'lucide-react';
import { LeaderboardState } from '../types/puzzle';

interface GameLeaderboardPanelProps {
  leaderboard: LeaderboardState;
  onOpenFullLeaderboard: () => void;
}

export const GameLeaderboardPanel: React.FC<GameLeaderboardPanelProps> = ({
  leaderboard,
  onOpenFullLeaderboard,
}) => {
  const { playerEntry, entries, onlineCount = 1 } = leaderboard;

  return (
    <section
      id="game-sidebar-leaderboard"
      aria-labelledby="game-leaderboard-heading"
      className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm p-3 sm:p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="game-leaderboard-heading"
                className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight"
              >
                Leaderboard
              </h2>
              <span
                id="sidebar-online-badge"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live • {Math.max(1, onlineCount)} Online
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rank #{playerEntry.rank} of {entries.length} •{' '}
              {playerEntry.cumulativeScore.toLocaleString()} pts
            </p>
          </div>
        </div>

        <button
          id="sidebar-expand-leaderboard-btn"
          type="button"
          onClick={onOpenFullLeaderboard}
          className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          View All ({entries.length})
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Complete a puzzle to record the first score on the leaderboard.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[260px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-2.5">Rank</th>
                <th className="py-2 px-2.5">Player</th>
                <th className="py-2 px-2.5">Region</th>
                <th className="py-2 px-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry) => {
                const isYou = entry.playerId === playerEntry.playerId;
                return (
                  <tr
                    key={entry.playerId}
                    className={
                      isYou
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 font-semibold'
                        : ''
                    }
                  >
                    <td className="py-2 px-2.5 font-display font-bold tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {entry.rank === 1 ? (
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                        ) : entry.rank === 2 ? (
                          <Medal className="w-3.5 h-3.5 text-slate-400" />
                        ) : entry.rank === 3 ? (
                          <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-600" />
                        ) : null}
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 truncate max-w-[120px]">
                      <span className="text-slate-900 dark:text-white">
                        {entry.playerName}
                      </span>
                      {isYou && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-600 text-white">
                          You
                        </span>
                      )}
                      {entry.isPlaying && !isYou && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Playing
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 truncate max-w-[90px] text-slate-500 dark:text-slate-400">
                      {entry.region}
                    </td>
                    <td className="py-2 px-2.5 text-right font-display font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {entry.cumulativeScore.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
