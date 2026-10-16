import React from 'react';
import PostStrip, { STRIP_PREVIEW_COUNT, type PostCardLook } from '../social/PostStrip';
import { useGetCarTaggedPostsQuery } from '../../api/apiService';
import type { Post } from '../../types/api';
import { COLOR_GRAY_23 } from '../../constants/config';

/**
 * How a tagged post's card looks — on the shelf and in the list behind it: all
 * picture, the caption on a fade at its foot, and who posted it in a pill at
 * the top.
 */
export const TAGGED_LOOK: PostCardLook = {
  cardBackground: COLOR_GRAY_23,
  showTime: false,
  captionLines: 1,
  captionOnImage: true,
  bylineOnImage: true,
};

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
      // The car page's shelves' look: a wider card that's all picture, the
      // caption on a fade at its foot, and who posted it in a pill at the top —
      // who put the car in a story, and what they said.
      {...TAGGED_LOOK}
      cardWidth={232}
      ruled
      onPostPress={onPostPress}
      onViewAll={onViewAll}
    />
  );
}
