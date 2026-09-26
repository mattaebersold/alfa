import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** Tries per video, counting the first. */
const ATTEMPTS = 3;
/** Wait before each retry — long enough for a dropped connection to come back. */
const BACKOFF_MS = [2000, 6000];

const KEEP_AWAKE_TAG = 'mux-upload';

/** A status worth another go: the network, a timeout, or Mux having a moment. */
const retryable = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

class UploadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/**
 * Send one video file straight to Mux, and hand back its upload id.
 *
 * What made the plain one-shot PUT fragile, and what this does about it:
 *
 * - One dropped connection failed the whole post. Now a network error, a
 *   timeout or a 5xx is retried, twice, each time on a fresh upload URL — a
 *   half-written upload isn't something to resume onto.
 * - The screen could lock mid-upload. It's kept awake for the duration. (The
 *   transfer itself runs in a background URL session on iOS, so a switch to
 *   another app doesn't kill it either.)
 * - "Uploading video…" with no sign of movement for a minute reads as a hang,
 *   and people quit the app. `onProgress` reports 0–1 as bytes go out.
 */
export async function uploadVideoToMux(
  uri: string,
  getUploadUrl: () => Promise<{ id: string; url: string }>,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  try {
    await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  } catch { /* not worth failing an upload over */ }

  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 6000));
      onProgress?.(0);
      try {
        const { id, url } = await getUploadUrl();
        const task = FileSystem.createUploadTask(
          url,
          uri,
          {
            httpMethod: 'PUT',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            // Mux sniffs the container itself; this only has to be a video type.
            headers: { 'Content-Type': 'video/mp4' },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            if (totalBytesExpectedToSend > 0) onProgress?.(totalBytesSent / totalBytesExpectedToSend);
          },
        );
        const res = await task.uploadAsync();
        // Undefined when the task was cancelled.
        if (!res) throw new UploadError('Video upload was cancelled', -1);
        if (res.status >= 200 && res.status < 300) {
          onProgress?.(1);
          return id;
        }
        throw new UploadError(`Mux upload failed (${res.status})`, res.status);
      } catch (err) {
        lastError = err;
        // A thrown non-UploadError is the network (or the URL request) failing.
        const status = err instanceof UploadError ? err.status : 0;
        if (!retryable(status)) break;
      }
    }
    throw lastError;
  } finally {
    deactivateKeepAwake(KEEP_AWAKE_TAG);
  }
}

/** Longest side, in pixels — 1080p. What a post plays at; Mux streams it adaptively. */
const COMPRESS_MAX_SIZE = 1920;
/** ~6 Mbps: about 90 MB for the two minutes a post allows, down from several hundred. */
const COMPRESS_BITRATE = 6_000_000;
/** At or under this (MB) it's sent as it is — already small enough to go up quickly. */
const COMPRESS_MIN_MB = 15;

/**
 * Shrink a video before it's uploaded, and hand back the file to send.
 *
 * iOS's picker already exports library videos at 1080p, but Android's picker
 * has no such option, and camera recordings come out at whatever the phone
 * records — 4K on plenty of them. Size is what made uploads time out on a
 * phone connection, so everything over COMPRESS_MIN_MB is re-encoded here.
 *
 * Never fails: if compression errors — or this build of the app predates the
 * native compressor (an update delivered over the air to an older binary) —
 * the original file is sent instead. A slow upload beats no upload.
 */
export async function compressVideo(uri: string, onProgress?: (fraction: number) => void): Promise<string> {
  try {
    // Required here, not imported at the top: on a binary without the native
    // module the import itself throws, and this has to fall back instead.
    const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
    const out = await Video.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: COMPRESS_MAX_SIZE,
        bitrate: COMPRESS_BITRATE,
        minimumFileSizeForCompress: COMPRESS_MIN_MB,
        progressDivider: 5,
      },
      (progress) => onProgress?.(progress),
    );
    if (!out) return uri;
    // Upload tasks need a file:// URI; the compressor sometimes returns a bare path.
    return out.startsWith('/') ? `file://${out}` : out;
  } catch (err) {
    console.warn('[compressVideo] sending the original:', err);
    return uri;
  }
}
