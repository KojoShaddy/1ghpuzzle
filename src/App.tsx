import React, { useEffect, useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { UserPreferences } from './types/puzzle';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePuzzleGame } from './hooks/usePuzzleGame';
import { usePwaInstall } from './hooks/usePwaInstall';
import { GameHeader } from './components/GameHeader';
import { PlayerRegistration } from './components/PlayerRegistration';
import { PuzzleGallery } from './components/PuzzleGallery';
import { PuzzleBoard } from './components/PuzzleBoard';
import { GameStats } from './components/GameStats';
import { GameControls } from './components/GameControls';
import { GameLeaderboardPanel } from './components/GameLeaderboardPanel';
import { VictoryDialog } from './components/VictoryDialog';
import { RulesDialog } from './components/RulesDialog';
import { LeaderboardDialog } from './components/LeaderboardDialog';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  soundEnabled: true,
  showTileHints: false,
};

export const App: React.FC = () => {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    'ghana-puzzle-preferences-v1',
    DEFAULT_PREFERENCES
  );
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [showReferenceOverlay, setShowReferenceOverlay] = useState(false);
  const [isVictoryDismissed, setIsVictoryDismissed] = useState(false);

  const game = usePuzzleGame({
    soundEnabled: preferences.soundEnabled,
  });
  const pwa = usePwaInstall();

  // Sync dark/light class with document root
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  // Reset reference overlay and victory dialog dismissal when changing image or status
  useEffect(() => {
    setShowReferenceOverlay(false);
    if (game.status !== 'won') {
      setIsVictoryDismissed(false);
    }
  }, [game.selectedImage.id, game.status]);

  const handleToggleTheme = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, [setPreferences]);

  const handleToggleSound = useCallback(() => {
    setPreferences((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }));
  }, [setPreferences]);

  const handleToggleHints = useCallback(() => {
    // Tile hints are currently disabled
  }, []);

  const handleToggleReferenceOverlay = useCallback(() => {
    setShowReferenceOverlay((prev) => !prev);
  }, []);

  const handleReturnToGame = useCallback(() => {
    game.setScreen('game');
    game.resumeGame();
  }, [game]);

  const showWelcomeRegistration = game.screen === 'welcome' || !game.playerProfile;

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <GameHeader
        screen={showWelcomeRegistration ? 'welcome' : game.screen}
        hasActiveGame={game.status !== 'idle'}
        preferences={preferences}
        playerProfile={game.playerProfile}
        onlineCount={game.leaderboard.onlineCount}
        onNavigateGallery={game.goToGallery}
        onReturnToGame={handleReturnToGame}
        onEditProfile={game.openProfileEditor}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onToggleTheme={handleToggleTheme}
        onToggleSound={handleToggleSound}
        onToggleHints={handleToggleHints}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      {showWelcomeRegistration || !game.playerProfile ? (
        <div className="flex-1 flex flex-col justify-center">
          <PlayerRegistration
            initialProfile={game.playerProfile}
            onCompleteRegistration={game.registerPlayer}
          />
        </div>
      ) : game.screen === 'gallery' ? (
        <div className="flex-1">
          <PuzzleGallery
            selectedImage={game.selectedImage}
            bestScores={game.bestScores}
            playerProfile={game.playerProfile}
            onSelectImage={(img) => game.selectImage(img, false)}
            onStartGame={game.startGame}
            onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          />
        </div>
      ) : (
        <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
            {/* Mobile-first: Stats bar stays visible at top on mobile, and inside right column on desktop */}
            <div className="lg:hidden">
              <GameStats
                image={game.selectedImage}
                moves={game.moves}
                elapsedSeconds={game.elapsedSeconds}
                correctCount={game.correctCount}
                totalTiles={game.totalTiles}
                progressPercentage={game.progressPercentage}
                status={game.status}
                bestScore={game.currentBestScore}
                leaderboard={game.leaderboard}
              />
            </div>

            {/* Primary Puzzle Board Column */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center">
              <PuzzleBoard
                tiles={game.tiles}
                gridSize={game.gridSize}
                image={game.selectedImage}
                status={game.status}
                selectedTileId={game.selectedTileId}
                lastMovedTileIds={game.lastMovedTileIds}
                showTileHints={false}
                showReferenceOverlay={showReferenceOverlay}
                onSwapTiles={game.handleSwapTiles}
                onSelectOrSwapTile={game.handleSelectOrSwapTile}
                onResume={game.resumeGame}
                onToggleReferenceOverlay={handleToggleReferenceOverlay}
              />
            </div>

            {/* Sidebar: Stats (Desktop), Controls, and Leaderboard Frame */}
            <div className="lg:col-span-5 space-y-4">
              <div className="hidden lg:block">
                <GameStats
                  image={game.selectedImage}
                  moves={game.moves}
                  elapsedSeconds={game.elapsedSeconds}
                  correctCount={game.correctCount}
                  totalTiles={game.totalTiles}
                  progressPercentage={game.progressPercentage}
                  status={game.status}
                  bestScore={game.currentBestScore}
                  leaderboard={game.leaderboard}
                />
              </div>

              <GameControls
                status={game.status}
                showReferenceOverlay={showReferenceOverlay}
                onTogglePause={game.togglePause}
                onToggleReferenceOverlay={handleToggleReferenceOverlay}
                onNextPhoto={game.playNextImage}
              />

              <GameLeaderboardPanel
                leaderboard={game.leaderboard}
                onOpenFullLeaderboard={() => setIsLeaderboardOpen(true)}
              />
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/70 dark:border-slate-800/70 py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 flex-wrap">
        <span className="inline-flex items-center gap-1 flex-wrap justify-center">
          Built with <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" aria-label="love" />{' '}
          by{' '}
          <a
            id="footer-x-handle-link"
            href="https://x.com/kojo_shaddy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-500 transition-colors"
          >
            Kojo Shaddy
          </a>
          {!pwa.isInstalled && (
            <>
              <span className="mx-1 text-slate-400 dark:text-slate-600" aria-hidden="true">
                |
              </span>
              <a
                id="footer-install-app-link"
                href="#install-app"
                onClick={(e) => {
                  e.preventDefault();
                  pwa.triggerInstall();
                }}
                className="font-semibold text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-500 transition-colors cursor-pointer"
              >
                Install App
              </a>
            </>
          )}
        </span>
      </footer>

      {/* Victory Celebration Modal */}
      <VictoryDialog
        isOpen={game.status === 'won' && game.screen === 'game' && !isVictoryDismissed}
        image={game.selectedImage}
        moves={game.moves}
        elapsedSeconds={game.elapsedSeconds}
        isNewRecord={game.isNewRecord}
        scoreResult={game.lastScoreResult}
        onClose={() => setIsVictoryDismissed(true)}
        onPlayAgain={game.restartGame}
        onNextPuzzle={game.playNextImage}
        onChooseAnother={game.goToGallery}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
      />

      {/* Scoring Rules & Controls Modal */}
      <RulesDialog isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Global Leaderboard Modal */}
      <LeaderboardDialog
        isOpen={isLeaderboardOpen}
        leaderboard={game.leaderboard}
        onClose={() => setIsLeaderboardOpen(false)}
      />

      {/* PWA Installation Prompt Banner & Device Guide */}
      <PwaInstallPrompt
        showBanner={pwa.showInstallBanner}
        canPromptNatively={pwa.canPromptNatively}
        isIosDevice={pwa.isIosDevice}
        isAndroidDevice={pwa.isAndroidDevice}
        isGuideOpen={pwa.isInstallGuideOpen}
        onTriggerInstall={pwa.triggerInstall}
        onDismissBanner={pwa.dismissBanner}
        onCloseGuide={() => pwa.setIsInstallGuideOpen(false)}
      />
    </div>
  );
};

export default App;
