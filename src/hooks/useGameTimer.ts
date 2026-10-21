import { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus } from '../types/puzzle';

interface UseGameTimerReturn {
  elapsedSeconds: number;
  resetTimer: () => void;
  setAuthoritativeSeconds: (seconds: number) => void;
  getMonotonicElapsedSeconds: () => number;
}

/**
 * Manages the game timer using `performance.now()` (monotonic clock) so it is completely
 * immune to system clock changes and browser background tab throttling.
 */
export function useGameTimer(status: GameStatus): UseGameTimerReturn {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const startedAtMonoRef = useRef<number>(performance.now());
  const pausedAtMonoRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getMonotonicElapsedSeconds = useCallback((): number => {
    const nowMono = pausedAtMonoRef.current ?? performance.now();
    const activeMs = Math.max(
      0,
      nowMono - startedAtMonoRef.current - totalPausedMsRef.current
    );
    return Math.floor(activeMs / 1000);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimerInterval();
    startedAtMonoRef.current = performance.now();
    pausedAtMonoRef.current = null;
    totalPausedMsRef.current = 0;
    setElapsedSeconds(0);
  }, [clearTimerInterval]);

  const setAuthoritativeSeconds = useCallback((seconds: number) => {
    setElapsedSeconds(Math.max(0, Math.floor(seconds)));
  }, []);

  useEffect(() => {
    if (status === 'playing') {
      if (pausedAtMonoRef.current !== null) {
        totalPausedMsRef.current += Math.max(
          0,
          performance.now() - pausedAtMonoRef.current
        );
        pausedAtMonoRef.current = null;
      }

      const syncElapsed = () => {
        const nextSecs = getMonotonicElapsedSeconds();
        setElapsedSeconds((prev) => (prev !== nextSecs ? nextSecs : prev));
      };

      syncElapsed();
      intervalRef.current = window.setInterval(syncElapsed, 250);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          syncElapsed();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearTimerInterval();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    if (status === 'paused') {
      if (pausedAtMonoRef.current === null) {
        pausedAtMonoRef.current = performance.now();
      }
      clearTimerInterval();
      return;
    }

    clearTimerInterval();
  }, [status, clearTimerInterval, getMonotonicElapsedSeconds]);

  return {
    elapsedSeconds,
    resetTimer,
    setAuthoritativeSeconds,
    getMonotonicElapsedSeconds,
  };
}
