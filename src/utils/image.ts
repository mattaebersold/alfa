import { imageUrl as kitImageUrl, type ImageSize } from '../constants/appConfig';
import type { GalleryItem } from '../types/api';

export type { ImageSize };

/**
 * An uploaded image's URL, through the image CDN at the size it's drawn —
 * see ImageSize in config. Defaults to `medium` (full-width).
 */
export function imageUrl(filename: string | null | undefined, size?: ImageSize): string | null {
  return kitImageUrl(filename, size);
}

export function firstGalleryUrl(gallery?: GalleryItem[] | null, size?: ImageSize): string | null {
  if (!gallery?.length) return null;
  return imageUrl(gallery[0].filename, size);
}

/**
 * A car's main photo. The one the owner picked with "Change Main Photo"
 * (`profile_image`) wins over the first in its gallery, the way the car's
 * own page has always shown it — every card that leads there should show
 * the same picture, or changing it looks like it didn't take.
 */
export function carHeroUrl(
  car?: { profile_image?: string | null; gallery?: GalleryItem[] | null } | null,
  size?: ImageSize,
): string | null {
  if (!car) return null;
  return imageUrl(car.profile_image, size) ?? firstGalleryUrl(car.gallery, size);
}
