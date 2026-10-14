import { AgriculturalLand } from '../types/index.js';

/** New brand photos (frontend/public/images). AI-generated illustrations, not photos of specific plots. */
export const PHOTOS = {
  hero: '/images/hero-karabakh-wheat-fields.jpg',
  crops: '/images/crop-farming-aghdam-aerial.jpg',
  orchard: '/images/orchard-pomegranate-zangilan.jpg',
  greenhouse: '/images/greenhouse-modern.jpg',
  livestock: '/images/livestock-kalbajar-pasture.jpg',
  bees: '/images/beekeeping-gubadli.jpg',
} as const;

const BY_TYPE: Record<string, string> = {
  'Əkinçilik': PHOTOS.crops,
  'Bağçılıq': PHOTOS.orchard,
  'İstixana təsərrüfatı': PHOTOS.greenhouse,
  'Heyvandarlıq': PHOTOS.livestock,
  'Arıçılıq': PHOTOS.bees,
};

/**
 * The demo data reuses the same few old images for many plots (beekeeping showed an orchard,
 * livestock showed wheat). Until each plot has its own real photo, show the photo that matches
 * its farming type.
 */
export function landImage(land: Pick<AgriculturalLand, 'agricultureType' | 'imageUrl'>): string {
  return BY_TYPE[land.agricultureType] ?? land.imageUrl ?? PHOTOS.hero;
}

const MONTHS_AZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/** "2026-12-01T..." -> "1 dekabr 2026". Browsers often lack Azerbaijani month names, so format by hand. */
export function formatDateAz(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_AZ[d.getMonth()]} ${d.getFullYear()}`;
}

/** 420000 -> "420 000 ₼" (Azerbaijani style: space as thousands separator). */
export function formatManat(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return 'Təyin edilir';
  return `${Math.round(value).toLocaleString('az-AZ').replace(/[.,]/g, ' ')} ₼`;
}
