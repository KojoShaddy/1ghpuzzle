import React from 'react';
import { Download, MoreVertical, Share, Smartphone, PlusSquare, X, CheckCircle2 } from 'lucide-react';

interface PwaInstallPromptProps {
  showBanner: boolean;
  canPromptNatively: boolean;
  isIosDevice: boolean;
  isAndroidDevice: boolean;
  isGuideOpen: boolean;
  onTriggerInstall: () => void;
  onDismissBanner: () => void;
  onCloseGuide: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  showBanner,
  canPromptNatively,
  isIosDevice,
  isAndroidDevice,
  isGuideOpen,
  onTriggerInstall,
  onDismissBanner,
  onCloseGuide,
}) => {
  return (
    <>
      {/* Floating Bottom Install Prompt Banner (Android, iOS & Desktop) */}
      {showBanner && (
        <div
          role="region"
          aria-label="Install 1Ghana Image Puzzle App"
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-md z-40 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white border border-emerald-500/40 shadow-2xl shadow-black/50 backdrop-blur-md p-3.5 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="1Ghana Puzzle App Icon"
              className="w-12 h-12 rounded-xl object-contain bg-slate-800 border border-slate-700 p-1 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  App Available
                </span>
              </div>
              <h3 className="font-display font-bold text-sm sm:text-base text-white truncate mt-0.5">
                Install 1Ghana Puzzle
              </h3>
              <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                {canPromptNatively
                  ? 'Add to your phone home screen for fullscreen offline-ready play!'
                  : isIosDevice
                  ? 'Install on your iPhone/iPad home screen for fullscreen play.'
                  : 'Install on your Android phone or device for instant fullscreen access.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="pwa-banner-install-btn"
                type="button"
                onClick={onTriggerInstall}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-display font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install</span>
              </button>
              <button
                id="pwa-banner-dismiss-btn"
                type="button"
                onClick={onDismissBanner}
                aria-label="Dismiss install banner"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Install Instructions Modal (when native prompt isn't triggered directly or on iOS) */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Ghana Accent Strip */}
            <div className="h-1.5 w-full flex" aria-hidden="true">
              <div className="flex-1 bg-ghana-red" />
              <div className="flex-1 bg-ghana-gold" />
              <div className="flex-1 bg-ghana-green" />
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="1Ghana Image Puzzle"
                    className="w-12 h-12 rounded-xl bg-slate-900 p-1 border border-slate-700 shrink-0"
                  />
                  <div>
                    <h2
                      id="pwa-install-guide-title"
                      className="font-display font-bold text-lg text-slate-900 dark:text-white"
                    >
                      Install 1Ghana Puzzle
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Play fullscreen from your home screen
                    </p>
                  </div>
                </div>
                <button
                  id="close-pwa-guide-btn"
                  type="button"
                  onClick={onCloseGuide}
                  aria-label="Close installation guide"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm">
                {/* Android Instructions */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isAndroidDevice || (!isIosDevice && !isAndroidDevice)
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-2 font-display font-bold text-slate-900 dark:text-white mb-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Android (Chrome / Edge / Samsung Internet)</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                    <li>
                      Tap the browser menu icon{' '}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold">
                        <MoreVertical className="w-3 h-3 mr-0.5" /> 3 dots
                      </span>{' '}
                      in the top-right corner.
                    </li>
                    <li>
                      Select{' '}
                      <strong className="text-slate-900 dark:text-white">
                        &ldquo;Install app&rdquo;
                      </strong>{' '}
                      or{' '}
                      <strong className="text-slate-900 dark:text-white">
                        &ldquo;Add to Home screen&rdquo;
                      </strong>
                      .
                    </li>
                    <li>
                      Tap <strong className="text-emerald-600 dark:text-emerald-400">Install</strong>{' '}
                      on the prompt to launch it like a native app.
                    </li>
                  </ol>
                </div>

                {/* iOS Instructions */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isIosDevice
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-2 font-display font-bold text-slate-900 dark:text-white mb-2">
                    <Share className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>iPhone &amp; iPad (Safari)</span>
                  </div>
                  <ol className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                    <li>
                      Tap the{' '}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold">
                        <Share className="w-3 h-3 mr-1" /> Share
                      </span>{' '}
                      button at the bottom of Safari.
                    </li>
                    <li>
                      Scroll down and tap{' '}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold">
                        <PlusSquare className="w-3 h-3 mr-1" /> Add to Home Screen
                      </span>
                      .
                    </li>
                    <li>
                      Tap <strong className="text-emerald-600 dark:text-emerald-400">Add</strong> in
                      the top-right corner.
                    </li>
                  </ol>
                </div>

                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-3 py-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Works in fullscreen portrait mode with fast caching and live scores!</span>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  id="got-it-pwa-guide-btn"
                  type="button"
                  onClick={onCloseGuide}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-sm transition-colors cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
