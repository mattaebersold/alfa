import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../api/apiService';
import { useAppSelector } from '../store/store';

/**
 * One post's like, held once for every heart on its card.
 *
 * A feed card has two hearts — the rail's over the photo and the likes row's
 * under it — and each keeping its own state meant liking with one left the
 * other showing the old answer. The card holds this and hands it to both.
 *
 * Optimistic: the heart fills and the count moves on the tap, and both go back
 * if the server refuses. Your own post can't be liked — `toggle` does nothing
 * there, and `mine` tells the caller to show who liked it instead.
 */
export function usePostLike({ postId, entryType, ownerId, initialLiked, initialCount, onToggle }: {
  postId: string;
  entryType: string;
  ownerId?: string;
  initialLiked: boolean;
  initialCount: number;
  /** Before the request settles — see FeedItemCard's `likeTouched`. */
  onToggle?: (liked: boolean) => void;
}) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const mine = !!ownerId && !!myId && ownerId === myId;
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  // Follow the server once the live query has an answer.
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setCount(initialCount); }, [initialCount]);

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  const toggle = async () => {
    if (mine) return;
    const was = liked;
    setLiked(!was);
    setCount((c) => Math.max(0, c + (was ? -1 : 1)));
    onToggle?.(!was);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const body = { document_id: postId, document_entry_type: entryType };
      if (was) await unlikeEntry(body).unwrap();
      else await likeEntry(body).unwrap();
    } catch {
      setLiked(was);
      setCount((c) => Math.max(0, c + (was ? 1 : -1)));
    }
  };

  return { liked, count, mine, toggle };
}

export type PostLike = ReturnType<typeof usePostLike>;
