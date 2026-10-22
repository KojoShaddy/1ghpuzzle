import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Play,
  Trophy,
} from 'lucide-react';
import { PUZZLE_IMAGES } from '../data/puzzles';
import { BestScoresMap, PlayerProfile, PuzzleImage } from '../types/puzzle';
import { formatTimeHuman, getScoreKey } from '../utils/puzzleUtils';
import { PuzzleCard } from './PuzzleCard';

const INITIAL_VISIBLE_IMAGES = 8;

interface PuzzleGalleryProps {
  playerProfile: PlayerProfile;
  selectedImage: PuzzleImage;
  bestScores: BestScoresMap;
  onSelectImage: (image: PuzzleImage) => void;
  onStartGame: (image?: PuzzleImage) => void;
  onOpenLeaderboard: () => void;
}

export const PuzzleGallery: React.FC<PuzzleGalleryProps> = ({
  playerProfile,
  selectedImage,
  bestScores,
  onSelectImage,
  onStartGame,
  onOpenLeaderboard,
}) => {
  const [showAllImages, setShowAllImages] = useState(false);
  const selectedScore = bestScores[getScoreKey(selectedImage.id, playerProfile.playerId)];

  const currentIndex = Math.max(
    0,
    PUZZLE_IMAGES.findIndex((img) => img.id === selectedImage.id)
  );

  const handlePrevImage = () => {
    const prevIndex = (currentIndex - 1 + PUZZLE_IMAGES.length) % PUZZLE_IMAGES.length;
    onSelectImage(PUZZLE_IMAGES[prevIndex]);
  };

  const handleNextImage = () => {
    const nextIndex = (currentIndex + 1) % PUZZLE_IMAGES.length;
    onSelectImage(PUZZLE_IMAGES[nextIndex]);
  };

  const visibleImages = showAllImages
    ? PUZZLE_IMAGES
    : PUZZLE_IMAGES.slice(0, INITIAL_VISIBLE_IMAGES);
  const hasMoreImages = PUZZLE_IMAGES.length > INITIAL_VISIBLE_IMAGES;

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
      {/* Hero Setup Card */}
      <section
        aria-label="Selected Puzzle Preview"
        className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 lg:p-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Selected Image Preview with Sleek Backward & Forward Arrows */}
          <div className="lg:col-span-5 flex items-center justify-center gap-2.5 sm:gap-4">
            <button
              id="prev-preview-image-btn"
              type="button"
              onClick={handlePrevImage}
              aria-label="Previous puzzle picture"
              title="Previous picture"
              className="group w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 hover:text-white border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 shadow-sm hover:shadow-md hover:shadow-emerald-600/20 flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform duration-200 group-hover:-translate-x-0.5" />
            </button>

            <div className="relative w-44 h-44 sm:w-56 sm:h-56 lg:w-full lg:max-w-[260px] aspect-square rounded-2xl overflow-hidden border-2 border-emerald-600/30 shadow-md bg-slate-100 dark:bg-slate-800 shrink-0">
              <img
                src={selectedImage.src}
                alt={`Selected preview: ${selectedImage.title}`}
                className="w-full h-full object-cover object-top transition-all duration-300"
              />
              <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-slate-950/75 text-emerald-300 backdrop-blur-sm">
                {currentIndex + 1} / {PUZZLE_IMAGES.length}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 backdrop-blur-[2px] p-3 text-white">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 block">
                  Selected Picture
                </span>
                <span className="font-display font-bold text-base sm:text-lg leading-tight block truncate">
                  {selectedImage.title}
                </span>
              </div>
            </div>

            <button
              id="next-preview-image-btn"
              type="button"
              onClick={handleNextImage}
              aria-label="Next puzzle picture"
              title="Next picture"
              className="group w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-100 dark:bg-slate-800/90 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 hover:text-white border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-500 shadow-sm hover:shadow-md hover:shadow-emerald-600/20 flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Description, Player Welcome Pill & Prominent Play CTA */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5 text-center sm:text-left">
            <div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-slate-900 dark:text-white tracking-tight">
                Reconstruct the Picture
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {selectedImage.description}
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

            {/* Prominent Play Button & Leaderboard Trigger */}
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
                id="lobby-leaderboard-btn"
                type="button"
                onClick={onOpenLeaderboard}
                className="min-h-[52px] px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Leaderboard</span>
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
          {visibleImages.map((img) => (
            <PuzzleCard
              key={img.id}
              image={img}
              isSelected={selectedImage.id === img.id}
              bestScore={bestScores[getScoreKey(img.id, playerProfile.playerId)]}
              onSelect={onSelectImage}
              onPlayNow={(chosen) => onStartGame(chosen)}
            />
          ))}
        </div>

        {hasMoreImages && (
          <div className="pt-2 flex justify-center">
            <button
              id="view-all-images-btn"
              type="button"
              onClick={() => setShowAllImages((prev) => !prev)}
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 font-display font-bold text-sm shadow-sm inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {showAllImages ? (
                <>
                  <span>Show Less Images</span>
                  <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </>
              ) : (
                <>
                  <span>View All Images ({PUZZLE_IMAGES.length})</span>
                  <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </>
              )}
            </button>
          </div>
        )}
      </section>
    </main>
  );
};
