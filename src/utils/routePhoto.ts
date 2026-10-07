import type { DrivingRoute, GalleryItem } from '../types/api';
import { imageUrl } from './image';

/**
 * The driver's own photo of a route, if they added one.
 *
 * A route's gallery can also hold a map the server rendered for it when it
 * was saved without photos (horacio's routeStaticMap). That's a picture of
 * the route's shape — which the card already draws — so it isn't a photo to
 * put behind it. The two are told apart by shape: an upload is stored with an
 * `internal_id`, the rendered map with only its `filename`.
 */
export function routePhoto(route: Pick<DrivingRoute, 'gallery'>): GalleryItem | null {
  return route.gallery?.find((g) => !!g.internal_id && !!g.filename && g.type !== 'video') ?? null;
}

/** routePhoto's URL, ready for an Image. */
export function routePhotoUrl(route: Pick<DrivingRoute, 'gallery'>): string | null {
  const photo = routePhoto(route);
  return photo ? imageUrl(photo.filename) : null;
}
