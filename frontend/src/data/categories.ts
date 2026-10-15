/**
 * The 25 field / land-use types an owner can list and an investor can invest in.
 * Names live in the translation files under "fieldTypes.<key>" (title) and "fieldTypeInfo.<key>" (description).
 * Map markers are coloured by group (25 colours would be unreadable).
 */
export type CategoryGroup = 'crops' | 'animals' | 'protected' | 'agribusiness' | 'development';

export interface Category {
  key: string;
  group: CategoryGroup;
  /** Photo base path without size suffix; null = photo still needed (a neutral placeholder is shown). */
  image: string | null;
}

export const CATEGORY_GROUPS: { key: CategoryGroup; color: string }[] = [
  { key: 'crops', color: '#4F7F2C' },
  { key: 'animals', color: '#C2621A' },
  { key: 'protected', color: '#2A6CA6' },
  { key: 'agribusiness', color: '#6B4A9B' },
  { key: 'development', color: '#B3261E' },
];

export const CATEGORIES: Category[] = [
  { key: 'crops', group: 'crops', image: '/images/categories/crops-12' },
  { key: 'orchards', group: 'crops', image: '/images/categories/orchards-6' },
  { key: 'greenhouse', group: 'protected', image: '/images/categories/greenhouse-4' },
  { key: 'livestock', group: 'animals', image: '/images/categories/livestock-2' },
  { key: 'poultry', group: 'animals', image: null },
  { key: 'pasture', group: 'animals', image: '/images/site/photo-04' },
  { key: 'beekeeping', group: 'animals', image: '/images/beekeeping-gubadli' },
  { key: 'fishery', group: 'animals', image: null },
  { key: 'nursery', group: 'protected', image: '/images/site/photo-11' },
  { key: 'mixed', group: 'crops', image: '/images/categories/crops-4' },
  { key: 'processing', group: 'agribusiness', image: '/images/site/photo-02' },
  { key: 'coldStorage', group: 'agribusiness', image: null },
  { key: 'machinery', group: 'agribusiness', image: '/images/site/photo-22' },
  { key: 'forestry', group: 'crops', image: null },
  { key: 'agrotourism', group: 'development', image: '/images/categories/crops-15' },
  { key: 'holidayHomes', group: 'development', image: null },
  { key: 'residential', group: 'development', image: null },
  { key: 'commercial', group: 'development', image: null },
  { key: 'roadside', group: 'development', image: null },
  { key: 'industry', group: 'agribusiness', image: null },
  { key: 'logistics', group: 'agribusiness', image: null },
  { key: 'renewable', group: 'development', image: '/images/site/photo-13' },
  { key: 'sport', group: 'development', image: null },
  { key: 'camping', group: 'development', image: '/images/categories/crops-17' },
  { key: 'social', group: 'development', image: null },
];

export const categoryByKey = (key: string) => CATEGORIES.find(c => c.key === key);
export const groupColor = (key: string) =>
  CATEGORY_GROUPS.find(g => g.key === categoryByKey(key)?.group)?.color ?? '#4F7F2C';

/** Responsive image URL; the `beekeeping` photo exists only in one size. */
export function categoryImage(key: string, size: 'sm' | 'lg' = 'sm'): string | null {
  const img = categoryByKey(key)?.image;
  if (!img) return null;
  if (img.startsWith('/images/beekeeping')) return `${img}.jpg`;
  return size === 'sm' ? `${img}-sm.jpg` : `${img}.jpg`;
}
