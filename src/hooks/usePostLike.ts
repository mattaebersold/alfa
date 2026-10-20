import { useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../api/apiService';
import { useAppSelector } from '../store/store';
import { likeStates, useLikeState } from './useLikeState';

/**
 * One post's like, held once for every heart on its card.
 *
 * A feed card has two hearts — the rail's over the photo and the likes row's
 * under it — and each keeping its own state meant liking with one left the
 * other showing the old answer. The card holds this and hands it to both.
 *
 * Optimistic: the heart fills and the count moves on the tap, then settle on
 * the server's answer — its liker list, so the count is exact — and go back if
 * it refuses. Held in the session's like record (useLikeState), not in this
 * hook: a card rebuilt from a stale list still shows what you last did. Your own post can't be liked — `toggle` does nothing
 * there, and `mine` tells the caller to show who liked it instead.
 */
export function usePostLike({ postId, entryType, ownerId, initialLiked, initialCount, onToggle, onSettled }: {
  postId: string;
  entryType: string;
  ownerId?: string;
  initialLiked: boolean;
  initialCount: number;
  /** Before the request settles — see FeedItemCard's `likeTouched`. */
  onToggle?: (liked: boolean) => void;
  /**
   * Once the server has answered, either way — for a caller whose like state
   * comes from a cache this hook doesn't know about, to refetch it.
   */
  onSettled?: () => void;
}) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const mine = !!ownerId && !!myId && ownerId === myId;
  // What this session knows wins over the snapshot the caller was handed.
  const known = useLikeState(postId);
  const liked = known?.liked ?? initialLiked;
  const count = known?.count ?? initialCount;

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  /** When the heart was last tapped — see `like`. */
  const lastToggle = useRef(0);

  const toggle = async () => {
    if (mine) return;
    lastToggle.current = Date.now();
    const was = { liked, count, users: known?.users };
    const now = !was.liked;
    likeStates.set(postId, {
      liked: now,
      count: Math.max(0, was.count + (now ? 1 : -1)),
      users: was.users && myId
        ? (now ? [...was.users.filter((u) => u !== myId), myId] : was.users.filter((u) => u !== myId))
        : undefined,
    });
    onToggle?.(now);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const body = { document_id: postId, document_entry_type: entryType };
      const record: any = now ? await likeEntry(body).unwrap() : await unlikeEntry(body).unwrap();
      // The server's record is the whole liker list: the count, exactly.
      if (Array.isArray(record?.users)) likeStates.fromRecord(postId, record.users, myId);
    } catch (err: any) {
      if (!now && err?.status === 404) {
        // Nothing to unlike — the snapshot thought you had, the server says
        // you hadn't. Not liked is the answer either way.
        return;
      }
      likeStates.set(postId, was);
    } finally {
      onSettled?.();
    }
  };

  /**
   * Like, never unlike — the double tap on a card. Liking something twice
   * shouldn't take it back.
   *
   * Ignored just after the heart itself was tapped: a quick double tap *on*
   * the heart is two toggles (like, unlike) and a card double tap all at once,
   * and the heart is what the finger meant. Returns whether it liked, so the
   * card knows to show the burst.
   */
  const like = () => {
    if (mine || liked || Date.now() - lastToggle.current < 600) return false;
    toggle();
    return true;
  };

  return { liked, count, mine, toggle, like };
}

export type PostLike = ReturnType<typeof usePostLike>;
