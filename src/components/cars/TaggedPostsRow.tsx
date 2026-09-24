import React from 'react';
import PostStrip, { STRIP_PREVIEW_COUNT } from '../social/PostStrip';
import { useGetCarTaggedPostsQuery } from '../../api/apiService';
import type { Post } from '../../types/api';

/**
 * "Tagged in Posts" — other people's posts that pointed at this car.
 *
 * A car's own page shows what its owner has filed against it; this is the other
 * half, where the car turns up in someone else's story. It was reachable
 * nowhere before, so tagging a car wrote a link that only pointed one way.
 */
export default function TaggedPostsRow({
  carId,
  onPostPress,
  onViewAll,
}: {
  carId: string;
  onPostPress: (post: Post) => void;
  onViewAll: () => void;
}) {
  const { data } = useGetCarTaggedPostsQuery({ carId, page: 0, limit: STRIP_PREVIEW_COUNT });

  return (
    <PostStrip
      title="Tagged in Posts"
      posts={data?.entries ?? []}
      total={data?.total}
      // Darker cards, a bigger two-line caption, and no "3 hours ago": what
      // matters here is who put the car in a story and what they said.
      cardBackground="#171717"
      largeCaption
      showTime={false}
      onPostPress={onPostPress}
      onViewAll={onViewAll}
    />
  );
}
