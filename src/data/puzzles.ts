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
  description: string;
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
    description:
      'Designed by Ghanaian artist Amon Kotei and adopted on March 4, 1957, the Coat of Arms of Ghana features a blue shield divided by a green St. George’s cross rimmed with gold. It showcases a linguist staff and ceremonial sword, Osu Castle, a cocoa tree, a gold mine, and two tawny eagles supporting the Black Star of African Freedom above the national motto, "Freedom and Justice."',
    order: 1,
  },
  'gflag.jpg': {
    id: 'gflag',
    title: 'Flag of Ghana',
    category: 'National Emblem',
    subtitle: 'Red, Gold, Green & the Black Star of African Freedom',
    description:
      'Designed by Theodosia Okoh in 1957 to replace the colonial ensign upon independence, the national flag of Ghana is a horizontal triband of red, gold, and green centered with a five-pointed black star. Red honors the blood shed for independence, gold represents the country’s mineral wealth, green symbolizes rich forests and agriculture, and the Black Star stands as the lodestar of African emancipation.',
    order: 2,
  },
  'ghana map.png': {
    id: 'ghanamap',
    title: 'Map of Ghana',
    category: 'History & Geography',
    subtitle: 'Regional landmarks and geography of Ghana',
    description:
      'Located along the Gulf of Guinea and the Atlantic Ocean in West Africa, Ghana spans diverse ecological zones from coastal savannas and tropical rainforests to the northern wooded savannas. Anchored by Lake Volta—one of the world’s largest artificial reservoirs—the map highlights the country’s vibrant regional capitals, historic heritage routes, and rich natural resources.',
    order: 3,
  },
  'kn.jpg': {
    id: 'kn',
    title: 'Kwame Nkrumah',
    category: 'National Leader',
    subtitle: 'First President & Founding Father of Ghana',
    description:
      'Osagyefo Dr. Kwame Nkrumah (1909–1972) led the Gold Coast to independence from British colonial rule in 1957, serving as Ghana’s first Prime Minister and President. A visionary Pan-Africanist and co-founder of the Organization of African Unity, he championed continental liberation, major industrial infrastructure like the Akosombo Dam, and national self-determination.',
    order: 4,
  },
  'drnkrumah.jpg': {
    id: 'dr-kwame-nkrumah',
    title: 'Dr. Kwame Nkrumah',
    category: 'National Leader',
    subtitle: 'Osagyefo championing Pan-African liberation & unity',
    description:
      'Standing before the map of the African continent, Osagyefo Dr. Kwame Nkrumah passionately articulated his timeless vision that "the independence of Ghana is meaningless unless it is linked up with the total liberation of the African continent." His historic speeches inspired freedom movements across Africa and laid the foundation for the African Union.',
    order: 5,
  },
  'john_dramani_mahama.png': {
    id: 'john-dramani-mahama',
    title: 'John Dramani Mahama',
    category: 'National Leader',
    subtitle: 'President of the Republic of Ghana',
    description:
      'John Dramani Mahama is a Ghanaian statesman, historian, and communication specialist serving as President of the Republic of Ghana. Having previously served as Member of Parliament, Vice President, and President from 2012 to 2017 before returning to the presidency in 2025, he is widely recognized for his focus on national infrastructure and democratic governance.',
    order: 6,
  },
  'nana.jpg': {
    id: 'nana-akufo-addo',
    title: 'Nana Akufo-Addo',
    category: 'National Leader',
    subtitle: 'Former President of the Republic of Ghana (2017–2025)',
    description:
      'Nana Addo Dankwa Akufo-Addo is a Ghanaian lawyer and statesman who served as President of the Republic of Ghana from 2017 to 2025. Before his presidency, he served as Attorney General and Minister for Foreign Affairs, and his administration championed the Free SHS education policy and the "Year of Return" heritage initiative.',
    order: 7,
  },
  'otumfuo.jpg': {
    id: 'otumfuo-osei-tutu-ii',
    title: 'Otumfuo Osei Tutu II',
    category: 'Traditional Royalty',
    subtitle: '16th Asantehene of the Ashanti Kingdom',
    description:
      'Otumfuo Osei Tutu II is the 16th Asantehene, the traditional monarch of the Ashanti Kingdom and custodian of the sacred Golden Stool (Sika Dwa Kofi) at the Manhyia Palace in Kumasi. Since ascending the throne in 1999, he has been celebrated across Africa for championing education through the Otumfuo Foundation, cultural preservation, and national peacebuilding.',
    order: 8,
  },
  'gamantse.jpg': {
    id: 'ga-mantse',
    title: 'Ga Mantse (King Tackie Teiko Tsuru II)',
    category: 'Traditional Royalty',
    subtitle: 'Paramount King of the Ga State in Greater Accra',
    description:
      'King Tackie Teiko Tsuru II serves as the Ga Mantse, the paramount traditional ruler of the Ga Mashie and wider Ga State in the Greater Accra Region. Celebrated during the vibrant annual Homowo festival, the Ga Mantse upholds centuries-old Ga customs, community development, youth education, and cultural unity across the capital.',
    order: 9,
  },
  'independence-square-accra.jpg': {
    id: 'independence-square-accra',
    title: 'Independence Square, Accra',
    category: 'Historic Landmark',
    subtitle: 'Black Star Gate monument of Freedom and Justice (AD 1957)',
    description:
      'Commissioned by Kwame Nkrumah and completed in 1961 in central Accra, Black Star Square (Independence Square) is one of the largest public civic plazas in the world. Crowned by the iconic Black Star Gate inscribed with "AD 1957" and "Freedom and Justice," it serves as the ceremonial heart of Ghana’s Independence Day parades and national gatherings.',
    order: 9,
  },
  'larabanga.jpg': {
    id: 'larabanga-mosque',
    title: 'Larabanga Mosque',
    category: 'Historic Landmark',
    subtitle: 'Ancient Sudano-Sahelian mud-and-timber mosque in Savannah Region',
    description:
      'Founded in 1421 in the historic village of Larabanga near Mole National Park in Ghana’s Savannah Region, the Larabanga Mosque is the oldest mosque in Ghana and one of the oldest in West Africa. Built in the distinctive Sudano-Sahelian architectural style from whitewashed mud and timber buttresses, it is revered as the "Mecca of West Africa."',
    order: 10,
  },
  'caption.jpg': {
    id: 'elmina-castle',
    title: 'Elmina Castle',
    category: 'Historic Landmark',
    subtitle: "Aerial view of St. George's Castle and Elmina fishing harbour",
    description:
      'Erected by the Portuguese in 1482 as Castelo de São Jorge da Mina in the Central Region, Elmina Castle is the oldest European building in existence south of the Sahara. Recognized as a UNESCO World Heritage Site alongside Ghana’s coastal forts, it stands at the edge of the vibrant Elmina fishing harbor as a solemn monument to history and resilience.',
    order: 11,
  },
  'castle-2419575_1280.jpg': {
    id: 'cape-coast-castle',
    title: 'Cape Coast Castle',
    category: 'Historic Landmark',
    subtitle: 'Historic coastal fortress courtyard in Cape Coast',
    description:
      'Overlooking the turbulent waves of the Atlantic Ocean in Ghana’s Central Region, Cape Coast Castle was originally built as a timber and gold lodge in the 17th century before expanding into a major coastal fortress. Today, the UNESCO World Heritage monument houses a historical museum preserving the memory of the transatlantic era and celebrating African heritage and return.',
    order: 12,
  },
  'travelessence-jamestown-lighthouse.jpg': {
    id: 'jamestown-lighthouse',
    title: 'Jamestown Lighthouse',
    category: 'Historic Landmark',
    subtitle: 'Iconic red-and-white coastal lighthouse in Jamestown, Accra',
    description:
      'Rising 28 meters above the historic fishing community of Jamestown in Old Accra, the red-and-white banded Jamestown Lighthouse was built in the 1930s to replace an earlier 1871 structure. It overlooks the bustling James Fort harbor, colorful wooden fishing canoes, and one of Accra’s most vibrant cultural and arts districts.',
    order: 13,
  },
  'shatta.jpg': {
    id: 'shatta',
    title: 'Shatta Wale',
    category: 'Music Icon',
    subtitle: 'Ghanaian Reggae-Dancehall star & hitmaker',
    description:
      'Charles Nii Armah Mensah Jr., popularly known as Shatta Wale, is a pioneering Ghanaian Reggae-Dancehall musician and leader of the Shatta Movement Empire. Renowned for his high-energy anthems like "Dancehall King," "My Level," and his global collaboration with Beyoncé on "Already," he has helped propel Ghanaian dancehall onto the international stage.',
    order: 14,
  },
  'stone.jpg': {
    id: 'stone',
    title: 'Stonebwoy',
    category: 'Music Icon',
    subtitle: 'Afropop, Dancehall & Reggae award-winning artist',
    description:
      'Livingstone Etse Satekla, known professionally as Stonebwoy, is a multi-award-winning Ghanaian Afropop, Dancehall, and Reggae icon and CEO of Burniton Music Group. A BET Award winner and TGMA Artiste of the Year, his acclaimed albums and global touring have made him a leading ambassador of contemporary African Reggae and Afro-Dancehall.',
    order: 15,
  },
  'sark.jpg': {
    id: 'sark',
    title: 'Sarkodie',
    category: 'Music Icon',
    subtitle: 'Iconic Ghanaian Hip-Hop & Hiplife lyricist',
    description:
      'Michael Owusu Addo, celebrated globally as Sarkodie, is one of Africa’s most decorated rappers and a torchbearer of Ghanaian Hiplife and Hip-Hop. Famous for his rapid-fire Twi flows, storytelling, and landmark albums from "Makye" to "Jamz," he was the first winner of BET’s Best International Flow award and remains a defining voice in African music.',
    order: 16,
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

const REPLACED_LEGACY_FILENAMES = new Set<string>(['ghanamap.jpg']);

function buildPuzzleImagesCatalogue(): PuzzleImage[] {
  const seenKeys = new Set<string>();
  const items: Array<{ item: PuzzleImage; order: number }> = [];

  for (const [rawPath, resolvedUrl] of Object.entries(discoveredImageModules)) {
    const segments = rawPath.split('/');
    const filename = segments[segments.length - 1] || rawPath;
    const lookupKey = filename.toLowerCase();

    if (REPLACED_LEGACY_FILENAMES.has(lookupKey) || seenKeys.has(lookupKey)) {
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
          description: known.description,
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
          description: `Featured in the ${parentFolder} collection, ${derivedTitle} showcases a distinctive moment of Ghanaian culture and heritage. Rearrange all 16 tiles on the 4 x 4 board to restore the full high-resolution photograph.`,
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
      description: meta.description,
    }));
  }

  items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.item.title.localeCompare(b.item.title);
  });

  return items.map((entry) => entry.item);
}

export const PUZZLE_IMAGES: PuzzleImage[] = buildPuzzleImagesCatalogue();
