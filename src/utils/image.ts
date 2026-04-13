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
