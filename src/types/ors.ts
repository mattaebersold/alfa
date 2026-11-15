/**
 * Shapes shared by every ORS app, mirroring horacio's models.
 *
 * The user and photo-spot types are alfa's, trimmed to what the shared components read,
 * plus `accounts` — which apps a member has joined.
 */
import type { OrsAppId } from '../constants/appConfig';

export interface GalleryItem {
  filename?: string;
  _id?: string;
  internal_id?: string;
  type?: 'image' | 'video';
  index?: number;
  width?: number;
  height?: number;
}

export interface User {
  _id?: string;
  user_id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  bio?: string;
  cityState?: string;
  /**
   * Whether a zip is on file — what your own profile sends in place of the zip.
   * False for Google and Apple sign-ins until they add one; see ZipPrompt.
   */
  hasZip?: boolean;
  profilePicture?: string;
  avatarColor?: string;
  gallery?: GalleryItem[];
  accountType?: 'admin' | 'pro' | 'basic';
  /**
   * The ORS apps this member has joined. Missing on records that predate the
   * field, which the server treats as `['ors']`.
   */
  accounts?: OrsAppId[];
  followersCount?: number;
  followingCount?: number;
  memberNumber?: number;
  created_at?: string;
  userToken?: string;
}

export interface LoginResponse extends User {
  userToken: string;
}

export interface PaginatedResponse<T> {
  entries: T[];
  total: number;
  index?: number;
  limit?: number;
}

export interface PlacePrediction {
  place_id: string;
  primary: string;
  secondary: string | null;
  description: string;
}

/** A named place near a point — the park a pin was dropped in. */
export interface NearbyPlace {
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Google's kinds, minus the generic ones: "park", "parking", "tourist_attraction"… */
  types: string[];
  distance_m: number;
}

/** A chosen prediction, resolved to somewhere a pin can go. */
export interface PlaceDetail {
  place_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * A place worth photographing a car, pinned to the map.
 *
 * The coordinate is the point of it — a spot is "this corner of this parking
 * structure", which no address says. Everything else hangs off that.
 */
export interface PhotoSpot {
  internal_id: string;
  user_id: string;
  lat: number;
  lng: number;
  title?: string;
  body?: string;
  /** A human name for the place. Descriptive only; the coordinate is identity. */
  location?: string;
  /** What the place is — drives the pin colour. See constants/photoSpots. */
  type?: string | null;
  /** What you'd shoot there. */
  category?: string | null;
  /** Resolved from the coordinate on save — what the Location filter's regions match. */
  location_state?: string | null;
  region?: string | null;
  gallery?: PhotoSpotPhoto[];
  /** Free text, because the useful version of this is always a sentence. */
  access_note?: string;
  best_time?: string;
  private?: boolean;
  created_at?: string;
  updated_at?: string;
  /** Attached by the server — a narrow projection, not the whole user. */
  user?: PhotoSpotAuthor | null;
}

/** The narrow author projection a spot and its contributed photos carry. */
export interface PhotoSpotAuthor {
  user_id: string;
  username?: string;
  profile?: string[];
  gallery?: GalleryItem[];
  accountType?: string;
}

/**
 * One photo on a spot.
 *
 * The owner's own, uploaded with the pin, carry nothing extra. One added by
 * another member through the spot's "Add photos" carries who added it, and
 * the detail attaches that member so the strip can credit them.
 */
export interface PhotoSpotPhoto extends GalleryItem {
  user_id?: string;
  added_at?: string;
  user?: PhotoSpotAuthor | null;
}

/**
 * The events Location filter, as query params. `near_lat`/`near_lng` is the
 * device's position; `near: 'me'` asks the server to use the member's saved
 * zip instead; `region` is a key from constants/regions.
 */
export interface EventLocationParams {
  /** A two-letter state code — see filters/states. */
  state?: string;
  /** A region key — still understood by the server, no longer sent by the filter. */
  region?: string;
  near?: 'me';
  near_lat?: number;
  near_lng?: number;
  radius?: number;
}

/** Where a member stands against the pin limit. `limit: null` means unlimited. */
export interface PhotoSpotUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  reached: boolean;
  isPro: boolean;
}
