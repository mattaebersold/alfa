/**
 * Pro videos — long-form video from Pro members, streamed by Mux. See
 * horacio's controllers/proVideoController for the server side, and
 * utils/proVideoUpload for how a file gets there.
 */

export type ProVideoStatus = 'uploading' | 'processing' | 'ready' | 'errored' | 'cancelled';
export type ProVideoSort = 'newest' | 'oldest' | 'popular' | 'longest' | 'shortest';
export type ProVideoLength = 'short' | 'medium' | 'long';

/** The member who posted it — horacio's userLite. */
export interface ProVideoUser {
  user_id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  gallery?: { filename?: string }[];
  profilePicture?: string;
  avatarColor?: string;
  accountType?: string;
}

export interface ProVideo {
  internal_id: string;
  user_id: string;
  user?: ProVideoUser | null;
  title: string;
  description: string;
  category: string;
  year: string | null;
  make: string | null;
  model: string | null;
  tags: string[];
  status: ProVideoStatus;
  error: { code: string; message: string } | null;
  /** Only once it's ready. */
  playback_id: string | null;
  /** '16:9', '9:16' … — Mux's own reading of the encoded video. */
  aspect_ratio: string | null;
  width: number | null;
  height: number | null;
  /** Seconds. */
  duration: number | null;
  max_resolution: string | null;
  views: number;
  // The viewer's side of it.
  like_count: number;
  has_liked: boolean;
  comment_count: number;
  bookmark_count: number;
  bookmarked: boolean;
  created_at: string;
  ready_at: string | null;
  /**
   * A new file on its way in ("Replace video"), or null. The video itself
   * stays ready, playing its current file, until this one is swapped in.
   */
  replacement?: { status: 'uploading' | 'processing' | 'errored'; error?: { code?: string; message?: string } | null } | null;
}

export interface ProVideoMeta {
  max_bytes: number;
  max_duration_secs: number;
  max_in_flight: number;
  accepted_types: string[];
  accepted_extensions: string[];
  categories: { key: string; label: string }[];
  sorts: ProVideoSort[];
  lengths: ProVideoLength[];
}

export interface ProVideoListParams {
  sort?: ProVideoSort;
  category?: string;
  make?: string;
  model?: string;
  length?: ProVideoLength;
  q?: string;
  user_id?: string;
  /** Your own, in every status but cancelled. */
  mine?: boolean;
  /** The ones you've saved. */
  bookmarked?: boolean;
}

export interface ProVideoPage {
  entries: ProVideo[];
  total: number;
  /** 0-based. */
  page: number;
  has_more: boolean;
}

/** What the member fills in on the upload sheet. */
export interface ProVideoFields {
  title: string;
  description?: string;
  category?: string;
  year?: string;
  make?: string;
  model?: string;
  tags?: string[];
}

/** Mux's URLs for a ready video. */
export const muxHls = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`;
export const muxPoster = (playbackId: string, width = 800) => `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${width}&time=2`;
export const muxAnimated = (playbackId: string) => `https://image.mux.com/${playbackId}/animated.gif?width=320`;

/** Width over height from '16:9'; 16:9 when it's missing or nonsense. */
export function aspectOf(v: Pick<ProVideo, 'aspect_ratio' | 'width' | 'height'>): number {
  const m = v.aspect_ratio?.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (m) {
    const r = Number(m[1]) / Number(m[2]);
    if (r > 0.2 && r < 5) return r;
  }
  if (v.width && v.height) return v.width / v.height;
  return 16 / 9;
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(secs: number | null | undefined): string {
  if (secs == null || !Number.isFinite(secs)) return '';
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/**
 * A view count as a card shows it — 128, 1.2K, 3.4M. Not formatActionCount,
 * whose "9+" suits a like count on a post but would hide how far a video went.
 */
export function formatViewCount(n: number | null | undefined): string {
  const v = Math.max(0, Math.floor(n ?? 0));
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
}

/** Bytes, as a person reads them — "12.4 GB", "850 MB". */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
