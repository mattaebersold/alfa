import { CONFIG } from '../constants/config';
import type { GalleryItem } from '../types/api';

export function imageUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${CONFIG.S3_BASE_URL}/${filename}`;
}

export function firstGalleryUrl(gallery?: GalleryItem[] | null): string | null {
  if (!gallery?.length) return null;
  return imageUrl(gallery[0].filename);
}

/**
 * A car's main photo. The one the owner picked with "Change Main Photo"
 * (`profile_image`) wins over the first in its gallery, the way the car's
 * own page has always shown it — every card that leads there should show
 * the same picture, or changing it looks like it didn't take.
 */
export function carHeroUrl(
  car?: { profile_image?: string | null; gallery?: GalleryItem[] | null } | null,
): string | null {
  if (!car) return null;
  return imageUrl(car.profile_image) ?? firstGalleryUrl(car.gallery);
}
