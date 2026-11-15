/**
 * App configuration, set once (appSetup.ts) before anything renders.
 *
 * Module-level rather than a React context because the parts that need it —
 * the base query, the auth thunks, the token store — run outside React.
 * `configureApp` must be called at the top of the app's entry file, before the
 * store is created.
 */

/**
 * Which Open Road Society app is asking.
 *
 * One user record serves every app, and `accounts` on it says which ones the
 * member has actually joined. The server tags an account with this id when
 * someone registers or signs in here, and scopes member lists to it — so a
 * member who only plays the spotting game never turns up in the photo app's
 * member list, and vice versa. alfa and murray send nothing, which the server
 * reads as 'ors'.
 */
export type OrsAppId = 'ors' | 'photo' | 'spot';

export interface AppConfig {
  app: OrsAppId;
  /** Shown on the auth screens: "Open Road Society", "ORS Photo", … */
  appName: string;
  /** The line under the name on the login screen. */
  tagline?: string;
  API_BASE_URL: string;
  S3_BASE_URL: string;
  /**
   * The image CDN: CloudFront in front of AWS's Serverless Image Handler,
   * reading the same bucket. It resizes, converts to WebP and caches at the
   * edge, so a 40pt avatar is a few KB rather than the whole upload. Unset,
   * images come straight from S3 as before.
   */
  IMAGE_CDN_URL?: string;
  /** The bucket the CDN reads — the one S3_BASE_URL points at. */
  IMAGE_BUCKET?: string;
  /**
   * The size `imageUrl` uses when a call doesn't say. `full` by default — the
   * original, still CDN-cached — so an app that zooms into photos (spot's
   * puzzles) never gets a downscaled one by accident. alfa sets `medium`.
   */
  IMAGE_DEFAULT_SIZE?: ImageSize;
  /**
   * The web client horacio verifies Google ID tokens against — the same one
   * alfa and murray use. It sets the token's `aud`, which is why a *web* id
   * belongs in a native app. Never change it without changing horacio's.
   */
  GOOGLE_WEB_CLIENT_ID: string;
  /**
   * This app's own iOS OAuth client. Google matches it to the bundle id, so
   * each app needs its own — alfa's will not work under another bundle.
   */
  GOOGLE_IOS_CLIENT_ID?: string;
  /** How often the signed-in profile is re-read. */
  USER_REFRESH_INTERVAL: number;
}

const DEFAULTS: AppConfig = {
  app: 'ors',
  appName: 'Open Road Society',
  API_BASE_URL: 'https://factory.openroadsociety.co',
  S3_BASE_URL: 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com',
  IMAGE_CDN_URL: 'https://d20vdmk08pvw54.cloudfront.net',
  IMAGE_BUCKET: 'partstash-ghia-images',
  IMAGE_DEFAULT_SIZE: 'full',
  GOOGLE_WEB_CLIENT_ID: '102801063030-8au92n7v1vhssgd8bbdabqi3ilrdf4l0.apps.googleusercontent.com',
  USER_REFRESH_INTERVAL: 900_000,
};

let current: AppConfig = DEFAULTS;

export function configureApp(overrides: Partial<AppConfig> & Pick<AppConfig, 'app' | 'appName'>): void {
  current = { ...DEFAULTS, ...overrides };
}

export function appConfig(): AppConfig {
  return current;
}

/** The header every request carries so the server knows which app it's serving. */
export const APP_HEADER = 'x-ors-app';

/**
 * How big an image is about to be drawn — what the CDN resizes it to.
 *
 * Widths are device pixels, so they allow for a 3x screen:
 * - `thumb`  (240): avatars, chips, anything under ~80pt.
 * - `small`  (540): grid tiles, shelf and strip cards, up to ~half the screen.
 * - `medium` (1200): full-width — feed photos, banners, posters.
 * - `full`: the original, untouched (still served and cached by the CDN). For
 *   anything zoomed into: the lightbox, a Car Spotter puzzle.
 *
 * Never upscaled: most uploads are 900px wide, and `medium` leaves those at
 * 900 and only re-encodes them as WebP.
 */
export type ImageSize = 'thumb' | 'small' | 'medium' | 'full';

const IMAGE_WIDTHS: Record<Exclude<ImageSize, 'full'>, number> = {
  thumb: 240,
  small: 540,
  medium: 1200,
};

/**
 * What the image handler can re-encode. A GIF would lose its animation and a
 * video isn't an image, so anything else comes straight from S3.
 */
const RESIZABLE = /\.(jpe?g|png|webp|heic|heif)$/i;

/** Base64 of an ASCII string — the handler's URL is base64'd JSON. */
const toBase64 = (text: string): string | null => {
  if (typeof globalThis.btoa !== 'function') return null;
  try {
    return globalThis.btoa(text);
  } catch {
    // btoa takes Latin-1 only; a filename outside it just skips the CDN.
    return null;
  }
};

export function imageUrl(filename: string | null | undefined, size?: ImageSize): string | null {
  if (!filename) return null;
  if (filename.startsWith('http') || filename.startsWith('file:')) return filename;
  const s3 = `${current.S3_BASE_URL}/${filename}`;
  const { IMAGE_CDN_URL: cdn, IMAGE_BUCKET: bucket } = current;
  if (!cdn || !bucket || !RESIZABLE.test(filename)) return s3;

  const shown = size ?? current.IMAGE_DEFAULT_SIZE ?? 'full';
  const request = shown === 'full'
    ? { bucket, key: filename }
    : {
        bucket,
        key: filename,
        edits: {
          resize: { width: IMAGE_WIDTHS[shown], withoutEnlargement: true },
          toFormat: 'webp',
          webp: { quality: 80 },
        },
      };
  const encoded = toBase64(JSON.stringify(request));
  return encoded ? `${cdn}/${encoded}` : s3;
}
