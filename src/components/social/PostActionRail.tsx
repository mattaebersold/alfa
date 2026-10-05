import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Heart } from 'lucide-react-native';
import CommentButton from './CommentButton';
import PostBookmarkButton from './PostBookmarkButton';
import PostCommentsModal from './PostCommentsModal';
import LikerFaces from './LikerFaces';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import { COLOR_WHITE, COLOR_LIKE } from '../../constants/config';
import { formatActionCount } from '../../utils/text';
import { FONT_INTER } from '../../constants/fonts';
import type { PostLike } from '../../hooks/usePostLike';
import type { Post } from '../../types/api';

/**
 * A post's actions as a column of icons over its photo — bookmark, comment
 * and, at the foot, like — each with its count underneath, in a faint dark
 * pill — except the like's, which reads leftward from the heart: the count,
 * the faces of the last three people to like it, then "+x" for the rest. The
 * faces open the full list. On a post
 * with no photo there's nothing to float over, so the same three sit in a row
 * instead. (Share is left out until it has somewhere real to send people.)
 *
 * Each does its own thing:
 *  - like: fills red on the tap and likes it. The state is the card's
 *    (usePostLike), shared with the likes row's heart. Not on your own post —
 *    there the heart opens who liked it instead;
 *  - comment: opens the thread in a panel, with a box to write in;
 *  - bookmark: saves it to the header's Bookmarks (PostBookmarkButton).
 */
export default function PostActionRail({
  post, entryType, like, likers, onOpenLikers, vertical = true, bookmark = true,
}: {
  post: Post;
  entryType: string;
  /** The card's like — see usePostLike. */
  like: PostLike;
  /** Who liked it, most recent first — the faces beside the heart. */
  likers: string[];
  /** Open the likers panel from this rect — the faces, or your own post's heart. */
  onOpenLikers: (origin: SummaryOrigin | null) => void;
  vertical?: boolean;
  /** Off for a post that isn't worth keeping — a shared game result. */
  bookmark?: boolean;
}) {
  const commentRef = useRef<View>(null);
  const heartRef = useRef<View>(null);
  const iconSize = vertical ? RAIL_ICON : 20;
  const [commentsOrigin, setCommentsOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  return (
    <>
      <View style={vertical ? styles.column : styles.row} pointerEvents="box-none">
        {bookmark && (
          <PostBookmarkButton
            postId={post.internal_id}
            count={post.bookmark_count ?? 0}
            size={vertical ? RAIL_ICON : 20}
            vertical={vertical}
          />
        )}
        <View ref={commentRef} collapsable={false}>
          <CommentButton
            count={post.comment_count ?? post.commentCount ?? 0}
            documentId={post.internal_id}
            onPress={() => measureOrigin(commentRef.current, setCommentsOrigin)}
            color={COLOR_WHITE}
            vertical={vertical}
          />
        </View>
        {/* Like, last — with the faces of who liked it just to its left:
            hanging off the column on the photo, in line in the footer row. */}
        <View style={styles.likeWrap}>
          {/* Read leftward from the heart: how many, then who — the last
              three faces, and a "+x" circle for the rest. */}
          <View style={[styles.likeInfo, vertical ? styles.facesOut : styles.facesIn]} pointerEvents="box-none">
            <LikerFaces likers={likers} total={like.count} onOpen={onOpenLikers} />
            {like.count > 0 && (
              // White either way — the red heart is what says you liked it.
              <Text style={styles.count}>{formatActionCount(like.count)}</Text>
            )}
          </View>
          <TouchableOpacity
            ref={heartRef}
            onPress={() => (like.mine ? measureOrigin(heartRef.current, onOpenLikers) : like.toggle())}
            style={vertical ? styles.itemV : styles.itemH}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={like.mine ? 'See who liked this' : like.liked ? 'Unlike' : 'Like'}
          >
            <Heart
              size={iconSize}
              color={like.liked ? COLOR_LIKE : COLOR_WHITE}
              fill={like.liked ? COLOR_LIKE : 'transparent'}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
        </View>
      </View>

      <PostCommentsModal
        postId={post.internal_id}
        entryType={entryType}
        origin={commentsOrigin}
        onClose={() => setCommentsOrigin(undefined)}
      />
    </>
  );
}

/** The icons' size on the photo. */
const RAIL_ICON = 21;

const styles = StyleSheet.create({
  // No pill behind the column — just a shadow under the icons themselves to
  // set the white off a bright photo.
  column: {
    alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 4,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemV:  { alignItems: 'center', gap: 3, padding: 4 },
  likeWrap: { flexDirection: 'row', alignItems: 'center' },
  // The count, then the faces — together to the heart's left.
  likeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // On the photo the faces hang off the column's left edge, so the column stays
  // one icon wide; in the footer row they simply lead the heart.
  facesOut: { position: 'absolute', right: '100%', marginRight: 1 },
  facesIn:  { marginRight: 6 },
  itemH:  { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count: {
    color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
