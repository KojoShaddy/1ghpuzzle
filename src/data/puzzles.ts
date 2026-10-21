import { PuzzleImage } from '../types/puzzle';

/**
 * Consistent predefined 4x4 grid (16 tiles) across mobile and desktop.
 */
export const DEFAULT_GRID_SIZE = 4;

/**
 * All 16 administrative regions of Ghana for player registration.
 */
export const GHANA_REGIONS: readonly string[] = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
] as const;

interface ImageCatalogueEntry {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  order: number;
}

/**
 * Centralised catalogue of known project images, preserving original titles and metadata
 * as well as inspected titles for landmarks with non-descriptive or stock filenames.
 * Keys are lowercase filenames (with extension) for case-insensitive matching.
 */
const KNOWN_IMAGE_CATALOGUE: Record<string, ImageCatalogueEntry> = {
  'coatoa.jpg': {
    id: 'coatoa',
    title: 'Coat of Arms',
    category: 'National Emblem',
    subtitle: 'Freedom and Justice crest of the Republic of Ghana',
    order: 1,
  },
  'gflag.jpg': {
    id: 'gflag',
    title: 'Flag of Ghana',
    category: 'National Emblem',
    subtitle: 'Red, Gold, Green & the Black Star of African Freedom',
    order: 2,
  },
  'ghanamap.jpg': {
    id: 'ghanamap',
    title: 'Map of Ghana',
    category: 'History & Geography',
    subtitle: 'Regional landmarks and geography of Ghana',
    order: 3,
  },
  'kn.jpg': {
    id: 'kn',
    title: 'Kwame Nkrumah',
    category: 'History & Geography',
    subtitle: 'First President & Founding Father of Ghana',
    order: 4,
  },
  'independence-square-accra.jpg': {
    id: 'independence-square-accra',
    title: 'Independence Square, Accra',
    category: 'Historic Landmark',
    subtitle: 'Black Star Gate monument of Freedom and Justice (AD 1957)',
    order: 5,
  },
  'caption.jpg': {
    id: 'elmina-castle',
    title: 'Elmina Castle',
    category: 'Historic Landmark',
    subtitle: "Aerial view of St. George's Castle and Elmina fishing harbour",
    order: 6,
  },
  'castle-2419575_1280.jpg': {
    id: 'cape-coast-castle',
    title: 'Cape Coast Castle',
    category: 'Historic Landmark',
    subtitle: 'Historic coastal fortress courtyard in Cape Coast',
    order: 7,
  },
  'travelessence-jamestown-lighthouse.jpg': {
    id: 'jamestown-lighthouse',
    title: 'Jamestown Lighthouse',
    category: 'Historic Landmark',
    subtitle: 'Iconic red-and-white coastal lighthouse in Jamestown, Accra',
    order: 8,
  },
  'shatta.jpg': {
    id: 'shatta',
    title: 'Shatta Wale',
    category: 'Music Icon',
    subtitle: 'Ghanaian Reggae-Dancehall star & hitmaker',
    order: 9,
  },
  'stone.jpg': {
    id: 'stone',
    title: 'Stonebwoy',
    category: 'Music Icon',
    subtitle: 'Afropop, Dancehall & Reggae award-winning artist',
    order: 10,
  },
  'sark.jpg': {
    id: 'sark',
    title: 'Sarkodie',
    category: 'Music Icon',
    subtitle: 'Iconic Ghanaian Hip-Hop & Hiplife lyricist',
    order: 11,
  },
};

/**
 * Cleanly formats a display title from a raw filename when not explicitly listed in KNOWN_IMAGE_CATALOGUE.
 */
export function formatTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  const withoutStockNumbers = withoutExt.replace(/[-_]+\d{4,}(?:[-_]\d+)?$/, '');
  const withSpaces = (withoutStockNumbers || withoutExt)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) {
    return filename;
  }

  const minorWords = new Set(['of', 'the', 'and', 'in', 'on', 'at', 'to', 'for']);

  return withSpaces
    .split(' ')
    .map((word, index) => {
      if (/^[A-Z0-9]{2,4}$/.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (index > 0 && minorWords.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function createIdFromFilename(filename: string): string {
  return (
    filename
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'puzzle-image'
  );
}

/**
 * Discover all browser-supported image assets in `/images/**`
 * at build/dev time using Vite's `import.meta.glob`.
 */
const discoveredImageModules = import.meta.glob<string>(
  '/images/**/*.{jpg,jpeg,png,webp,gif,avif,svg,JPG,JPEG,PNG,WEBP,GIF,AVIF,SVG}',
  { eager: true, import: 'default' }
);

function buildPuzzleImagesCatalogue(): PuzzleImage[] {
  const seenKeys = new Set<string>();
  const items: Array<{ item: PuzzleImage; order: number }> = [];

  for (const [rawPath, resolvedUrl] of Object.entries(discoveredImageModules)) {
    const segments = rawPath.split('/');
    const filename = segments[segments.length - 1] || rawPath;
    const lookupKey = filename.toLowerCase();

    if (seenKeys.has(lookupKey)) {
      continue;
    }
    seenKeys.add(lookupKey);

    const known = KNOWN_IMAGE_CATALOGUE[lookupKey];
    if (known) {
      items.push({
        order: known.order,
        item: {
          id: known.id,
          filename,
          src: resolvedUrl,
          title: known.title,
          category: known.category,
          subtitle: known.subtitle,
        },
      });
    } else {
      const parentFolder =
        segments.length > 3
          ? formatTitleFromFilename(segments[segments.length - 2])
          : 'Gallery Collection';
      const derivedTitle = formatTitleFromFilename(filename);

      items.push({
        order: 1000,
        item: {
          id: createIdFromFilename(filename),
          filename,
          src: resolvedUrl,
          title: derivedTitle,
          category: parentFolder,
          subtitle: `Complete the ${derivedTitle} picture puzzle`,
        },
      });
    }
  }

  if (items.length === 0) {
    return Object.entries(KNOWN_IMAGE_CATALOGUE).map(([filename, meta]) => ({
      id: meta.id,
      filename,
      src: `/images/${filename}`,
      title: meta.title,
      category: meta.category,
      subtitle: meta.subtitle,
    }));
  }

  items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.item.title.localeCompare(b.item.title);
  });

  return items.map((entry) => entry.item);
}

export const PUZZLE_IMAGES: PuzzleImage[] = buildPuzzleImagesCatalogue();
