import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useGetPhotoSpotQuery, orsApi } from '@ors/kit';
import { useAppDispatch } from '../../store/store';
import PostActionRail from '../social/PostActionRail';
import { usePostLike } from '../../hooks/usePostLike';
import type { Post } from '../../types/api';

/**
 * A photo spot's like and comment, on its summary over the map — the same
 * heart, faces and comment button as every other card.
 *
 * Handed only the id (the kit's `renderSpotContext` slot), so it reads the
 * spot from the same cached detail query the summary itself is drawn from —
 * no second request. The counts and the viewer's own like come with that
 * detail (horacio's enrichEntries on /api/photospot/detail).
 */
export default function SpotActions({ spotId }: { spotId: string }) {
  const { data: spot } = useGetPhotoSpotQuery(spotId);
  const s = spot as any;
  const dispatch = useAppDispatch();
  /**
   * The like goes through alfa's API, but the spot — and with it `isLiked` —
   * is the kit's cached detail, which that request doesn't touch. Left alone,
   * reopening the spot drew the heart from the copy cached before the tap, so
   * the like looked like it hadn't saved. The cached copy is moved on the tap,
   * and refetched once the server has answered.
   */
  const like = usePostLike({
    postId: spotId,
    entryType: ENTRY_TYPE,
    ownerId: spot?.user_id,
    initialLiked: s?.isLiked ?? false,
    initialCount: s?.like_count ?? 0,
    onToggle: (liked) => {
      dispatch(orsApi.util.updateQueryData('getPhotoSpot', spotId, (draft: any) => {
        if (!!draft.isLiked === liked) return;
        draft.isLiked = liked;
        draft.like_count = Math.max(0, (draft.like_count ?? 0) + (liked ? 1 : -1));
      }));
    },
    onSettled: () => {
      dispatch(orsApi.util.invalidateTags([{ type: 'PhotoSpot', id: spotId }]));
    },
  });

  if (!spot) return null;

  return (
    <View style={styles.row}>
      <PostActionRail
        // The rail reads a post's id and comment count; a spot has both.
        post={{ internal_id: spotId, comment_count: s.comment_count ?? 0 } as Post}
        entryType={ENTRY_TYPE}
        like={like}
        likers={s.likers ?? []}
        vertical={false}
        bookmark={false}
      />
    </View>
  );
}

/** What likes and comments on a spot are filed under — horacio's contentRef. */
const ENTRY_TYPE = 'photospot';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
});
