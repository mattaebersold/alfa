import { CONFIG } from '../constants/config';
import type { GalleryItem, Post } from '../types/api';
import { imageUrl } from './image';

/**
 * A post's photos and videos as one ordered list.
 *
 * The server keeps both in `gallery`, each entry saying which it is. This turns
 * that into something a renderer can walk without knowing any of the storage
 * details — where a filename becomes a URL, how a Mux id becomes a stream, or
 * that an entry written before videos existed carries no `type` at all.
 *
 * The legacy shape is still out there in quantity: posts created before this
 * have their video in `post.video_id` and nothing about it in the gallery. Those
 * are folded in here rather than special-cased in every screen.
 */
export type PostMedia =
  | { kind: 'image'; key: string; url: string }
  | {
      kind: 'video';
      key: string;
      /** Null while Mux is still encoding — there's nothing to play yet. */
      videoId: string | null;
      status: 'processing' | 'ready' | 'failed';
      /** Mux's own still, used as the poster behind the play button. */
      poster: string | null;
    };

/** A Mux HLS stream. */
export function muxStreamUrl(videoId: string): string {
  return `https://stream.mux.com/${videoId}.m3u8`;
}

/**
 * A still from the video, for the poster frame.
 *
 * `smartcrop` rather than a plain resize: the frame is being fitted into a
 * carousel whose shape is set by the post's other media, so something has to
 * decide what to keep, and Mux choosing the subject beats cropping the centre.
 */
export function muxThumbnailUrl(videoId: string, width = 720): string {
  return `https://image.mux.com/${videoId}/thumbnail.jpg?width=${width}&fit_mode=smartcrop`;
}

/** What a gallery entry is — mirrors helpers/postMedia.js on the server. */
function itemKind(item: GalleryItem): 'image' | 'video' {
  if (item?.type === 'video') return 'video';
  if (!item?.type && (item?.video_id || item?.upload_id)) return 'video';
  return 'image';
}

/**
 * The gallery in the author's order.
 *
 * Entries carry the index they were placed at, but don't necessarily arrive in
 * it — photos upload one request at a time and a video's slot is written before
 * the photos around it land. Sorting on read is what makes the order stick.
 * Legacy entries have no index and are already in order, so they follow.
 */
function sortGallery(gallery: GalleryItem[]): GalleryItem[] {
  return gallery
    .map((item, arrival) => ({ item, arrival }))
    .sort((a, b) => {
      const ai = Number.isFinite(a.item?.index as number) ? (a.item.index as number) : Infinity;
      const bi = Number.isFinite(b.item?.index as number) ? (b.item.index as number) : Infinity;
      if (ai !== bi) return ai - bi;
      return a.arrival - b.arrival;
    })
    .map(({ item }) => item);
}

/**
 * Everything a post has to show, in order.
 *
 * A video still encoding is kept in the list rather than dropped: it occupies a
 * real position the author chose, and showing it as "processing" is the honest
 * answer. A failed one is dropped — there's nothing coming.
 */
export function postMediaList(post: Pick<Post, 'gallery' | 'video_id'>): PostMedia[] {
  const gallery = Array.isArray(post.gallery) ? post.gallery : [];
  const media: PostMedia[] = [];
  let sawVideo = false;

  sortGallery(gallery).forEach((item, i) => {
    if (itemKind(item) === 'video') {
      const videoId = item.video_id ?? null;
      if (item.status === 'failed') return;
      sawVideo = true;
      media.push({
        kind: 'video',
        key: item.internal_id ?? item.upload_id ?? `v${i}`,
        videoId,
        status: videoId ? 'ready' : 'processing',
        poster: videoId ? muxThumbnailUrl(videoId) : null,
      });
      return;
    }
    const url = imageUrl(item.filename);
    if (!url) return;
    media.push({ kind: 'image', key: item.internal_id ?? item.filename ?? `i${i}`, url });
  });

  // Posts predating typed gallery entries keep their video in `video_id` alone.
  // Only fall back to it when the gallery didn't already account for a video,
  // otherwise a post written by a current client shows its video twice.
  if (!sawVideo && post.video_id) {
    media.unshift({
      kind: 'video',
      key: `legacy-${post.video_id}`,
      videoId: post.video_id,
      status: 'ready',
      poster: muxThumbnailUrl(post.video_id),
    });
  }

  return media;
}

/**
 * The shape the whole carousel is drawn at.
 *
 * One ratio for every slide, rather than each one taking its own. A gallery
 * that resizes per slide makes the page jump under the thumb as you swipe —
 * a tall portrait next to a wide landscape moves everything below the media by
 * hundreds of points — and the taller the swing, the more violent it is.
 *
 * The clamp is what keeps the first photo from dictating something unusable: an
 * extreme panorama would otherwise reduce the carousel to a letterbox slot, and
 * a very tall portrait would push the post's text off the screen entirely. The
 * bounds are the familiar ones — 4:5 upright, 16:9 wide — and anything outside
 * them is fitted into the nearest.
 */
export const MIN_MEDIA_RATIO = 4 / 5;
export const MAX_MEDIA_RATIO = 16 / 9;
/** Used until the first item reports its real size. Square is the least wrong. */
export const DEFAULT_MEDIA_RATIO = 1;

export function clampMediaRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_MEDIA_RATIO;
  return Math.min(MAX_MEDIA_RATIO, Math.max(MIN_MEDIA_RATIO, ratio));
}
