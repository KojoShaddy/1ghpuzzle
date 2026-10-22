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
  createPlayerIdFromProfile,
  fetchGlobalLeaderboard,
  getOrCreatePlayerId,
  pauseServerPuzzleSession,
  registerPlayerProfile,
  resumeServerPuzzleSession,
  startServerPuzzleSession,
  subscribeToLiveLeaderboard,
} from '../utils/scoringService';
import { useGameTimer } from './useGameTimer';
import { useLocalStorage } from './useLocalStorage';
import { soundFX } from '../utils/sound';

interface UsePuzzleGameProps {
  soundEnabled: boolean;
}

export function usePuzzleGame({ soundEnabled }: UsePuzzleGameProps) {
  const [fallbackPlayerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerProfile, setPlayerProfile] = useLocalStorage<PlayerProfile | null>(
    'ghana-puzzle-player-profile-v4',
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
        playerId: fallbackPlayerId,
        name: 'Player',
        region: 'Greater Accra',
      },
    [playerProfile, fallbackPlayerId]
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
    'ghana-puzzle-best-scores-v4',
    {}
  );

  const {
    elapsedSeconds,
    resetTimer,
    setAuthoritativeSeconds,
    getMonotonicElapsedSeconds,
  } = useGameTimer(status);

  const tilesRef = useRef<PuzzleTileData[]>(tiles);
  tilesRef.current = tiles;

  const movesRef = useRef<number>(moves);
  movesRef.current = moves;

  const statusRef = useRef<GameStatus>(status);
  statusRef.current = status;

  const sessionIdRef = useRef<string | null>(null);
  const startSessionPromiseRef = useRef<Promise<string> | null>(null);
  const submittedSessionIdsRef = useRef<Set<string>>(new Set());

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Keep global leaderboard synchronized in real time across the session
  useEffect(() => {
    let active = true;
    const profileToQuery: PlayerProfile = playerProfile ?? {
      playerId: fallbackPlayerId,
      name: 'Player',
      region: 'Greater Accra',
    };

    const refreshLeaderboard = () => {
      fetchGlobalLeaderboard(profileToQuery).then((state) => {
        if (!active) return;
        setLeaderboard(state);
      });
    };

    // If a returning participant already has a registered profile, announce them to the live session immediately
    if (playerProfile && playerProfile.name.trim().length >= 2) {
      void registerPlayerProfile(playerProfile).then((state) => {
        if (!active) return;
        setLeaderboard(state);
      });
    } else {
      refreshLeaderboard();
    }

    const unsubscribe = subscribeToLiveLeaderboard(refreshLeaderboard);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [playerProfile, fallbackPlayerId]);

  /**
   * Registers or switches to a player's Name/Nickname and Region without overwriting other session players.
   */
  const registerPlayer = useCallback(
    (name: string, region: string) => {
      const cleanName = name.trim();
      const cleanRegion = region.trim();
      const candidatePlayerId = createPlayerIdFromProfile(cleanName, cleanRegion);

      // Abandon any active puzzle session belonging to the previous player before switching
      if (sessionIdRef.current && statusRef.current !== 'won') {
        void abandonServerPuzzleSession(sessionIdRef.current, activeProfile);
        sessionIdRef.current = null;
      }
      setStatus('idle');
      setSelectedTileId(null);

      const updatedProfile: PlayerProfile = {
        playerId: candidatePlayerId,
        name: cleanName,
        region: cleanRegion,
      };
      setPlayerProfile(updatedProfile);
      setScreen('gallery');

      void registerPlayerProfile(updatedProfile).then((latestLeaderboard) => {
        setLeaderboard(latestLeaderboard);
        if (
          latestLeaderboard.playerEntry.playerId &&
          latestLeaderboard.playerEntry.playerId !== candidatePlayerId
        ) {
          setPlayerProfile({
            playerId: latestLeaderboard.playerEntry.playerId,
            name: cleanName,
            region: cleanRegion,
          });
        }
      });
    },
    [setPlayerProfile, activeProfile]
  );

  /**
   * Opens the welcome/registration page so the player can change their name or region.
   */
  const openProfileEditor = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'playing') {
        void pauseServerPuzzleSession(sessionIdRef.current, activeProfile);
        return 'paused';
      }
      if (prev === 'won') {
        statusRef.current = 'idle';
        return 'idle';
      }
      return prev;
    });
    setSelectedTileId(null);
    setScreen('welcome');
  }, [activeProfile]);

  /**
   * Starts a fresh server-tracked puzzle session and resets monotonic timer.
   */
  const beginSessionForImage = useCallback(
    (image: PuzzleImage) => {
      // Abandon any prior active session so it cannot award points
      const previousSessionId = sessionIdRef.current;
      if (previousSessionId && statusRef.current !== 'won') {
        void abandonServerPuzzleSession(previousSessionId, activeProfile);
      }

      sessionIdRef.current = null;
      const freshTiles = createShuffledTiles(DEFAULT_GRID_SIZE);

      tilesRef.current = freshTiles;
      movesRef.current = 0;
      statusRef.current = 'playing';

      setSelectedImage(image);
      setTiles(freshTiles);
      setMoves(0);
      setSelectedTileId(null);
      setLastMovedTileIds(null);
      setIsNewRecord(false);
      setLastScoreResult(null);
      resetTimer();
      setStatus('playing');
      setScreen('game');

      const startPromise = startServerPuzzleSession({
        profile: activeProfile,
        imageId: image.id,
        gridSize: DEFAULT_GRID_SIZE,
        initialTiles: freshTiles,
      }).then(({ sessionId, leaderboard: latestLeaderboard }) => {
        sessionIdRef.current = sessionId;
        setLeaderboard(latestLeaderboard);
        return sessionId;
      });

      startSessionPromiseRef.current = startPromise;
    },
    [activeProfile, resetTimer]
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
        void pauseServerPuzzleSession(sessionIdRef.current, activeProfile);
        return 'paused';
      }
      if (prev === 'paused') {
        void resumeServerPuzzleSession(sessionIdRef.current, activeProfile);
        return 'playing';
      }
      return prev;
    });
    setSelectedTileId(null);
  }, [activeProfile]);

  const resumeGame = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'paused') {
        void resumeServerPuzzleSession(sessionIdRef.current, activeProfile);
        return 'playing';
      }
      return prev;
    });
  }, [activeProfile]);

  /**
   * Navigates back to the gallery screen and pauses any active game.
   */
  const goToGallery = useCallback(() => {
    setStatus((prev) => {
      if (prev === 'playing') {
        void pauseServerPuzzleSession(sessionIdRef.current, activeProfile);
        return 'paused';
      }
      if (prev === 'won') {
        statusRef.current = 'idle';
        return 'idle';
      }
      return prev;
    });
    setSelectedTileId(null);
    setScreen(playerProfile ? 'gallery' : 'welcome');
  }, [playerProfile, activeProfile]);

  /**
   * Swaps two tiles on the board and checks for puzzle completion.
   * Executes outside the state updater to prevent StrictMode double-invocations and stale closures.
   */
  const handleSwapTiles = useCallback(
    (firstTileId: string, secondTileId: string) => {
      if (statusRef.current !== 'playing') return;
      if (firstTileId === secondTileId) return;

      const currentTiles = tilesRef.current;
      const { nextTiles, didSwap } = swapTilesById(currentTiles, firstTileId, secondTileId);
      if (!didSwap) return;

      const nextMoves = movesRef.current + 1;
      tilesRef.current = nextTiles;
      movesRef.current = nextMoves;

      setTiles(nextTiles);
      setMoves(nextMoves);
      setSelectedTileId(null);
      setLastMovedTileIds([firstTileId, secondTileId]);

      const solved = isPuzzleSolved(nextTiles);
      if (solved) {
        statusRef.current = 'won';
        setStatus('won');
        soundFX.playVictory(soundEnabledRef.current);

        const monotonicSecs = Math.max(1, getMonotonicElapsedSeconds());
        const immediatePoints = calculateTimeScore(monotonicSecs);
        const immediateTier = getScoringTierForTime(monotonicSecs);

        const submitScore = async () => {
          let activeSessionId = sessionIdRef.current;
          if (!activeSessionId && startSessionPromiseRef.current) {
            try {
              activeSessionId = await startSessionPromiseRef.current;
            } catch {
              // Fallback if start promise failed
            }
          }
          if (!activeSessionId) {
            activeSessionId = `session-${Date.now()}-${selectedImage.id}`;
            sessionIdRef.current = activeSessionId;
          }

          if (submittedSessionIdsRef.current.has(activeSessionId)) {
            return;
          }
          submittedSessionIdsRef.current.add(activeSessionId);

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

          const serverResult = await completeServerPuzzleSession({
            sessionId: activeSessionId,
            profile: activeProfile,
            imageId: selectedImage.id,
            gridSize: DEFAULT_GRID_SIZE,
            finalTiles: nextTiles,
            moves: nextMoves,
            monotonicElapsedSeconds: monotonicSecs,
          });

          setAuthoritativeSeconds(serverResult.elapsedSeconds);
          setLastScoreResult(serverResult);
          setLeaderboard(serverResult.leaderboard);

          const key = getScoreKey(selectedImage.id, activeProfile.playerId);
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
        };

        void submitScore();
      } else {
        const swappedA = nextTiles.find((t) => t.id === firstTileId);
        const swappedB = nextTiles.find((t) => t.id === secondTileId);
        const landedCorrect = Boolean(
          (swappedA && swappedA.correctIndex === swappedA.currentIndex) ||
            (swappedB && swappedB.correctIndex === swappedB.currentIndex)
        );
        soundFX.playSwap(soundEnabledRef.current, landedCorrect);
      }
    },
    [
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
      if (statusRef.current !== 'playing') return;

      if (!selectedTileId) {
        setSelectedTileId(tileId);
        soundFX.playSelect(soundEnabledRef.current);
      } else if (selectedTileId === tileId) {
        setSelectedTileId(null);
      } else {
        handleSwapTiles(selectedTileId, tileId);
      }
    },
    [selectedTileId, handleSwapTiles]
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
    bestScores[getScoreKey(selectedImage.id, activeProfile.playerId)];

  return {
    playerId: activeProfile.playerId,
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
