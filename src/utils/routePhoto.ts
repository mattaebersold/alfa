import type { DrivingRoute, RouteGalleryItem } from '../types/api';
import { imageUrl } from './image';

/** An uploaded photo, as opposed to the map the server rendered — see below. */
const isUpload = (g: RouteGalleryItem) => !!g.internal_id && !!g.filename && g.type !== 'video';

/**
 * The driver's own photo of a route, if they added one.
 *
 * A route's gallery can also hold a map the server rendered for it when it
 * was saved without photos (horacio's routeStaticMap). That's a picture of
 * the route's shape — which the card already draws — so it isn't a photo to
 * put behind it. The two are told apart by shape: an upload is stored with an
 * `internal_id`, the rendered map with only its `filename`.
 *
 * Other people can add photos to a route too (they carry their `user_id`).
 * The owner's is the one the save form manages, so it's this.
 */
export function routeOwnerPhoto(route: Pick<DrivingRoute, 'gallery' | 'user_id'>): RouteGalleryItem | null {
  return route.gallery?.find((g) => isUpload(g) && (!g.user_id || g.user_id === route.user_id)) ?? null;
}

/**
 * The photo to show behind a route: the owner's, or else the first anyone
 * added along the way — still a better picture than none.
 */
export function routePhoto(route: Pick<DrivingRoute, 'gallery' | 'user_id'>): RouteGalleryItem | null {
  return routeOwnerPhoto(route) ?? route.gallery?.find(isUpload) ?? null;
}

/** routePhoto's URL, ready for an Image. */
export function routePhotoUrl(route: Pick<DrivingRoute, 'gallery' | 'user_id'>): string | null {
  const photo = routePhoto(route);
  return photo ? imageUrl(photo.filename) : null;
}
