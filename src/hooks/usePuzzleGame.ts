import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ActiveScreen,
  BestScoreRecord,
  BestScoresMap,
  GameStatus,
  LeaderboardState,
  PlayerProfile,
  PuzzleImage,
  PuzzleTileData,
  ScoreSubmissionResult,
} from '../types/puzzle';
import { DEFAULT_GRID_SIZE, PUZZLE_IMAGES } from '../data/puzzles';
import {
  calculateProgressPercentage,
  countCorrectTiles,
  createShuffledTiles,
  getScoreKey,
  isPuzzleSolved,
  swapTilesById,
} from '../utils/puzzleUtils';
import {
  calculateTimeScore,
  computeRankedLeaderboard,
  getScoringTierForTime,
} from '../shared/scoring';
import {
  abandonServerPuzzleSession,
  completeServerPuzzleSession,
  fetchGlobalLeaderboard,
  getOrCreatePlayerId,
  pauseServerPuzzleSession,
  registerPlayerProfile,
  resumeServerPuzzleSession,
  startServerPuzzleSession,
} from '../utils/scoringService';
import { useGameTimer } from './useGameTimer';
import { useLocalStorage } from './useLocalStorage';
import { soundFX } from '../utils/sound';

interface UsePuzzleGameProps {
  soundEnabled: boolean;
}

export function usePuzzleGame({ soundEnabled }: UsePuzzleGameProps) {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerProfile, setPlayerProfile] = useLocalStorage<PlayerProfile | null>(
    'ghana-puzzle-player-profile-v3',
    null
  );

  const [screen, setScreen] = useState<ActiveScreen>(() =>
    playerProfile && playerProfile.name.trim() && playerProfile.region.trim()
      ? 'gallery'
      : 'welcome'
  );
  const [selectedImage, setSelectedImage] = useState<PuzzleImage>(PUZZLE_IMAGES[0]);
  const [tiles, setTiles] = useState<PuzzleTileData[]>(() =>
    createShuffledTiles(DEFAULT_GRID_SIZE)
  );
  const [moves, setMoves] = useState<number>(0);
  const [status, setStatus] = useState<GameStatus>('idle');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [lastMovedTileIds, setLastMovedTileIds] = useState<[string, string] | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  const activeProfile = useMemo<PlayerProfile>(
    () =>
      playerProfile ?? {
        playerId,
        name: 'Player',
        region: 'Greater Accra',
      },
    [playerProfile, playerId]
  );

  const [leaderboard, setLeaderboard] = useState<LeaderboardState>(() =>
    computeRankedLeaderboard(
      [],
      activeProfile.playerId,
      activeProfile.name,
      activeProfile.region
    )
  );
  const [lastScoreResult, setLastScoreResult] = useState<ScoreSubmissionResult | null>(null);

  const [bestScores, setBestScores] = useLocalStorage<BestScoresMap>(
    'ghana-puzzle-best-scores-v3',
    {}
  );

  const {
    elapsedSeconds,
    resetTimer,
    setAuthoritativeSeconds,
    getMonotonicElapsedSeconds,
  } = useGameTimer(status);

  const sessionIdRef = useRef<string | null>(null);
  const submittedSessionIdsRef = useRef<Set<string>>(new Set());

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Load global leaderboard whenever a registered player profile is available
  useEffect(() => {
    if (!playerProfile) return;
    let active = true;
    fetchGlobalLeaderboard(playerProfile).then((state) => {
      if (active) setLeaderboard(state);
    });
    return () => {
      active = false;
    };
  }, [playerProfile]);

  /**
   * Registers or updates the player's Name/Nickname and Region, then opens the homepage gallery.
   */
  const registerPlayer = useCallback(
    (name: string, region: string) => {
      const updatedProfile: PlayerProfile = {
        playerId,
        name: name.trim(),
        region: region.trim(),
      };
      setPlayerProfile(updatedProfile);
      setScreen('gallery');

      void registerPlayerProfile(updatedProfile).then((latestLeaderboard) => {
        setLeaderboard(latestLeaderboard);
      });
    },
    [playerId, setPlayerProfile]
  );

  /**
   * Opens the welcome/registration page so the player can change their name or region.
   */
  const openProfileEditor = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'playing') {
        void pauseServerPuzzleSession(sessionIdRef.current);
        return 'paused';
      }
      return prev;
    });
    setSelectedTileId(null);
    setScreen('welcome');
  }, []);

  /**
   * Starts a fresh server-tracked puzzle session and resets monotonic timer.
   */
  const beginSessionForImage = useCallback(
    (image: PuzzleImage) => {
      // Abandon any prior active session so it cannot award points
      if (sessionIdRef.current && status !== 'won') {
        void abandonServerPuzzleSession(sessionIdRef.current);
      }

      setSelectedImage(image);
      setTiles(createShuffledTiles(DEFAULT_GRID_SIZE));
      setMoves(0);
      setSelectedTileId(null);
      setLastMovedTileIds(null);
      setIsNewRecord(false);
      setLastScoreResult(null);
      resetTimer();
      setStatus('playing');
      setScreen('game');

      void startServerPuzzleSession({
        profile: activeProfile,
        imageId: image.id,
        gridSize: DEFAULT_GRID_SIZE,
      }).then(({ sessionId, leaderboard: latestLeaderboard }) => {
        sessionIdRef.current = sessionId;
        setLeaderboard(latestLeaderboard);
      });
    },
    [activeProfile, resetTimer, status]
  );

  /**
   * Starts or restarts a puzzle session with the specified image.
   */
  const startGame = useCallback(
    (image: PuzzleImage = selectedImage) => {
      beginSessionForImage(image);
    },
    [selectedImage, beginSessionForImage]
  );

  /**
   * Restarts the current puzzle with a fresh shuffle and new server session.
   */
  const restartGame = useCallback(() => {
    beginSessionForImage(selectedImage);
  }, [selectedImage, beginSessionForImage]);

  /**
   * Changes the active image and starts a fresh puzzle immediately if in-game,
   * or updates selection in the gallery.
   */
  const selectImage = useCallback(
    (image: PuzzleImage, startImmediately = false) => {
      setSelectedImage(image);
      if (startImmediately || screen === 'game') {
        beginSessionForImage(image);
      }
    },
    [screen, beginSessionForImage]
  );

  /**
   * Picks the next image in the collection and starts a new game.
   */
  const playNextImage = useCallback(() => {
    const currentIndex = PUZZLE_IMAGES.findIndex((img) => img.id === selectedImage.id);
    const nextImage = PUZZLE_IMAGES[(currentIndex + 1) % PUZZLE_IMAGES.length];
    beginSessionForImage(nextImage);
  }, [selectedImage.id, beginSessionForImage]);

  /**
   * Pauses or resumes the active game and notifies the backend session clock.
   */
  const togglePause = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'playing') {
        void pauseServerPuzzleSession(sessionIdRef.current);
        return 'paused';
      }
      if (prev === 'paused') {
        void resumeServerPuzzleSession(sessionIdRef.current);
        return 'playing';
      }
      return prev;
    });
    setSelectedTileId(null);
  }, []);

  const resumeGame = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'paused') {
        void resumeServerPuzzleSession(sessionIdRef.current);
        return 'playing';
      }
      return prev;
    });
  }, []);

  /**
   * Navigates back to the gallery screen and pauses any active game.
   */
  const goToGallery = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'playing') {
        void pauseServerPuzzleSession(sessionIdRef.current);
        return 'paused';
      }
      return prev;
    });
    setSelectedTileId(null);
    setScreen(playerProfile ? 'gallery' : 'welcome');
  }, [playerProfile]);

  /**
   * Swaps two tiles on the board and checks for puzzle completion.
   */
  const handleSwapTiles = useCallback(
    (firstTileId: string, secondTileId: string) => {
      if (status !== 'playing') return;
      if (firstTileId === secondTileId) return;

      setTiles((prevTiles) => {
        const { nextTiles, didSwap } = swapTilesById(prevTiles, firstTileId, secondTileId);
        if (!didSwap) return prevTiles;

        const nextMoves = moves + 1;
        setMoves(nextMoves);
        setSelectedTileId(null);
        setLastMovedTileIds([firstTileId, secondTileId]);

        const solved = isPuzzleSolved(nextTiles);
        if (solved) {
          setStatus('won');
          soundFX.playVictory(soundEnabledRef.current);

          const monotonicSecs = Math.max(1, getMonotonicElapsedSeconds());
          const immediatePoints = calculateTimeScore(monotonicSecs);
          const immediateTier = getScoringTierForTime(monotonicSecs);
          const activeSessionId =
            sessionIdRef.current ?? `session-${Date.now()}-${selectedImage.id}`;
          sessionIdRef.current = activeSessionId;

          // Prevent duplicate submissions for the same completed puzzle session
          if (!submittedSessionIdsRef.current.has(activeSessionId)) {
            submittedSessionIdsRef.current.add(activeSessionId);

            // Set immediate optimistic display from the single authoritative scoring function,
            // then reconcile with the trusted backend response
            setAuthoritativeSeconds(monotonicSecs);
            setLastScoreResult({
              sessionId: activeSessionId,
              elapsedSeconds: monotonicSecs,
              pointsAwarded: immediatePoints,
              tierLabel: immediateTier.label,
              cumulativeScore: leaderboard.playerEntry.cumulativeScore + immediatePoints,
              globalRank: leaderboard.playerEntry.rank,
              previousRank:
                leaderboard.playerEntry.puzzlesSolved > 0
                  ? leaderboard.playerEntry.rank
                  : null,
              totalPlayers: leaderboard.totalPlayers,
              alreadyAwarded: false,
              leaderboard,
            });

            void completeServerPuzzleSession({
              sessionId: activeSessionId,
              profile: activeProfile,
              imageId: selectedImage.id,
              gridSize: DEFAULT_GRID_SIZE,
              finalTiles: nextTiles,
              moves: nextMoves,
              monotonicElapsedSeconds: monotonicSecs,
            }).then((serverResult) => {
              // Ensure displayed time and points always match the authoritative backend record
              setAuthoritativeSeconds(serverResult.elapsedSeconds);
              setLastScoreResult(serverResult);
              setLeaderboard(serverResult.leaderboard);

              const key = getScoreKey(selectedImage.id);
              setBestScores((prevScores) => {
                const existing = prevScores[key];
                const isBetter =
                  !existing ||
                  serverResult.pointsAwarded > existing.points ||
                  (serverResult.pointsAwarded === existing.points &&
                    serverResult.elapsedSeconds < existing.timeSeconds);

                if (isBetter) {
                  setIsNewRecord(true);
                  const updatedRecord: BestScoreRecord = {
                    moves: nextMoves,
                    timeSeconds: serverResult.elapsedSeconds,
                    points: serverResult.pointsAwarded,
                    achievedAt: new Date().toISOString(),
                  };
                  return { ...prevScores, [key]: updatedRecord };
                }
                return prevScores;
              });
            });
          }
        } else {
          // Check if either swapped tile landed in its correct home slot
          const swappedA = nextTiles.find((t) => t.id === firstTileId);
          const swappedB = nextTiles.find((t) => t.id === secondTileId);
          const landedCorrect = Boolean(
            (swappedA && swappedA.correctIndex === swappedA.currentIndex) ||
              (swappedB && swappedB.correctIndex === swappedB.currentIndex)
          );
          soundFX.playSwap(soundEnabledRef.current, landedCorrect);
        }

        return nextTiles;
      });
    },
    [
      status,
      moves,
      selectedImage.id,
      activeProfile,
      leaderboard,
      getMonotonicElapsedSeconds,
      setAuthoritativeSeconds,
      setBestScores,
    ]
  );

  /**
   * Handles tap-to-select / tap-to-swap interaction (for mobile tap or keyboard Enter/Space).
   */
  const handleSelectOrSwapTile = useCallback(
    (tileId: string) => {
      if (status !== 'playing') return;

      if (!selectedTileId) {
        setSelectedTileId(tileId);
        soundFX.playSelect(soundEnabledRef.current);
      } else if (selectedTileId === tileId) {
        setSelectedTileId(null);
      } else {
        handleSwapTiles(selectedTileId, tileId);
      }
    },
    [status, selectedTileId, handleSwapTiles]
  );

  // Clear highlight animation after 350ms
  useEffect(() => {
    if (!lastMovedTileIds) return;
    const timer = window.setTimeout(() => {
      setLastMovedTileIds(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [lastMovedTileIds]);

  const correctCount = countCorrectTiles(tiles);
  const progressPercentage = calculateProgressPercentage(tiles);
  const currentBestScore: BestScoreRecord | undefined =
    bestScores[getScoreKey(selectedImage.id)];

  return {
    playerId,
    playerProfile,
    registerPlayer,
    openProfileEditor,
    screen,
    setScreen,
    selectedImage,
    gridSize: DEFAULT_GRID_SIZE,
    tiles,
    moves,
    elapsedSeconds,
    status,
    selectedTileId,
    setSelectedTileId,
    lastMovedTileIds,
    correctCount,
    totalTiles: DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE,
    progressPercentage,
    bestScores,
    currentBestScore,
    isNewRecord,
    leaderboard,
    lastScoreResult,
    startGame,
    restartGame,
    selectImage,
    playNextImage,
    togglePause,
    resumeGame,
    goToGallery,
    handleSwapTiles,
    handleSelectOrSwapTile,
  };
}
