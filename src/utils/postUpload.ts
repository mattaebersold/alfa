import { useSyncExternalStore } from 'react';

/**
 * Posts being sent, after the create form has closed.
 *
 * Tapping Post used to hold the form open, its button counting through the
 * photos, until everything was on the server. Now the form closes on the tap
 * and the work carries on here, outside any screen — the home feed draws a
 * bar for each one (PostUploadBanner) with how far it's got, and refreshes
 * once it lands.
 *
 * The form hands over a `job`: everything that's left to do, as one function
 * that reports its progress as it goes. A failed job is kept, with the form's
 * draft, so the bar can offer to try it again or put it back in the form.
 */

export type PostUploadStatus = 'uploading' | 'failed';

export interface PostUploadProgress {
  /** 0–1, across every step of the job. */
  progress: number;
  /** What it's doing now — "Uploading photo 2 of 5". */
  label: string;
}

export interface PostUpload extends PostUploadProgress {
  id: string;
  status: PostUploadStatus;
  /** The first photo, or a video's poster frame — the bar's thumbnail. */
  thumb: string | null;
  /** Why it failed, in words for the member. */
  error?: string;
}

/**
 * The work. Called again, from the top, on a retry — it's the job's own
 * business to skip what already got through (a video already on Mux, a post
 * already created).
 */
export type PostUploadJob = (report: (p: PostUploadProgress) => void) => Promise<void>;

type Entry = { upload: PostUpload; job: PostUploadJob; draft: unknown };

let entries: Entry[] = [];
let snapshot: PostUpload[] = [];
const listeners = new Set<() => void>();
type Event = { type: 'start' | 'done'; id: string };
const eventListeners = new Set<(e: Event) => void>();

function emit() {
  snapshot = entries.map((e) => e.upload);
  listeners.forEach((fn) => fn());
}

function patch(id: string, next: Partial<PostUpload>) {
  entries = entries.map((e) => (e.upload.id === id ? { ...e, upload: { ...e.upload, ...next } } : e));
  emit();
}

function remove(id: string) {
  entries = entries.filter((e) => e.upload.id !== id);
  emit();
}

async function run(id: string) {
  const entry = entries.find((e) => e.upload.id === id);
  if (!entry) return;
  patch(id, { status: 'uploading', error: undefined, progress: 0, label: 'Posting…' });
  eventListeners.forEach((fn) => fn({ type: 'start', id }));
  try {
    await entry.job((p) => {
      // Never backwards — a step that restarts its own count shouldn't drag
      // the bar back.
      const cur = entries.find((e) => e.upload.id === id)?.upload.progress ?? 0;
      patch(id, { label: p.label, progress: Math.max(cur, Math.min(1, p.progress)) });
    });
    patch(id, { progress: 1, label: 'Posted' });
    remove(id);
    eventListeners.forEach((fn) => fn({ type: 'done', id }));
  } catch (err) {
    patch(id, { status: 'failed', error: describeError(err) });
  }
}

let seq = 0;

/** Hand a post's remaining work over and start it. */
export function startPostUpload({ job, draft, thumb }: { job: PostUploadJob; draft: unknown; thumb: string | null }) {
  const id = `upload_${++seq}_${Date.now()}`;
  entries = [...entries, {
    upload: { id, status: 'uploading', progress: 0, label: 'Posting…', thumb },
    job,
    draft,
  }];
  emit();
  void run(id);
  return id;
}

/** Try a failed upload again, from where its job picks up. */
export function retryPostUpload(id: string) {
  void run(id);
}

/** Forget a failed upload. */
export function discardPostUpload(id: string) {
  remove(id);
}

/**
 * A failed upload's draft, to put back in the form — and the upload dropped,
 * since the form owns it again and its Post will start a new one.
 */
export function takePostUploadDraft<T>(id: string): T | null {
  const entry = entries.find((e) => e.upload.id === id);
  if (!entry) return null;
  remove(id);
  return entry.draft as T;
}

/** Every post being sent, or failed and waiting — in the order they were posted. */
export function usePostUploads(): PostUpload[] {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => snapshot,
  );
}

/** Hear an upload start (or start again) and finish. Returns the unsubscribe. */
export function onPostUploadEvent(fn: (e: Event) => void) {
  eventListeners.add(fn);
  return () => { eventListeners.delete(fn); };
}

/** The same reading of an RTK Query failure the form used to show in its alert. */
function describeError(err: any): string {
  if (err instanceof Error) return err.message;
  const status = err?.status;
  const serverMsg = err?.data?.error ?? err?.data?.message ?? (typeof err?.data === 'string' ? err.data : '');
  if (status === 'FETCH_ERROR') return 'Network request failed — check your connection.';
  if (status === 'TIMEOUT_ERROR') return 'The request timed out.';
  if (status === 'PARSING_ERROR') return `Server returned an unexpected response (HTTP ${err?.originalStatus}).`;
  if (status === 401 || status === 403) return 'You appear to be signed out. Please log in again.';
  if (serverMsg) return serverMsg;
  if (typeof status === 'number') return `Server error (HTTP ${status}).`;
  return 'Something went wrong.';
}
