import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Tag } from 'lucide-react-native';
import CommentButton from './CommentButton';
import PostBookmarkButton from './PostBookmarkButton';
import PostReactionsSummaryModal, { type PostReactionsTab } from './PostReactionsSummaryModal';
import LikerFaces from './LikerFaces';
import AnimatedHeart from './AnimatedHeart';
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
 *    (usePostLike). Once liked — or on your own post — the heart opens the
 *    likes instead, where an unlike is a button that asks first;
 *  - comment: opens the thread, with a box to write in.
 *  Likes and comments are one panel, a tab each (PostReactionsSummaryModal),
 *  opened on whichever was tapped;
 *  - tagged (only when someone is): a tag, with the tagged members' faces
 *    beside it as the likes have theirs; either opens who's tagged;
 *  - bookmark: saves it to the header's Bookmarks (PostBookmarkButton).
 */
export default function PostActionRail({
  post, entryType, like, likers, tagged = [], onOpenTagged, vertical = true, bookmark = true,
}: {
  post: Post;
  entryType: string;
  /** The card's like — see usePostLike. */
  like: PostLike;
  /** Who liked it, most recent first — the faces beside the heart. */
  likers: string[];
  /** Members tagged in the post — user_ids. Under the comments, over the like. */
  tagged?: string[];
  /** Open the list of who's tagged, from this rect. */
  onOpenTagged?: (origin: SummaryOrigin | null) => void;
  vertical?: boolean;
  /** Off for a post that isn't worth keeping — a shared game result. */
  bookmark?: boolean;
}) {
  const commentRef = useRef<View>(null);
  const heartRef = useRef<View>(null);
  const tagRef = useRef<View>(null);
  const iconSize = vertical ? RAIL_ICON : 20;
  /** The likes / comments panel, on the tab that was tapped. */
  const [reactions, setReactions] = useState<{ tab: PostReactionsTab; origin: SummaryOrigin | null } | null>(null);
  const openOn = (tab: PostReactionsTab) => (origin: SummaryOrigin | null) => setReactions({ tab, origin });

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
            onPress={() => measureOrigin(commentRef.current, openOn('comments'))}
            color={COLOR_WHITE}
            vertical={vertical}
          />
        </View>
        {/* Who's tagged, laid out as the like below it: the faces to the
            tag's left, a "+x" past three. */}
        {tagged.length > 0 && onOpenTagged && (
          <View style={styles.likeWrap}>
            <View style={[styles.likeInfo, vertical ? styles.facesOut : styles.facesIn]} pointerEvents="box-none">
              <LikerFaces likers={tagged} total={tagged.length} onOpen={onOpenTagged} label="See who's tagged" />
            </View>
            <TouchableOpacity
              ref={tagRef}
              onPress={() => measureOrigin(tagRef.current, onOpenTagged)}
              style={vertical ? styles.itemV : styles.itemH}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="See who's tagged"
            >
              <Tag size={iconSize} color={COLOR_WHITE} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        )}
        {/* Like, last — with the faces of who liked it just to its left:
            hanging off the column on the photo, in line in the footer row. */}
        <View style={styles.likeWrap}>
          {/* Read leftward from the heart: how many, then who — the last
              three faces, and a "+x" circle for the rest. */}
          <View style={[styles.likeInfo, vertical ? styles.facesOut : styles.facesIn]} pointerEvents="box-none">
            <LikerFaces likers={likers} total={like.count} onOpen={openOn('likes')} />
            {/* On the photo, the number too. In a footer row the faces carry
                it alone — a face beside a "2" read as one thing, not as who
                and how many. */}
            {vertical && like.count > 0 && (
              // White either way — the red heart is what says you liked it.
              <Text style={styles.count}>{formatActionCount(like.count)}</Text>
            )}
          </View>
          <TouchableOpacity
            ref={heartRef}
            // Not yet liked: likes, on the spot. Liked (or yours): the likes
            // tab, which is where an unlike lives.
            onPress={() => (like.mine || like.liked ? measureOrigin(heartRef.current, openOn('likes')) : like.toggle())}
            style={vertical ? styles.itemV : styles.itemH}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={like.mine || like.liked ? 'See who liked this' : 'Like'}
          >
            <AnimatedHeart
              liked={like.liked}
              size={iconSize}
              color={like.liked ? COLOR_LIKE : COLOR_WHITE}
              fill={like.liked ? COLOR_LIKE : 'transparent'}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
        </View>
      </View>

      <PostReactionsSummaryModal
        postId={post.internal_id}
        entryType={entryType}
        like={like}
        tab={reactions?.tab ?? null}
        origin={reactions?.origin}
        onClose={() => setReactions(null)}
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
    alignItems: 'center', gap: 4,
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
  // Close in to the heart they belong to.
  facesIn:  { marginRight: 0 },
  itemH:  { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count: {
    color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
