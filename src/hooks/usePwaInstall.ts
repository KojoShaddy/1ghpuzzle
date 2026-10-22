import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

const DISMISSED_BANNER_KEY = 'ghana-puzzle-pwa-banner-dismissed-v1';

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' && window.__deferredPwaPrompt
      ? window.__deferredPwaPrompt
      : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(DISMISSED_BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);

  const isIosDevice =
    typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const isAndroidDevice =
    typeof window !== 'undefined' && /android/i.test(window.navigator.userAgent);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncDeferredPrompt = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setIsInstallGuideOpen(false);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };

    syncDeferredPrompt();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', syncDeferredPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', syncDeferredPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    const activePrompt = deferredPrompt || window.__deferredPwaPrompt;
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
        return;
      } catch {
        // Fallback to manual guide if prompt failed
      }
    }
    setIsInstallGuideOpen(true);
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISSED_BANNER_KEY, '1');
    } catch {
      // Ignore storage error
    }
  }, []);

  const canPromptNatively = Boolean(deferredPrompt);
  const showInstallBanner =
    !isInstalled && !isBannerDismissed && (canPromptNatively || isAndroidDevice || isIosDevice);

  return {
    isInstalled,
    canPromptNatively,
    isIosDevice,
    isAndroidDevice,
    showInstallBanner,
    isInstallGuideOpen,
    setIsInstallGuideOpen,
    triggerInstall,
    dismissBanner,
  };
}
