import React, { useState } from 'react';
import { ArrowRight, Flag, MapPin, User } from 'lucide-react';
import { GHANA_REGIONS } from '../data/puzzles';
import { PlayerProfile } from '../types/puzzle';

interface PlayerRegistrationProps {
  initialProfile: PlayerProfile | null;
  onCompleteRegistration: (name: string, region: string) => void;
}

export const PlayerRegistration: React.FC<PlayerRegistrationProps> = ({
  initialProfile,
  onCompleteRegistration,
}) => {
  const [name, setName] = useState<string>(initialProfile?.name ?? '');
  const [region, setRegion] = useState<string>(initialProfile?.region ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setErrorMessage('Please enter your name or nickname (at least 2 characters).');
      return;
    }

    if (!region) {
      setErrorMessage('Please select your region from the dropdown.');
      return;
    }

    setErrorMessage(null);
    onCompleteRegistration(trimmedName, region);
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
      <section
        aria-labelledby="welcome-heading"
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden animate-pop-in"
      >
        {/* Top Ghana Accent Banner */}
        <div className="bg-emerald-700 p-6 sm:p-7 text-center text-white">
          <img
            src={new URL('../../logo.png', import.meta.url).href}
            alt="1Ghana Image Puzzle Logo"
            className="w-16 h-16 mx-auto object-contain mb-3"
          />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-100 mb-2">
            <Flag className="w-3.5 h-3.5 text-amber-300" />
            <span>1Ghana Image Puzzle</span>
          </div>
          <h1
            id="welcome-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight"
          >
            Player Registration
          </h1>
          <p className="text-xs sm:text-sm text-emerald-50 mt-1">
            Enter your name or nickname and select your region to enter the game.
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5" noValidate>
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400"
            >
              {errorMessage}
            </div>
          )}

          {/* Name or Nickname Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="player-name-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
            >
              Name or Nickname
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="player-name-input"
                type="text"
                required
                maxLength={32}
                placeholder="e.g. Kojo Shaddy"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Region Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="player-region-select"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
            >
              Select Your Region
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="player-region-select"
                required
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="" disabled>
                  -- Choose a Region --
                </option>
                {GHANA_REGIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg} Region
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            id="enter-homepage-btn"
            type="submit"
            className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-display font-bold text-base shadow-sm inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
          >
            <span>Continue to Homepage</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </section>
    </main>
  );
};
