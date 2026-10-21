import React, { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Clock,
  Hand,
  Keyboard,
  MousePointerClick,
  Trophy,
  X,
} from 'lucide-react';
import { SCORING_TIERS } from '../shared/scoring';

interface RulesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesDialog: React.FC<RulesDialogProps> = ({ isOpen, onClose }) => {
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

  return (
    <dialog
      ref={dialogRef}
      id="rules-dialog"
      aria-labelledby="rules-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0 border border-slate-200 dark:border-slate-800 shadow-xl animate-pop-in"
    >
      <div className="p-5 sm:p-6 space-y-6 max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2
              id="rules-dialog-title"
              className="font-display font-bold text-xl text-slate-900 dark:text-white"
            >
              Game &amp; Scoring Rules
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              How to solve puzzles and earn points on the Global Leaderboard.
            </p>
          </div>

          <button
            id="close-rules-x-btn"
            type="button"
            onClick={onClose}
            aria-label="Close rules dialog"
            className="min-w-[44px] min-h-[44px] rounded-xl inline-flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clearly Labelled Scoring Rules Section */}
        <section aria-labelledby="scoring-rules-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="scoring-rules-heading"
                className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white"
              >
                Scoring Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every completed puzzle awards points based on your actual completion time:
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table
              id="scoring-rules-table"
              className="w-full text-left border-collapse text-xs sm:text-sm"
            >
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3.5">Completion Time</th>
                  <th className="py-2.5 px-3.5 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {SCORING_TIERS.map((tier) => (
                  <tr
                    key={tier.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2 px-3.5 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{tier.label}</span>
                    </td>
                    <td className="py-2 px-3.5 text-right font-display font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {tier.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Points are awarded only when a puzzle is genuinely completed and are added to your
            cumulative Global Leaderboard score. Abandoned, incomplete, or restarted puzzles do not
            award points.
          </p>
        </section>

        {/* Controls Section */}
        <section aria-labelledby="controls-rules-heading" className="space-y-3">
          <h3
            id="controls-rules-heading"
            className="font-display font-bold text-base text-slate-900 dark:text-white"
          >
            How to Move Tiles
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <Hand className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Drag &amp; Drop
                </h4>
                <p className="text-xs mt-0.5">
                  Drag any tile onto another tile to swap their positions immediately.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <MousePointerClick className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Two-Tap Swap
                </h4>
                <p className="text-xs mt-0.5">
                  Tap once on a tile to select it, then tap a second tile to swap them.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <Keyboard className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Keyboard Navigation
                </h4>
                <p className="text-xs mt-0.5">
                  Use Arrow keys to navigate the grid and press Enter or Space to swap.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  Placement Hints
                </h4>
                <p className="text-xs mt-0.5">
                  Toggle the checkmark icon in the header to show indicators on aligned tiles.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            id="close-rules-done-btn"
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Got It, Let's Play!
          </button>
        </div>
      </div>
    </dialog>
  );
};
