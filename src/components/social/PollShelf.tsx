import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import FeedItemCard from '../cards/FeedItemCard';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import type { Post } from '../../types/api';

/** As many as fit before "View all" is the better answer — same as PostStrip. */
export const POLL_SHELF_PREVIEW_COUNT = 6;

const CARD_GAP = 12;
const ROW_PAD_LEFT = 12;
/** The route shelf's width: room for the question and its options, with the next card peeking. */
const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 360);

/**
 * A shelf of a member's polls — the posts of theirs that ask a question.
 *
 * Not PostStrip. Its cards are a photo and a caption, and a poll's whole
 * point is the choices under it; a thumbnail with "Which colour?" on it would
 * be a shelf of questions you can't answer. These are the feed's own cards,
 * poll block and all, so a vote can be cast from the profile as it can from
 * the feed. Wide like the routes shelf, for the same reason: the options
 * need a readable line each.
 *
 * Purely presentational — the host fetches and decides what "View all" opens.
 */
export default function PollShelf({
  title,
  posts,
  total,
  onPostPress,
  onViewAll,
}: {
  title: string;
  posts: Post[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  onPostPress: (post: Post) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();

  // Nothing to show is nothing to say — a member without polls gets no
  // section, not an empty one.
  if (posts.length === 0) return null;
  const hasMore = (total ?? posts.length) > posts.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total} polls`}
          >
            <Text style={[styles.viewAllText, { color: colors.primaryAlt }]}>View all</Text>
            <ChevronRight size={14} color={colors.primaryAlt} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {posts.map((post) => (
          /* The feed card takes whatever width it's given; here it's given
             the shelf's. It brings its own ground and corners — the same
             ones it has in the feed — so nothing is drawn around it. */
          <View key={post.internal_id} style={styles.item}>
            <FeedItemCard
              post={post}
              onPress={() => onPostPress(post)}
              onCommentPress={() => onPostPress(post)}
            />
          </View>
        ))}
        <RowEndSpacer width={ROW_PAD_LEFT} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title:       { fontSize: 17, fontWeight: '800' },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  item: { width: CARD_WIDTH },
});
