import React from 'react';
import PostContextRow from '../social/PostContextRow';

/**
 * Who and what is associated with a photo spot.
 *
 * Not a second implementation of the tile row — the same one, pointed at a
 * different id. Tags in horacio are generic records (`post_id`,
 * `tag_internal_id`, `tag_entry_type`) with `post_id` meaning "the thing the
 * tag is on", so a spot's tags are read by exactly the endpoint a post's are.
 *
 * A spot has no groups of its own, so only the tagged users, cars and events
 * appear — the row renders nothing at all when there are none.
 */
export default function SpotContextRow({ spotId }: { spotId: string }) {
  return <PostContextRow post={{ internal_id: spotId }} />;
}
