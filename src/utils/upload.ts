import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Normalize a picked image to JPEG. iOS hands back HEIC by default, which the
 * server's sharp/libvips can't decode — so convert on-device before uploading.
 * Already-JPEG files pass through untouched. Falls back to the original uri if
 * conversion fails (better to attempt the upload than to drop the photo).
 */
export async function toUploadableJpeg(uri: string): Promise<string> {
  if (/\.jpe?g($|\?|#)/i.test(uri)) return uri;
  try {
    const { uri: jpegUri } = await manipulateAsync(uri, [], {
      compress: 0.85,
      format: SaveFormat.JPEG,
    });
    return jpegUri;
  } catch {
    return uri;
  }
}

/**
 * Map raw expo-image-picker assets to the `{ uri, name, type }` shape used
 * across the upload forms, converting each to JPEG first.
 */
export async function normalizePickedAssets(
  assets: { uri: string; fileName?: string | null; mimeType?: string | null }[],
): Promise<{ uri: string; name: string; type: string }[]> {
  return Promise.all(
    assets.map(async (a) => {
      const uri = await toUploadableJpeg(a.uri);
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
