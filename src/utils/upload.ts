import { Image } from 'react-native';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * The most a photo needs to be, on its long edge, to be uploaded.
 *
 * Phones hand back 12–48 megapixel originals; the server resizes everything
 * to 900 wide for cards and caps the full-size copy well under this, and a
 * phone screen can't show more. Shrinking here — before the bytes leave the
 * device — is what makes a post with six photos take seconds rather than a
 * minute, and spares horacio decoding six huge files one at a time.
 */
export const UPLOAD_MAX_EDGE = 2048;
/** JPEG quality for the upload: the point past which the file grows and the picture doesn't. */
export const UPLOAD_JPEG_QUALITY = 0.8;

/**
 * Normalize a picked image for upload: JPEG, and no bigger than
 * UPLOAD_MAX_EDGE on its long side.
 *
 * iOS hands back HEIC by default, which the server's sharp/libvips can't
 * decode — so it's converted on-device. Everything is re-encoded now, since
 * the downscale is the point: a 6 MB JPEG straight off the camera is the same
 * upload as a HEIC. `dims` are the picker's, when it has them; without them
 * the picture is measured first. Falls back to the original uri if anything
 * fails — better to attempt the upload than to drop the photo.
 */
export async function toUploadableJpeg(
  uri: string,
  dims?: { width?: number | null; height?: number | null },
): Promise<string> {
  try {
    let width = dims?.width ?? 0;
    let height = dims?.height ?? 0;
    if (!width || !height) {
      ({ width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)));
    }
    const long = Math.max(width, height);
    const actions = long > UPLOAD_MAX_EDGE
      ? [width >= height ? { resize: { width: UPLOAD_MAX_EDGE } } : { resize: { height: UPLOAD_MAX_EDGE } }]
      : [];
    const { uri: jpegUri } = await manipulateAsync(uri, actions, {
      compress: UPLOAD_JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    return jpegUri;
  } catch {
    return uri;
  }
}

/**
 * Map raw expo-image-picker assets to the `{ uri, name, type }` shape used
 * across the upload forms, each shrunk and converted to JPEG first.
 */
export async function normalizePickedAssets(
  assets: { uri: string; fileName?: string | null; mimeType?: string | null; width?: number | null; height?: number | null }[],
): Promise<{ uri: string; name: string; type: string }[]> {
  return Promise.all(
    assets.map(async (a) => {
      const uri = await toUploadableJpeg(a.uri, { width: a.width, height: a.height });
      const base = (a.fileName ?? `photo_${Date.now()}.jpg`).replace(/\.(heic|heif|png)$/i, '.jpg');
      return { uri, name: base, type: 'image/jpeg' };
    }),
  );
}

/**
 * Build a FormData file part for multipart uploads.
 *
 * This Expo SDK's global `fetch` is the WinterCG/spec-compliant implementation,
 * which only accepts `string | Blob | File` FormData parts. React Native's
 * classic `{ uri, name, type }` file shape is NOT supported and throws
 * "Unsupported FormDataPart implementation" at request time.
 *
 * `expo-file-system`'s `File` implements `Blob` and reads directly from a
 * `file://` URI, and exposes `.name`/`.type` so the multipart Content-Disposition
 * filename and Content-Type headers are set correctly for the server (multer).
 */
export function uploadFile(uri: string): any {
  return new File(uri);
}
