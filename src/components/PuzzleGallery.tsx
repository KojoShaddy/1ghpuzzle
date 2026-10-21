import React from 'react';
import { HelpCircle, Images, MapPin, Play, Trophy, UserCheck } from 'lucide-react';
import { PUZZLE_IMAGES } from '../data/puzzles';
import { BestScoresMap, PlayerProfile, PuzzleImage } from '../types/puzzle';
import { formatTimeHuman, getScoreKey } from '../utils/puzzleUtils';
import { PuzzleCard } from './PuzzleCard';

interface PuzzleGalleryProps {
  playerProfile: PlayerProfile;
  selectedImage: PuzzleImage;
  bestScores: BestScoresMap;
  onSelectImage: (image: PuzzleImage) => void;
  onStartGame: (image?: PuzzleImage) => void;
  onOpenRules: () => void;
  onEditProfile: () => void;
}

export const PuzzleGallery: React.FC<PuzzleGalleryProps> = ({
  playerProfile,
  selectedImage,
  bestScores,
  onSelectImage,
  onStartGame,
  onOpenRules,
  onEditProfile,
}) => {
  const selectedScore = bestScores[getScoreKey(selectedImage.id)];

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      {/* Hero Setup Card */}
      <section
        aria-label="Selected Puzzle Preview"
        className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 lg:p-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Selected Image Preview */}
          <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-center gap-4">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-full lg:max-w-[260px] aspect-square rounded-2xl overflow-hidden border-2 border-emerald-600/30 shadow-sm bg-slate-100 dark:bg-slate-800 shrink-0">
              <img
                src={selectedImage.src}
                alt={`Selected preview: ${selectedImage.title}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-3 text-white">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 block">
                  Selected Picture
                </span>
                <span className="font-display font-bold text-base sm:text-lg leading-tight block truncate">
                  {selectedImage.title}
                </span>
              </div>
            </div>
          </div>

          {/* Description, Player Welcome Pill & Prominent Play CTA */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5 text-center sm:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <Images className="w-3.5 h-3.5" />
                  <span>Ghana Heritage Collection - {PUZZLE_IMAGES.length} Puzzles</span>
                </span>

                <button
                  id="edit-player-profile-btn"
                  type="button"
                  onClick={onEditProfile}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{playerProfile.name}</span>
                  <span>-</span>
                  <MapPin className="w-3 h-3 text-amber-500" />
                  <span>{playerProfile.region} Region</span>
                </button>
              </div>

              <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white tracking-tight">
                Reconstruct the Picture
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl">
                Welcome, <strong>{playerProfile.name}</strong>! Select any picture from the gallery
                below and press Play to start solving the 4 x 4 puzzle. Complete puzzles faster to
                earn up to <strong>1,200 points</strong>.
              </p>
            </div>

            {selectedScore && (
              <div className="inline-flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                <Trophy className="w-4 h-4 shrink-0" />
                <span>
                  Personal Best for {selectedImage.title}:{' '}
                  {selectedScore.points?.toLocaleString() ?? ''} pts (
                  {formatTimeHuman(selectedScore.timeSeconds)} - {selectedScore.moves} moves)
                </span>
              </div>
            )}

            {/* Prominent Play Button & Scoring Rules Trigger */}
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                id="main-play-btn"
                type="button"
                onClick={() => onStartGame(selectedImage)}
                className="min-h-[52px] px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-display font-bold text-base sm:text-lg shadow-sm inline-flex items-center justify-center gap-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Play "{selectedImage.title}"</span>
              </button>

              <button
                id="lobby-scoring-rules-btn"
                type="button"
                onClick={onOpenRules}
                className="min-h-[52px] px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Scoring Rules</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Grid Section */}
      <section aria-labelledby="gallery-heading" className="space-y-4">
        <div className="flex flex-col xs:flex-row xs:items-end justify-between gap-2">
          <div>
            <h2
              id="gallery-heading"
              className="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-white"
            >
              Choose a Picture ({PUZZLE_IMAGES.length} Available)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Tap any card to preview or press Play on the card to launch immediately.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
          {PUZZLE_IMAGES.map((img) => (
            <PuzzleCard
              key={img.id}
              image={img}
              isSelected={selectedImage.id === img.id}
              bestScore={bestScores[getScoreKey(img.id)]}
              onSelect={onSelectImage}
              onPlayNow={(chosen) => onStartGame(chosen)}
            />
          ))}
        </div>
      </section>
    </main>
  );
};
