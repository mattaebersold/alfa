import { File } from 'expo-file-system';

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
