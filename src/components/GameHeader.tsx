import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Grid,
  HelpCircle,
  Moon,
  Sun,
  User,
  UserPen,
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
  onlineCount?: number;
  onNavigateGallery: () => void;
  onReturnToGame: () => void;
  onEditProfile: () => void;
  onOpenLeaderboard?: () => void;
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
  onlineCount = 1,
  onNavigateGallery,
  onReturnToGame,
  onEditProfile,
  onOpenLeaderboard,
  onToggleTheme,
  onToggleSound,
  onToggleHints: _onToggleHints,
  onOpenRules,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

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
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <button
            id="header-brand-btn"
            type="button"
            onClick={playerProfile ? onNavigateGallery : undefined}
            className="group flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl p-1 -ml-1 min-w-0"
            aria-label="1Ghana Image Puzzle"
          >
            <img
              src="/logo.png"
              alt="1Ghana Image Puzzle Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0"
            />
            <div className="truncate min-w-0">
              <span className="block font-display font-bold text-sm sm:text-lg tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                1Ghana Image Puzzle
              </span>
            </div>
          </button>

          {/* Live Online Participant Count Pill */}
          <button
            id="header-online-count-btn"
            type="button"
            onClick={onOpenLeaderboard}
            title="Live Online Participants - Click to view Leaderboard"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span id="header-online-count-value">{Math.max(1, onlineCount)} Online</span>
          </button>
        </div>

        {/* Navigation & User Profile Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {playerProfile && screen === 'game' && (
            <button
              id="nav-gallery-btn"
              type="button"
              onClick={onNavigateGallery}
              className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 hover:bg-emerald-600/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Resume Board</span>
            </button>
          )}

          {/* User Profile & Settings Dropdown */}
          <div className="relative" ref={menuContainerRef}>
            <button
              id="header-player-btn"
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              title="Player Profile & Settings"
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
            >
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate max-w-[95px] sm:max-w-[140px]">
                {playerProfile ? playerProfile.name : 'Menu'}
              </span>
              {playerProfile && (
                <span className="hidden md:inline text-xs text-slate-400">
                  ({playerProfile.region})
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
                  isMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                aria-label="User Profile and Game Settings"
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-pop-in"
              >
                {playerProfile && (
                  <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {playerProfile.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {playerProfile.region} Region
                    </p>
                    {screen !== 'welcome' && (
                      <button
                        id="dropdown-edit-profile-btn"
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onEditProfile();
                        }}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <UserPen className="w-3.5 h-3.5" />
                        <span>Change Player / Region</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="py-1">
                  {/* Scoring Rules */}
                  <button
                    id="open-rules-btn"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenRules();
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Scoring Rules</span>
                    </span>
                    <span className="text-[11px] text-slate-400">View</span>
                  </button>

                  {/* Sound Settings */}
                  <button
                    id="toggle-sound-btn"
                    type="button"
                    role="menuitem"
                    onClick={onToggleSound}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      {preferences.soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span>Sound Settings</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        preferences.soundEnabled
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {preferences.soundEnabled ? 'On' : 'Off'}
                    </span>
                  </button>

                  {/* Display Mode */}
                  <button
                    id="toggle-theme-btn"
                    type="button"
                    role="menuitem"
                    onClick={onToggleTheme}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      {preferences.theme === 'dark' ? (
                        <Moon className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span>Display Mode</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {preferences.theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  {/* Tile Placement Hints (Disabled) */}
                  <button
                    id="toggle-hints-btn"
                    type="button"
                    role="menuitem"
                    disabled
                    aria-disabled="true"
                    title="Tile hints are disabled"
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed select-none"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Tile Hints</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Off
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

