# 1Ghana Image Puzzle

A modern, responsive, mobile-first tile arrangement puzzle game featuring iconic Ghanaian national emblems, historic landmarks, and music legends. Built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, **@dnd-kit**, and **Lucide React**.

---

## Features

- **Player Onboarding (Name/Nickname & Region)**:
  - Players enter their Name or Nickname and choose their Region in Ghana (all 16 regions) before accessing the homepage gallery.
- **Dynamic Image Gallery (`import.meta.glob`) - 11 Puzzles in `images/`**:
  - Automatically discovers all browser-supported images (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, `.svg`) inside `/images/**` (including nested subdirectories).
  - **National Emblems & History (`images/`)**:
    - **Coat of Arms** (`images/coatoa.jpg`)
    - **Flag of Ghana** (`images/gflag.jpg`)
    - **Map of Ghana** (`images/ghanamap.jpg`)
    - **Kwame Nkrumah** (`images/KN.jpg`)
  - **Historic Landmarks (`images/`)**:
    - **Independence Square, Accra** (`images/independence-square-accra.jpg`)
    - **Elmina Castle** (`images/caption.jpg`)
    - **Cape Coast Castle** (`images/castle-2419575_1280.jpg`)
    - **Jamestown Lighthouse** (`images/travelessence-jamestown-lighthouse.jpg`)
  - **Music Icons (`images/`)**:
    - **Shatta Wale** (`images/shatta.jpg`)
    - **Stonebwoy** (`images/stone.jpg`)
    - **Sarkodie** (`images/sark.jpg`)
- **Time-Based Scoring & Live In-Game Leaderboard**:
  - Every completed puzzle awards points based on actual completion time measured via monotonic clocks (`performance.now()` on both client and backend):
    - **Less than 30 seconds**: `1,200` pts
    - **30-60 seconds inclusive**: `1,000` pts
    - **More than 60 seconds up to 90 seconds**: `750` pts
    - **More than 90 seconds up to 120 seconds inclusive**: `500` pts
    - **More than 120 seconds up to 180 seconds**: `300` pts
    - **More than 180 seconds up to 300 seconds**: `200` pts
    - **More than 300 seconds up to 600 seconds**: `100` pts
    - **More than 600 seconds**: `50` pts
  - **Trusted Backend Validation (`/api/puzzle/*`)**: Validates board completion, monotonic session duration, and one-time session idempotency on the server so abandoned, incomplete, or resubmitted puzzles never award duplicate or invalid points.
  - **Live In-Game Leaderboard Sidebar**: Displays the live player standings and regions directly in the active game sidebar.
- **Nearly Seamless 4 x 4 Puzzle Board**:
  - Uses a consistent 4 x 4 grid (16 tiles) with a razor-thin `1px` hairline gap (`gap-[1px]`) during play and a `0px` continuous canvas (`gap-0`) upon completion.
- **Multi-Modal Tile Controls (Touch, Mouse & Keyboard)**:
  - **Drag & Drop**, **Two-Tap Quick Swap**, and **Keyboard Arrow-Key Navigation**.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```
