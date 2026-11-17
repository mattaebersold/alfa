import { useSyncExternalStore } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import { File, Directory, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { CONFIG } from '../constants/config';
import { getToken } from './token';
import { store } from '../store/store';
import { networkErrorSeen } from '../store/connectivitySlice';
import { apiService, patchProVideoCaches } from '../api/apiService';
import {
  formatBytes, formatDuration,
  type ProVideo, type ProVideoFields, type ProVideoMeta,
} from '../types/proVideos';

/**
 * Pro video uploads — the long-running half of Pro videos.
 *
 * A Pro video can be gigabytes and an hour long, sent from a phone on
 * whatever signal it has. The post upload (utils/muxUpload) is one PUT of the
 * whole file with a couple of retries from zero, which is fine for a two-minute
 * clip and hopeless for this: one dropped connection at 90% of 4 GB would
 * start it all over. So this module is a small upload manager that lives
 * outside any screen (leaving the Videos pane doesn't stop it) and is built
 * around one idea: **Mux's upload URL is resumable, so nothing that goes wrong
 * should ever cost more than one chunk.**
 *
 * The pieces, and what each guards against:
 *
 * 1. Pick — videos only, any length, and on iOS the original bytes
 *    (passthrough) rather than the picker's own re-encode: we compress here,
 *    once, and better.
 * 2. Prepare — re-encode on the phone's hardware encoder only when it pays
 *    (over 1080p, or a bitrate well above what Mux streams anyway), never
 *    when there isn't room on the disk for the output, and fall back to the
 *    original if anything about it fails.
 * 3. Validate — size, length and type against the server's own limits
 *    (/meta) before a single byte goes out, in words a person can act on.
 * 4. Send — chunk by chunk, each read straight off the disk (never the whole
 *    file in memory). After any failure Mux is *asked* where it got to rather
 *    than assumed, then it carries on from there, with exponential back-off
 *    and a pause while the phone is offline.
 * 5. Survive — the file is kept in the app's document directory and the job
 *    in a small JSON file, so a backgrounded or killed app picks the upload
 *    back up on its next launch or foreground, from wherever Mux says.
 * 6. Finish — tell the server, then watch the video through Mux's
 *    processing until it's ready, and only then delete the kept file.
 */

// ── Tunables ────────────────────────────────────────────────────────────────

const KiB = 1024;
const MiB = 1024 * KiB;
/** Mux (Google's resumable protocol underneath) wants chunks in multiples of this. */
const CHUNK_UNIT = 256 * KiB;
/**
 * Chunks start mid-sized and adapt: doubled after one that went up quickly,
 * halved after one that failed or crawled. There's no reliable way to ask
 * whether the phone is on cellular without NetInfo (not in this build), and
 * how long a chunk actually took is the better signal anyway — it's what a
 * failure costs to resend.
 */
const CHUNK_START = 8 * MiB;
const CHUNK_MAX = 16 * MiB;
const CHUNK_MIN = 1 * MiB;
/** A chunk faster than this earns a bigger next one; slower than SLOW, a smaller one. */
const CHUNK_FAST_MS = 10_000;
const CHUNK_SLOW_MS = 90_000;
/**
 * How long one chunk may take before it's given up on: a minute, plus the
 * chunk at a crawling 40 KB/s. Long enough not to abandon a slow but moving
 * upload; short enough that a dead socket doesn't hang the job for ever.
 */
const chunkTimeoutMs = (bytes: number) => 60_000 + (bytes / (40 * KiB)) * 1000;
/** Tries per chunk before the job is marked failed (with Retry offered). */
const MAX_CHUNK_TRIES = 10;
/** Back-off: 1s, 2s, 4s … capped at a minute, with jitter so retries from many phones don't line up. */
const backoffMs = (n: number) => Math.min(60_000, 1000 * 2 ** n) * (0.8 + Math.random() * 0.4);
/** Plain API calls (start, resume, complete, cancel). */
const API_TIMEOUT_MS = 30_000;
const API_TRIES = 5;

/** Above this, a source is re-encoded — Mux streams 1080p at well under it. */
const COMPRESS_ABOVE_BPS = 12_000_000;
/** What a re-encode aims for: 1080p (longest side) at ~10 Mbps — high quality, a fraction of a phone's 4K. */
const COMPRESS_MAX_SIZE = 1920;
const COMPRESS_BITRATE = 10_000_000;
/** Left free on the disk after anything we write — a full phone is worse than a slower upload. */
const DISK_HEADROOM = 500 * MiB;
/** An output that didn't come out at least this much smaller wasn't worth it; the original goes. */
const COMPRESS_MIN_SAVING = 0.9;

/** How often a video Mux is processing is checked on. */
const PROCESSING_POLL_MS = 15_000;
/** A video Mux couldn't process keeps its file this long, for Retry. */
const KEEP_ERRORED_MS = 3 * 24 * 60 * 60 * 1000;

const KEEP_AWAKE_TAG = 'pro-video-upload';
const DIR_NAME = 'pro-video-uploads';
const JOBS_FILE = 'jobs.json';

// ── Types ───────────────────────────────────────────────────────────────────

/** What the picker handed over, with what we could learn about it. */
export interface PickedVideo {
  uri: string;
  size: number;
  /** Seconds; null when the picker didn't say. */
  durationSecs: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  fileName: string | null;
}

export type ProVideoUploadPhase =
  | 'preparing' // compressing / copying on the phone
  | 'starting' // asking the server for an upload
  | 'uploading'
  | 'retrying' // waiting out a back-off
  | 'offline' // waiting for a connection
  | 'finishing'
  | 'failed';

/** One upload as the UI sees it. */
export interface ProVideoUpload {
  key: string;
  videoId: string | null;
  title: string;
  phase: ProVideoUploadPhase;
  /** 0–1 through the preparing phase. */
  prepared: number;
  /** Bytes Mux has confirmed, nudged forward by an estimate inside the chunk going up. */
  sent: number;
  total: number;
  /** Bytes a second, smoothed; null until a chunk has landed. */
  speed: number | null;
  /** Seconds left at that speed. */
  eta: number | null;
  /** Why it's waiting or why it failed, in words. */
  message: string | null;
  /** A failed one that can be tried again from where it got to. */
  canRetry: boolean;
}

/**
 * What's written to disk — enough to pick the upload up in a fresh launch.
 * No byte offset: Mux is the only one who knows that for certain, and it's
 * asked every time.
 */
interface UploadRecord {
  key: string;
  /** Whose — another account signing in on this phone must not touch it. */
  userId: string;
  videoId: string | null;
  /** Our kept copy (document directory), or the picker's file when there wasn't room for a copy. */
  fileUri: string;
  total: number;
  mimeType: string;
  fileName: string;
  durationSecs: number | null;
  fields: ProVideoFields;
  /** uploading: bytes still to send. processing: sent, Mux is encoding. errored: Mux failed it; file kept for Retry. failed: we gave up; Retry resumes. */
  stage: 'uploading' | 'processing' | 'errored' | 'failed';
  error?: string;
  savedAt: number;
}

interface Job {
  key: string;
  /** Null until preparing has produced the file to send. */
  rec: UploadRecord | null;
  source: PickedVideo | null;
  fields: ProVideoFields;
  userId: string;
  state: ProVideoUpload;
  running: boolean;
  cancelled: boolean;
  abort: AbortController | null;
  /** Ends the current back-off early — a return to the foreground, a cancel. */
  wake: (() => void) | null;
  compressionId: string | null;
  /** The chunk going up now, for the progress estimate between Mux's answers. */
  inflight: { from: number; bytes: number; startedAt: number } | null;
}

/** A failure the job can't get past on its own. `retryable`: Retry would pick it up again. */
class UploadFailure extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}
/** Mux refused the upload URL itself (cancelled, expired) — ask the server what to do. */
class UrlGone extends Error {}
class Cancelled extends Error {}

class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly body?: any) { super(message); }
}

// ── State, and how the UI hears about it ────────────────────────────────────

const jobs = new Map<string, Job>();
/** Videos sent and being processed by Mux — polled until they settle. */
const polling = new Map<string, ReturnType<typeof setTimeout> | null>();
let records: UploadRecord[] = [];
let snapshot: ProVideoUpload[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = [...jobs.values()].map((j) => ({ ...j.state, sent: shownSent(j) }));
  listeners.forEach((fn) => fn());
}

/**
 * Mux only answers once per chunk — every 8–16 MB — which on a slow link is
 * a bar that sits still for half a minute. Between answers the bar moves on
 * the measured speed, never past the end of the chunk in flight, and snaps to
 * Mux's figure when it comes.
 */
function shownSent(j: Job): number {
  const { sent, speed } = j.state;
  if (!j.inflight || !speed || j.state.phase !== 'uploading') return sent;
  const guess = speed * ((Date.now() - j.inflight.startedAt) / 1000);
  return Math.min(j.inflight.from + j.inflight.bytes * 0.97, sent + guess);
}

/** Uploads in progress or failed, for the banner. Processing ones are cards in the list instead. */
export function useProVideoUploads(): ProVideoUpload[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setState(j: Job, next: Partial<ProVideoUpload>) {
  j.state = { ...j.state, ...next };
  emit();
}

/** The bar's estimate moves on a timer while anything's going up. */
let ticker: ReturnType<typeof setInterval> | null = null;
function syncTicker() {
  const any = [...jobs.values()].some((j) => j.inflight);
  if (any && !ticker) ticker = setInterval(emit, 1000);
  if (!any && ticker) { clearInterval(ticker); ticker = null; }
}

// ── Disk ────────────────────────────────────────────────────────────────────

function uploadsDir(): Directory {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function fileExists(uri: string | null | undefined): boolean {
  if (!uri) return false;
  try { return new File(uri).exists; } catch { return false; }
}

function fileSize(uri: string): number {
  try { return new File(uri).size ?? 0; } catch { return 0; }
}

/** Never throws — a file we can't delete is the system's to clear, not a reason to fail. */
function deleteFile(uri: string | null | undefined) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch { /* nothing to do */ }
}

/** Only files we made: the kept copies in our folder. Never the member's own library. */
function isOurs(uri: string) {
  return uri.startsWith(uploadsDir().uri);
}

/** The picker's (or compressor's) scratch copy, in the cache — safe to drop once we have our own. */
function isScratch(uri: string) {
  try { return uri.startsWith(Paths.cache.uri); } catch { return false; }
}

async function freeBytes(): Promise<number> {
  try { return await LegacyFS.getFreeDiskStorageAsync(); } catch { return 0; }
}

/**
 * The job list, rewritten whole on every stage change (never per chunk —
 * the offset isn't kept, see UploadRecord). Written to a temp file and moved
 * over, so a kill mid-write leaves the old list rather than half a new one.
 */
function persist() {
  try {
    const dir = uploadsDir();
    const tmp = new File(dir, `${JOBS_FILE}.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.create();
    tmp.write(JSON.stringify(records));
    const dest = new File(dir, JOBS_FILE);
    if (dest.exists) dest.delete();
    tmp.moveSync(dest);
  } catch (err) {
    console.warn('[proVideoUpload] could not save the job list:', err);
  }
}

function loadRecords(): UploadRecord[] {
  try {
    const f = new File(uploadsDir(), JOBS_FILE);
    if (!f.exists) return [];
    const parsed = JSON.parse(f.textSync());
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.key === 'string' && typeof r.fileUri === 'string') : [];
  } catch {
    // A corrupt list is lost uploads, not a broken app.
    return [];
  }
}

/**
 * The list is read from disk on first use, whoever uses it first — never
 * written before it's been read, or a save would replace the jobs a
 * relaunch hasn't picked up yet with just the new one.
 */
let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  records = loadRecords();
}

function saveRecord(rec: UploadRecord) {
  ensureLoaded();
  rec.savedAt = Date.now();
  records = [...records.filter((r) => r.key !== rec.key), rec];
  persist();
}

function dropRecord(key: string, { keepFile = false } = {}) {
  ensureLoaded();
  const rec = records.find((r) => r.key === key);
  records = records.filter((r) => r.key !== key);
  persist();
  if (rec && !keepFile && isOurs(rec.fileUri)) deleteFile(rec.fileUri);
}

// ── Talking to horacio ──────────────────────────────────────────────────────

/**
 * A plain fetch rather than an RTK Query mutation: this runs outside React,
 * and needs the refusal's `code` and status to decide what happens next.
 */
async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError('Sign in to upload', 401);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${CONFIG.API_BASE_URL}/api/pro-videos${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch {
    throw new ApiError("Can't reach the server", 0);
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* an empty or HTML body */ }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code, data);
  return data as T;
}

/** Worth another go: the network, a timeout, the server or Mux having a moment. */
const transient = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

/** An API call, retried with back-off through transient failures. Refusals throw at once. */
async function apiWithRetry<T>(job: Job | null, method: string, path: string, body?: unknown, tries = API_TRIES): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await api<T>(method, path, body);
    } catch (err) {
      if (job?.cancelled) throw new Cancelled();
      const status = err instanceof ApiError ? err.status : 0;
      // 429 from our own server is a refusal (too many in flight, a day's
      // worth) with a sentence to show — not a rate limit to wait out.
      if (!(status === 0 || status === 408 || status >= 500) || n + 1 >= tries) throw err;
      if (status === 0) store.dispatch(networkErrorSeen());
      if (job) await sleep(job, backoffMs(n));
      else await new Promise((r) => setTimeout(r, backoffMs(n)));
    }
  }
}

let metaCache: ProVideoMeta | null = null;
async function getMeta(job: Job): Promise<ProVideoMeta> {
  if (metaCache) return metaCache;
  // The list screen will usually have it in the RTK cache already.
  const cached = apiService.endpoints.getProVideoMeta.select()(store.getState() as any)?.data;
  if (cached) return (metaCache = cached);
  return (metaCache = await apiWithRetry<ProVideoMeta>(job, 'GET', '/meta'));
}

/** The list (and every cached copy of this video) told something changed. */
function refreshLists() {
  store.dispatch(apiService.util.invalidateTags([{ type: 'ProVideo', id: 'LIST' }]));
}

// ── Keeping the phone working ───────────────────────────────────────────────

let awakeHolds = 0;
/**
 * While anything is preparing or sending: the screen kept on (a locked phone
 * suspends the app), and on iOS a background task, which buys the upload
 * half a minute or so after a switch to another app instead of none. The
 * task comes from react-native-compressor, required defensively as
 * compressVideo does — an over-the-air update can land on a binary without
 * it. iOS only: on Android the same call starts a foreground service, which
 * needs a notification permission and manifest entry this app doesn't have.
 */
function holdAwake(on: boolean) {
  const was = awakeHolds;
  awakeHolds = Math.max(0, awakeHolds + (on ? 1 : -1));
  if (was === 0 && awakeHolds > 0) {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    if (Platform.OS === 'ios') {
      try {
        const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
        Video.activateBackgroundTask(() => {}).catch(() => {});
      } catch { /* older binary */ }
    }
  } else if (was > 0 && awakeHolds === 0) {
    try { deactivateKeepAwake(KEEP_AWAKE_TAG); } catch { /* not worth failing over */ }
    if (Platform.OS === 'ios') {
      try {
        const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
        Video.deactivateBackgroundTask().catch(() => {});
      } catch { /* older binary */ }
    }
  }
}

/** A wait that a cancel or a return to the app can cut short. */
function sleep(job: Job, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); if (job.wake === done) job.wake = null; resolve(); };
    const timer = setTimeout(done, ms);
    job.wake = done;
  });
}

/**
 * Hold while the phone is offline. Uses the app's own connectivity state
 * (store/connectivitySlice — set by probing real hosts after a failure,
 * which is what our failures report into). NetInfo would be quicker to hear
 * about it, but it's a native module this build doesn't have. Never waits
 * more than a minute on that state's word alone: a stale "offline" mustn't
 * park an upload for good — the next try finds out for itself.
 */
async function waitOnline(job: Job) {
  if (store.getState().connectivity.online) return;
  const before = job.state.phase;
  setState(job, { phase: 'offline', message: 'Waiting for a connection…' });
  await new Promise<void>((resolve) => {
    let unsub = () => {};
    const done = () => { unsub(); clearTimeout(timer); if (job.wake === done) job.wake = null; resolve(); };
    const timer = setTimeout(done, 60_000);
    unsub = store.subscribe(() => { if (store.getState().connectivity.online) done(); });
    job.wake = done;
  });
  if (job.cancelled) throw new Cancelled();
  setState(job, { phase: before === 'offline' ? 'uploading' : before, message: null });
}

// ── 1. Picking ──────────────────────────────────────────────────────────────

/**
 * One video from the library. Null when the member backs out.
 *
 * `videoMaxDuration: 0` is "no limit" — a Pro video is meant to be long.
 * `Passthrough` on iOS hands over the original file: the picker's default
 * re-encodes to its own preset first, which takes minutes on a long video,
 * can lose quality, and then we'd compress it a second time.
 */
export async function pickProVideo(): Promise<PickedVideo | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    videoMaxDuration: 0,
    videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
    // The file as it's stored, not a "compatible" (re-encoded) copy.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  let size = a.fileSize ?? 0;
  if (!size) {
    size = fileSize(a.uri);
    if (!size) {
      try {
        const info = await LegacyFS.getInfoAsync(a.uri);
        size = info.exists ? (info.size ?? 0) : 0;
      } catch { /* left at 0 — refused below with a message */ }
    }
  }
  return {
    uri: a.uri,
    size,
    // The picker reports milliseconds.
    durationSecs: a.duration ? a.duration / 1000 : null,
    width: a.width || null,
    height: a.height || null,
    mimeType: a.mimeType ?? null,
    fileName: a.fileName ?? a.uri.split('/').pop() ?? null,
  };
}

// ── 2. Preparing ────────────────────────────────────────────────────────────

/** Re-encode only when it pays: over 1080p, or a bitrate far above what Mux will stream. */
function shouldCompress(v: PickedVideo): boolean {
  const long = Math.max(v.width ?? 0, v.height ?? 0);
  const short = Math.min(v.width ?? 0, v.height ?? 0);
  if (long > 1920 || short > 1080) return true;
  if (v.durationSecs && v.durationSecs > 0 && v.size > 0) {
    return (v.size * 8) / v.durationSecs > COMPRESS_ABOVE_BPS;
  }
  return false;
}

const extOf = (name: string | null | undefined) => {
  const m = name?.match(/\.[a-z0-9]+$/i);
  return m ? m[0].toLowerCase() : '';
};

/** "1 h 20 min", "45 min" — a length in the words the refusal uses. */
function hoursMinutes(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${m} min`;
}

/**
 * Turn the picked video into the file we'll send, kept somewhere it'll
 * survive the app being closed, and refuse it here — before any upload is
 * started — if the server would.
 */
async function prepare(job: Job): Promise<UploadRecord> {
  const src = job.source!;
  setState(job, { phase: 'preparing', prepared: 0, message: null });
  const meta = await getMeta(job);

  if (!src.size) throw new UploadFailure("Couldn't read that video's size. Try picking it again.", false);
  // Length first: it's known now, and no re-encode makes a video shorter.
  if (src.durationSecs && src.durationSecs > meta.max_duration_secs) {
    throw new UploadFailure(
      `That video is ${hoursMinutes(src.durationSecs)} long — the most is ${hoursMinutes(meta.max_duration_secs)}.`,
      false,
    );
  }

  let out = src.uri;
  let mimeType = src.mimeType ?? '';
  let fileName = src.fileName ?? 'video.mp4';
  if (shouldCompress(src)) {
    // The output's likely size, at the target bitrate plus a margin for audio
    // and container. Without room for it the compressor would fail partway,
    // or worse, fill the phone — so it's skipped and the original goes.
    const estimate = src.durationSecs ? (src.durationSecs * COMPRESS_BITRATE) / 8 * 1.15 : src.size;
    if ((await freeBytes()) > estimate + DISK_HEADROOM) {
      const compressed = await compress(job, src);
      if (job.cancelled) { if (compressed && compressed !== src.uri) deleteFile(compressed); throw new Cancelled(); }
      if (compressed && compressed !== src.uri) {
        // A source already near the target comes back barely smaller, having
        // lost a generation of quality for nothing: send the original then.
        if (fileSize(compressed) > 0 && fileSize(compressed) < src.size * COMPRESS_MIN_SAVING) {
          out = compressed;
          mimeType = 'video/mp4';
          fileName = fileName.replace(/\.[a-z0-9]+$/i, '') + '.mp4';
        } else {
          deleteFile(compressed);
        }
      }
    }
  }
  if (job.cancelled) throw new Cancelled();

  const total = fileSize(out) || src.size;
  if (total > meta.max_bytes) {
    if (out !== src.uri) deleteFile(out);
    throw new UploadFailure(`That's ${formatBytes(total)} — the most is ${formatBytes(meta.max_bytes)}.`, false);
  }
  const ext = extOf(fileName) || extOf(out);
  const typeOk = (!mimeType && !ext)
    || meta.accepted_types.includes(mimeType.toLowerCase())
    || meta.accepted_extensions.includes(ext);
  if (!typeOk) {
    if (out !== src.uri) deleteFile(out);
    throw new UploadFailure(`Upload an ${meta.accepted_extensions.join(' or ')} video.`, false);
  }

  // Into the document directory. The picker's and the compressor's files
  // live in the cache, which iOS and Android both clear when they need room —
  // and the upload must still have its file when the app is next opened.
  // A compressor output is moved (no extra space); the original is copied,
  // if there's room for it, and the picker's scratch copy then dropped.
  const dest = new File(uploadsDir(), `${job.key}${ext || '.mp4'}`);
  let fileUri = out;
  try {
    if (out !== src.uri) {
      await new File(out).move(dest);
      fileUri = dest.uri;
    } else if ((await freeBytes()) > total + DISK_HEADROOM) {
      await new File(out).copy(dest);
      fileUri = dest.uri;
      if (isScratch(src.uri)) deleteFile(src.uri);
    }
    // Otherwise: no room for a second copy. The upload goes from the
    // picker's file — fine while the app stays open, but a kill may lose it.
  } catch (err) {
    console.warn('[proVideoUpload] keeping the file failed, sending from where it is:', err);
    deleteFile(dest.uri);
    fileUri = out;
  }
  setState(job, { prepared: 1, total });

  return {
    key: job.key,
    userId: job.userId,
    videoId: null,
    fileUri,
    total,
    mimeType: mimeType || (ext === '.mov' ? 'video/quicktime' : 'video/mp4'),
    fileName,
    durationSecs: src.durationSecs,
    fields: job.fields,
    stage: 'uploading',
    savedAt: Date.now(),
  };
}

/**
 * The phone's hardware encoder, through react-native-compressor. Null when
 * it isn't available or fails — the caller sends the original. Required
 * here rather than imported, as in compressVideo (utils/muxUpload): on a
 * binary without the native module the import itself throws.
 */
async function compress(job: Job, src: PickedVideo): Promise<string | null> {
  try {
    const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
    const out = await Video.compress(
      src.uri,
      {
        compressionMethod: 'manual',
        maxSize: COMPRESS_MAX_SIZE,
        bitrate: COMPRESS_BITRATE,
        minimumFileSizeForCompress: 0,
        progressDivider: 2,
        getCancellationId: (id) => { job.compressionId = id; },
      },
      (p) => setState(job, { prepared: Math.min(0.99, p) }),
    );
    job.compressionId = null;
    if (!out) return null;
    return out.startsWith('/') ? `file://${out}` : out;
  } catch (err) {
    job.compressionId = null;
    if (!job.cancelled) console.warn('[proVideoUpload] compression failed, sending the original:', err);
    return null;
  }
}

// ── 3–4. Starting and sending ───────────────────────────────────────────────

/** POST /uploads — the video record, and Mux's URL for its bytes. */
async function begin(job: Job, rec: UploadRecord): Promise<string> {
  setState(job, { phase: 'starting', message: null });
  try {
    // Fewer tries than other calls: a start that reached the server but lost
    // its answer leaves a stray 'uploading' record (swept by the server), and
    // each retry could add another.
    const res = await apiWithRetry<{ video: ProVideo; upload_url: string }>(job, 'POST', '/uploads', {
      ...rec.fields,
      file_size: rec.total,
      mime_type: rec.mimeType,
      file_name: rec.fileName,
      duration_secs: rec.durationSecs ?? undefined,
      source: Platform.OS === 'android' ? 'android' : 'ios',
    }, 3);
    rec.videoId = res.video.internal_id;
    rec.stage = 'uploading';
    saveRecord(rec);
    setState(job, { videoId: rec.videoId });
    refreshLists();
    return res.upload_url;
  } catch (err) {
    if (err instanceof Cancelled) throw err;
    if (err instanceof ApiError) {
      // The server's own sentence: "That file is 12.4 GB — the most …", "You
      // have 3 uploads going already …". Transient ones can be retried.
      throw new UploadFailure(
        err.code === 'pro_required' ? 'Pro videos are for Pro members.' : err.message,
        transient(err.status),
      );
    }
    throw err;
  }
}

type ResumeAnswer =
  | { kind: 'url'; url: string }
  | { kind: 'received' } // Mux has every byte already
  | { kind: 'restart' } // the URL expired: start a new upload from the kept file
  | { kind: 'gone' }; // deleted or cancelled elsewhere: nothing to do

/** POST /:id/upload-url — the URL again, after a relaunch or a refusal from Mux. */
async function resumeUrl(job: Job, rec: UploadRecord): Promise<ResumeAnswer> {
  setState(job, { phase: 'starting', message: 'Picking up where it left off…' });
  try {
    const res = await apiWithRetry<{ upload_url: string }>(job, 'POST', `/${rec.videoId}/upload-url`);
    return { kind: 'url', url: res.upload_url };
  } catch (err) {
    if (err instanceof Cancelled) throw err;
    if (!(err instanceof ApiError)) throw err;
    if (err.status === 409 && (err.code === 'already_received' || err.body?.status === 'processing')) return { kind: 'received' };
    if (err.status === 410) return { kind: 'restart' };
    // 'not_uploading' and errored: the server failed it (an expired upload it
    // noticed first, say). From the kept file it can simply go again.
    if (err.status === 409 && err.body?.status === 'errored') return { kind: 'restart' };
    if (err.status === 404 || (err.status === 409 && err.body?.status === 'cancelled')) return { kind: 'gone' };
    if (err.status === 409) return { kind: 'received' };
    throw new UploadFailure(err.code === 'pro_required' ? 'Pro videos are for Pro members.' : err.message, transient(err.status));
  }
}

/**
 * Where Mux has got to: an empty PUT with `Content-Range: bytes * /total`.
 * 308 with `Range: bytes=0-N` → N+1 bytes are safely there (no Range: none);
 * 200/201 → all of it. Null when it couldn't be asked (the network again).
 */
async function queryOffset(url: string, total: number): Promise<number | 'complete' | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), API_TIMEOUT_MS);
  try {
    const res = await expoFetch(url, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes */${total}` },
      body: new Uint8Array(0),
      // Mux's 308 is "resume incomplete", not a redirect — never follow it.
      redirect: 'manual',
      signal: ctl.signal,
    });
    if (res.status === 200 || res.status === 201) return 'complete';
    if (res.status === 308) return rangeEnd(res.headers.get('range'));
    if (transient(res.status)) return null;
    throw new UrlGone(`Mux answered ${res.status}`);
  } catch (err) {
    if (err instanceof UrlGone) throw err;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** `bytes=0-1048575` → 1048576, the next byte to send. No header: nothing yet. */
function rangeEnd(range: string | null): number {
  const m = range?.match(/bytes=\d+-(\d+)/i);
  return m ? Number(m[1]) + 1 : 0;
}

/**
 * Read `bytes` from `offset` straight off the disk — one chunk in memory,
 * never the file. The new FileHandle reads synchronously; at 16 MB that's a
 * few milliseconds of the JS thread per chunk.
 */
function readChunk(uri: string, offset: number, bytes: number): Uint8Array<ArrayBuffer> {
  const handle = new File(uri).open();
  try {
    handle.offset = offset;
    const out = handle.readBytes(bytes);
    if (out.byteLength !== bytes) throw new Error(`read ${out.byteLength} of ${bytes} bytes`);
    return out;
  } finally {
    try { handle.close(); } catch { /* already closed */ }
  }
}

/** The bytes Mux has, from here on: every chunk, every retry. */
async function sendChunks(job: Job, rec: UploadRecord, url: string, fresh: boolean) {
  const total = rec.total;
  let offset = 0;
  let failures = 0;
  if (!fresh) {
    // Never assume: a chunk can land and its answer still be lost, and
    // Mux can also have less than we sent. Its word is the only offset —
    // so it's asked until it answers, rather than guessing 0 and sending
    // gigabytes it may already have.
    for (;;) {
      if (job.cancelled) throw new Cancelled();
      await waitOnline(job);
      const at = await queryOffset(url, total);
      if (at === 'complete') return;
      if (typeof at === 'number') { offset = at; break; }
      failures += 1;
      if (failures >= MAX_CHUNK_TRIES) {
        throw new UploadFailure("Couldn't reach the video service. It will carry on from where it stopped when you retry.", true);
      }
      const wait = backoffMs(failures - 1);
      setState(job, { phase: 'retrying', message: `Can't reach the video service — trying again in ${Math.max(1, Math.round(wait / 1000))}s` });
      await sleep(job, wait);
    }
    failures = 0;
  }
  setState(job, { phase: 'uploading', sent: offset, total, message: null });

  let chunk = CHUNK_START;
  while (offset < total) {
    if (job.cancelled) throw new Cancelled();
    await waitOnline(job);
    if (!fileExists(rec.fileUri)) {
      throw new UploadFailure("The video file isn't on this phone any more. Pick it again to upload it.", false);
    }

    const bytes = Math.min(chunk, total - offset);
    const last = offset + bytes - 1;
    let body: Uint8Array<ArrayBuffer>;
    try {
      body = readChunk(rec.fileUri, offset, bytes);
    } catch (err) {
      console.warn('[proVideoUpload] read failed:', err);
      throw new UploadFailure("Couldn't read the video file. Pick it again to upload it.", false);
    }

    const startedAt = Date.now();
    job.inflight = { from: offset, bytes, startedAt };
    syncTicker();
    setState(job, { phase: 'uploading', message: null });
    let status = 0;
    let range: string | null = null;
    job.abort = new AbortController();
    const timer = setTimeout(() => job.abort?.abort(), chunkTimeoutMs(bytes));
    try {
      const res = await expoFetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': rec.mimeType || 'video/mp4',
          'Content-Range': `bytes ${offset}-${last}/${total}`,
        },
        body,
        // Mux answers each chunk with 308 ("resume incomplete", with a Range
        // header) — never a redirect to follow.
        redirect: 'manual',
        signal: job.abort.signal,
      });
      status = res.status;
      range = res.headers.get('range');
    } catch {
      if (job.cancelled) throw new Cancelled();
      status = 0; // the network, or our timeout
      store.dispatch(networkErrorSeen());
    } finally {
      clearTimeout(timer);
      job.abort = null;
      job.inflight = null;
      syncTicker();
    }
    const took = Date.now() - startedAt;

    if (status === 200 || status === 201) {
      // The last byte is in.
      offset = total;
      setState(job, { sent: total, eta: 0 });
      break;
    }
    if (status === 308) {
      // Taken — as far as Mux's Range says, which is what we go on.
      const next = rangeEnd(range);
      const landed = next - offset;
      if (landed > 0) {
        const rate = landed / Math.max(0.25, took / 1000);
        const speed = job.state.speed ? job.state.speed * 0.6 + rate * 0.4 : rate;
        setState(job, { speed, eta: (total - next) / speed });
        failures = 0;
        if (took < CHUNK_FAST_MS) chunk = Math.min(CHUNK_MAX, chunk * 2);
        else if (took > CHUNK_SLOW_MS) chunk = Math.max(CHUNK_MIN, roundChunk(chunk / 2));
        offset = next;
        setState(job, { sent: offset });
        continue;
      }
      // Answered, but nothing taken: treat as a failure (back off, ask again)
      // rather than resending the same chunk in a tight loop.
      offset = Math.min(offset, next);
    } else if (!transient(status)) {
      // 4xx from Mux: the URL is cancelled or expired — the server decides what's next.
      throw new UrlGone(`Mux answered ${status}`);
    }

    // The network, a timeout, a 5xx or 429 (or a 308 that took nothing):
    // wait, then ask Mux where it got to.
    failures += 1;
    if (failures >= MAX_CHUNK_TRIES) {
      throw new UploadFailure('The connection keeps dropping. It will carry on from where it stopped when you retry.', true);
    }
    // Smaller next time: a flaky link loses less with each failure.
    chunk = Math.max(CHUNK_MIN, roundChunk(chunk / 2));
    const wait = backoffMs(failures - 1);
    setState(job, { phase: 'retrying', message: `Connection lost — trying again in ${Math.max(1, Math.round(wait / 1000))}s` });
    await sleep(job, wait);
    if (job.cancelled) throw new Cancelled();
    const at = await queryOffset(url, total);
    if (at === 'complete') { offset = total; break; }
    if (typeof at === 'number') { offset = at; setState(job, { sent: offset }); }
    // Couldn't ask: try the same chunk again, and ask again after.
  }
}

/** A chunk size rounded down to whole 256 KiB units, as Mux requires. */
const roundChunk = (n: number) => Math.max(CHUNK_UNIT, Math.floor(n / CHUNK_UNIT) * CHUNK_UNIT);

// ── 6. Finishing, and watching it process ───────────────────────────────────

/**
 * The last byte's in: tell the server, which moves the card to Processing.
 * Mux's webhook confirms on its own, so a call that won't go through is
 * shrugged off rather than failing an upload that actually worked.
 */
async function finish(job: Job, rec: UploadRecord) {
  setState(job, { phase: 'finishing', sent: rec.total, message: null });
  try {
    const video = await apiWithRetry<ProVideo>(job, 'POST', `/${rec.videoId}/upload-complete`, undefined, 8);
    if (video?.internal_id) patchProVideoCaches(store.dispatch, store.getState, video.internal_id, (v) => { Object.assign(v, video); });
  } catch (err) {
    if (err instanceof Cancelled) throw err;
    console.warn('[proVideoUpload] upload-complete failed (the webhook will catch up):', err);
  }
  rec.stage = 'processing';
  saveRecord(rec);
  jobs.delete(job.key);
  emit();
  refreshLists();
  watchProcessing(rec.key);
}

/**
 * Check on a video Mux is encoding every PROCESSING_POLL_MS until it's ready
 * or has failed, updating every cached copy so its card changes on its own.
 * Ready: the kept file is finally deleted. Errored: kept a few days, for
 * Retry. Paused while the app's in the background; picked up on return.
 */
function watchProcessing(key: string) {
  if (polling.get(key)) return;
  const tick = async () => {
    polling.set(key, null);
    const rec = records.find((r) => r.key === key);
    if (!rec || rec.stage !== 'processing' || !rec.videoId) { polling.delete(key); return; }
    if (AppState.currentState !== 'active') { polling.delete(key); return; }
    try {
      const video = await api<ProVideo>('GET', `/${rec.videoId}`);
      if (video.status !== 'processing' && video.status !== 'uploading') {
        patchProVideoCaches(store.dispatch, store.getState, video.internal_id, (v) => { Object.assign(v, video); });
        refreshLists();
        if (video.status === 'errored') {
          rec.stage = 'errored';
          rec.error = video.error?.message;
          saveRecord(rec);
        } else {
          dropRecord(key);
        }
        polling.delete(key);
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 401 || err.status === 403)) {
        // Deleted, or no longer ours to see: nothing left to watch.
        if (err.status === 404) dropRecord(key);
        polling.delete(key);
        return;
      }
      // The network: just try again on the next tick.
    }
    polling.set(key, setTimeout(tick, PROCESSING_POLL_MS));
  };
  polling.set(key, setTimeout(tick, PROCESSING_POLL_MS));
}

// ── Running a job ───────────────────────────────────────────────────────────

function blankState(key: string, title: string): ProVideoUpload {
  return {
    key, videoId: null, title, phase: 'preparing', prepared: 0, sent: 0, total: 0,
    speed: null, eta: null, message: null, canRetry: false,
  };
}

async function run(job: Job) {
  if (job.running) return;
  job.running = true;
  job.cancelled = false;
  holdAwake(true);
  try {
    if (!job.rec) {
      // Saved as soon as the file is kept: a kill from here on resumes.
      job.rec = await prepare(job);
      saveRecord(job.rec);
    }
    const rec = job.rec;
    setState(job, { total: rec.total, sent: 0, message: null, canRetry: false });
    if (!fileExists(rec.fileUri)) {
      throw new UploadFailure("The video file isn't on this phone any more. Pick it again to upload it.", false);
    }

    // Each pass gets a URL and sends to it. A refusal from Mux mid-way
    // (UrlGone) goes round again through the server, which says whether to
    // resume, start afresh from the kept file, or stop. Bounded, so a
    // confused server can't spin it forever.
    for (let pass = 0; pass < 3; pass++) {
      if (job.cancelled) throw new Cancelled();
      let url: string;
      let fresh = false;
      if (!rec.videoId) {
        url = await begin(job, rec);
        fresh = true;
      } else {
        const answer = await resumeUrl(job, rec);
        if (answer.kind === 'received') { await finish(job, rec); return; }
        if (answer.kind === 'gone') { forget(job); return; }
        if (answer.kind === 'restart') {
          rec.videoId = null;
          saveRecord(rec);
          continue;
        }
        url = answer.url;
      }
      try {
        await sendChunks(job, rec, url, fresh);
      } catch (err) {
        if (err instanceof UrlGone) continue;
        throw err;
      }
      await finish(job, rec);
      return;
    }
    throw new UploadFailure("The upload couldn't be resumed. Try again.", true);
  } catch (err) {
    if (err instanceof Cancelled || job.cancelled) {
      // Cancelled while a step was in flight — a prepare that finished, a
      // start the server answered — can have saved a record after the
      // cancel's own cleanup ran. Clean up again, or it resumes next launch.
      if (job.rec && records.some((r) => r.key === job.key)) cleanup(job);
      return;
    }
    const failure = err instanceof UploadFailure
      ? err
      : new UploadFailure(err instanceof ApiError ? err.message : 'Something went wrong with the upload.', true);
    if (!(err instanceof UploadFailure)) console.warn('[proVideoUpload] failed:', err);
    // Retryable only with something to send: the kept file, or (failing
    // before it was made — the server unreachable for /meta, say) the pick.
    const canRetry = failure.retryable && (job.rec ? fileExists(job.rec.fileUri) : !!job.source && fileExists(job.source.uri));
    if (canRetry && job.rec) {
      job.rec.stage = 'failed';
      job.rec.error = failure.message;
      saveRecord(job.rec);
    } else {
      // Final: nothing to come back to, so nothing kept. The server's record
      // (if one was made) is cancelled so it doesn't sit in My uploads.
      cleanup(job);
    }
    setState(job, { phase: 'failed', message: failure.message, canRetry });
  } finally {
    job.inflight = null;
    syncTicker();
    job.running = false;
    holdAwake(false);
  }
}

/** Files and records for a job that's over. */
function cleanup(job: Job) {
  if (job.rec) {
    const videoId = job.rec.videoId;
    dropRecord(job.key);
    if (videoId) {
      api('POST', `/${videoId}/cancel`).then(refreshLists, () => {});
    }
  }
}

/** Deleted or cancelled somewhere else: drop it quietly. */
function forget(job: Job) {
  dropRecord(job.key);
  jobs.delete(job.key);
  emit();
  refreshLists();
}

// ── Starting up, and coming back ────────────────────────────────────────────

let started = false;
let startedFor: string | null = null;

/**
 * Pick up whatever was left: uploads part-sent before the app was closed,
 * videos still processing, failed ones (shown, waiting for Retry). Call it
 * once signed in as a Pro member (FeedScreen does); safe to call again.
 * Also sweeps our folder of files no job owns — a kill mid-copy leaves one.
 */
export function resumeProVideoUploads(userId: string | null | undefined) {
  if (!userId) return;
  if (started && startedFor === userId) return;
  started = true;
  startedFor = userId;
  ensureLoaded();

  const now = Date.now();
  for (const rec of [...records]) {
    if (rec.userId !== userId) continue;
    if (rec.stage === 'errored' && now - rec.savedAt > KEEP_ERRORED_MS) { dropRecord(rec.key); continue; }
    if (rec.stage === 'processing') { watchProcessing(rec.key); continue; }
    if (rec.stage === 'errored') continue;
    if (jobs.has(rec.key)) continue;
    const job = newJob(rec.key, rec.fields, userId, rec);
    if (!fileExists(rec.fileUri)) {
      dropRecord(rec.key);
      setState(job, { phase: 'failed', message: "The video file isn't on this phone any more. Pick it again to upload it.", canRetry: false });
      if (rec.videoId) api('POST', `/${rec.videoId}/cancel`).then(refreshLists, () => {});
      continue;
    }
    if (rec.stage === 'failed') {
      setState(job, { phase: 'failed', message: rec.error ?? 'The upload stopped.', canRetry: true, videoId: rec.videoId, total: rec.total });
    } else {
      run(job);
    }
  }
  sweepOrphans();

  if (!listening) {
    listening = true;
    AppState.addEventListener('change', onAppState);
  }
}
let listening = false;

function onAppState(next: AppStateStatus) {
  if (next !== 'active') return;
  // Back in the app: anything waiting out a back-off goes now — the
  // failure was very likely the suspension itself — and anything that was
  // killed off while away starts again.
  for (const job of jobs.values()) {
    if (job.running) job.wake?.();
    else if (job.rec?.stage === 'uploading') run(job);
  }
  for (const rec of records) {
    if (rec.stage === 'processing' && rec.userId === startedFor) watchProcessing(rec.key);
  }
}

function sweepOrphans() {
  try {
    const owned = new Set(records.map((r) => r.fileUri));
    for (const entry of uploadsDir().list()) {
      if (!(entry instanceof File)) continue;
      if (entry.uri.endsWith(JOBS_FILE) || entry.uri.endsWith(`${JOBS_FILE}.tmp`)) continue;
      if (!owned.has(entry.uri) && ![...jobs.keys()].some((k) => entry.uri.includes(k))) entry.delete();
    }
  } catch { /* nothing to sweep */ }
}

function newJob(key: string, fields: ProVideoFields, userId: string, rec: UploadRecord | null, source: PickedVideo | null = null): Job {
  const job: Job = {
    key, rec, source, fields, userId,
    state: { ...blankState(key, fields.title), videoId: rec?.videoId ?? null, total: rec?.total ?? 0 },
    running: false, cancelled: false, abort: null, wake: null, compressionId: null, inflight: null,
  };
  jobs.set(key, job);
  emit();
  return job;
}

// ── What the UI calls ───────────────────────────────────────────────────────

/** Start uploading a picked video. Returns at once; progress comes through useProVideoUploads. */
export function startProVideoUpload(video: PickedVideo, fields: ProVideoFields, userId: string): string {
  const key = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const job = newJob(key, fields, userId, null, video);
  run(job);
  return key;
}

/** Try a failed upload again — from where Mux says it got to, not from zero. */
export function retryProVideoUpload(key: string) {
  const job = jobs.get(key);
  if (!job || job.running) return;
  if (job.rec) { job.rec.stage = 'uploading'; job.rec.error = undefined; saveRecord(job.rec); }
  run(job);
}

/** Stop an upload: no more bytes, the server told, the kept file deleted. */
export function cancelProVideoUpload(key: string) {
  const job = jobs.get(key);
  if (!job) return;
  job.cancelled = true;
  job.abort?.abort();
  job.wake?.();
  if (job.compressionId) {
    try {
      const { Video } = require('react-native-compressor') as typeof import('react-native-compressor');
      Video.cancelCompression(job.compressionId);
    } catch { /* nothing running */ }
  }
  jobs.delete(key);
  emit();
  cleanup(job);
}

/** Take a failed upload off the banner. Same as cancelling — nothing's kept. */
export const dismissProVideoUpload = cancelProVideoUpload;

/** Whether a video Mux couldn't process still has its file here, for Retry. */
export function canRetryProVideo(videoId: string): boolean {
  ensureLoaded();
  const rec = records.find((r) => r.videoId === videoId && r.stage === 'errored');
  return !!rec && fileExists(rec.fileUri);
}

/**
 * Retry a video Mux failed to process: the old record cancelled, and a new
 * upload started from the kept file with the same details. False when the
 * file's gone — the member has to pick the video again.
 */
export function retryErroredProVideo(videoId: string): boolean {
  ensureLoaded();
  const rec = records.find((r) => r.videoId === videoId && r.stage === 'errored');
  if (!rec || !fileExists(rec.fileUri)) return false;
  api('POST', `/${videoId}/cancel`).then(refreshLists, () => {});
  rec.videoId = null;
  rec.stage = 'uploading';
  rec.error = undefined;
  saveRecord(rec);
  const job = newJob(rec.key, rec.fields, rec.userId, rec);
  run(job);
  return true;
}

/** The member deleted the video: stop anything still going for it and drop its file. */
export function forgetProVideo(videoId: string) {
  ensureLoaded();
  for (const job of jobs.values()) {
    if (job.rec?.videoId === videoId || job.state.videoId === videoId) {
      job.cancelled = true;
      job.abort?.abort();
      job.wake?.();
      jobs.delete(job.key);
    }
  }
  for (const rec of records.filter((r) => r.videoId === videoId)) dropRecord(rec.key);
  emit();
}

/**
 * Cancel a video still uploading, from its card in My uploads — whether this
 * phone is sending it or not (another phone, or a run that was killed).
 */
export function cancelProVideo(videoId: string) {
  const job = [...jobs.values()].find((j) => j.state.videoId === videoId || j.rec?.videoId === videoId);
  if (job) { cancelProVideoUpload(job.key); return; }
  forgetProVideo(videoId);
  api('POST', `/${videoId}/cancel`).then(refreshLists, refreshLists);
}

/** Whether this phone is sending (or preparing) this video now — its card says "Uploading" with our progress. */
export function isUploadingHere(videoId: string): boolean {
  return [...jobs.values()].some((j) => j.state.videoId === videoId && j.state.phase !== 'failed');
}

/** For the uploads banner's line: "1.2 GB of 3.4 GB · 4 min left". */
export function describeProgress(u: ProVideoUpload): string {
  if (u.phase === 'preparing') return `Preparing… ${Math.round(u.prepared * 100)}%`;
  if (u.phase === 'starting') return u.message ?? 'Starting…';
  if (u.phase === 'finishing') return 'Finishing…';
  if (u.phase === 'failed') return u.message ?? 'The upload stopped.';
  if (u.phase === 'retrying' || u.phase === 'offline') return u.message ?? 'Waiting…';
  const parts = [`${formatBytes(u.sent)} of ${formatBytes(u.total)}`];
  if (u.eta != null && u.eta > 0 && Number.isFinite(u.eta)) parts.push(`${u.eta < 60 ? '<1 min' : formatDuration(u.eta)} left`);
  return parts.join(' · ');
}
