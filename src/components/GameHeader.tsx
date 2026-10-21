import React from 'react';
import {
  CheckCircle2,
  Grid,
  HelpCircle,
  Moon,
  Sun,
  User,
  Volume2,
  VolumeX,
  Gamepad2,
} from 'lucide-react';
import { ActiveScreen, PlayerProfile, UserPreferences } from '../types/puzzle';

interface GameHeaderProps {
  screen: ActiveScreen;
  hasActiveGame: boolean;
  playerProfile: PlayerProfile | null;
  preferences: UserPreferences;
  onNavigateGallery: () => void;
  onReturnToGame: () => void;
  onEditProfile: () => void;
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onToggleHints: () => void;
  onOpenRules: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  screen,
  hasActiveGame,
  playerProfile,
  preferences,
  onNavigateGallery,
  onReturnToGame,
  onEditProfile,
  onToggleTheme,
  onToggleSound,
  onToggleHints,
  onOpenRules,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Subtle Ghana Flag Heritage Accent Strip */}
      <div className="h-1 w-full flex" aria-hidden="true">
        <div className="flex-1 bg-ghana-red" />
        <div className="flex-1 bg-ghana-gold" />
        <div className="flex-1 bg-ghana-green" />
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand / Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            id="header-brand-btn"
            type="button"
            onClick={playerProfile ? onNavigateGallery : undefined}
            className="group flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl p-1 -ml-1"
            aria-label="1Ghana Image Puzzle"
          >
            <img
              src="/logo.png"
              alt="1Ghana Image Puzzle Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
            />
            <div className="truncate">
              <span className="block font-display font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                1Ghana Image Puzzle
              </span>
            </div>
          </button>
        </div>

        {/* Navigation & Quick Settings */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {playerProfile && screen === 'game' && (
            <button
              id="nav-gallery-btn"
              type="button"
              onClick={onNavigateGallery}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Grid className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Gallery</span>
            </button>
          )}

          {playerProfile && screen === 'gallery' && hasActiveGame && (
            <button
              id="nav-resume-game-btn"
              type="button"
              onClick={onReturnToGame}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-600/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Resume Board</span>
            </button>
          )}

          {playerProfile && screen !== 'welcome' && (
            <button
              id="header-player-btn"
              type="button"
              onClick={onEditProfile}
              title="Change Player or Region"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate max-w-[110px]">{playerProfile.name}</span>
              <span className="hidden md:inline text-slate-400">
                ({playerProfile.region})
              </span>
            </button>
          )}

          {/* Scoring Rules Dialog Trigger */}
          <button
            id="open-rules-btn"
            type="button"
            onClick={onOpenRules}
            aria-label="Scoring Rules and How to Play"
            title="Scoring Rules"
            className="inline-flex items-center gap-1 min-w-[44px] min-h-[44px] px-2 sm:px-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <HelpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden md:inline">Scoring Rules</span>
          </button>

          {/* Tile Placement Hints Toggle */}
          <button
            id="toggle-hints-btn"
            type="button"
            onClick={onToggleHints}
            aria-pressed={preferences.showTileHints}
            aria-label={
              preferences.showTileHints
                ? 'Disable correct tile indicators'
                : 'Enable correct tile indicators'
            }
            title={
              preferences.showTileHints
                ? 'Tile placement indicators: ON'
                : 'Tile placement indicators: OFF'
            }
            className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              preferences.showTileHints
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>

          {/* Sound Effects Toggle */}
          <button
            id="toggle-sound-btn"
            type="button"
            onClick={onToggleSound}
            aria-pressed={preferences.soundEnabled}
            aria-label={preferences.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            title={preferences.soundEnabled ? 'Sound effects: ON' : 'Sound effects: OFF'}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {preferences.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {/* Theme Toggle */}
          <button
            id="toggle-theme-btn"
            type="button"
            onClick={onToggleTheme}
            aria-label={
              preferences.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
            }
            title={preferences.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {preferences.theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
