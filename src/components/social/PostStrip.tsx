import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import type { Post } from '../../types/api';

/** As many as fit before "View all" is the better answer. */
export const STRIP_PREVIEW_COUNT = 6;
const CARD_WIDTH = 168;

/**
 * A shelf of posts — a handful of them, sideways, with the rest behind a
 * button.
 *
 * Wherever a page is *about* something that posts attach to (a car, a member),
 * the posts themselves are the evidence, and a count on a tile is a poor
 * substitute for seeing them. This is the taste; the pane behind "View all" is
 * the archive.
 *
 * Purely presentational — the host owns the fetching, the paging and what a tap
 * does, because a profile and a car page answer those differently.
 */
export default function PostStrip({
  title,
  posts,
  total,
  showByline = true,
  onPostPress,
  onViewAll,
}: {
  title: string;
  posts: Post[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  /** Off where every post has the same author, e.g. a profile. */
  showByline?: boolean;
  onPostPress: (post: Post) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();

  // Nothing to show is nothing to say — an empty shelf reads as something
  // failing to load.
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
            accessibilityLabel={`View all ${total} posts`}
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
        snapToInterval={CARD_WIDTH + 10}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {posts.map((post) => {
          const hero = firstGalleryUrl(post.gallery);
          const caption = post.title || (post.body ? stripHtml(post.body) : '');
          const timeAgo = post.created_at
            ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
            : '';

          return (
            <TouchableOpacity
              key={post.internal_id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
              onPress={() => onPostPress(post)}
              activeOpacity={0.85}
            >
              {hero ? (
                <Image source={{ uri: hero }} style={styles.image} contentFit="cover" transition={150} />
              ) : (
                // Text posts keep the same footprint, so the row stays even.
                <View style={[styles.image, styles.imageBlank, { backgroundColor: colors.segment }]}>
                  <MessageSquare size={20} color={colors.grey} />
                </View>
              )}
              <View style={styles.body}>
                {caption ? (
                  <Text style={[styles.caption, { color: colors.fg }]} numberOfLines={2}>{caption}</Text>
                ) : null}
                {showByline ? (
                  <View style={styles.byline}>
                    <Avatar
                      user={post.user}
                      size={18}
                    />
                    <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>
                      {post.user?.username ? `@${post.user.username}` : ''}{timeAgo ? ` · ${timeAgo}` : ''}
                    </Text>
                  </View>
                ) : timeAgo ? (
                  <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>{timeAgo}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
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
  title:    { fontSize: 17, fontWeight: '800' },
  viewAll:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: 16, gap: 10 },
  card: { width: CARD_WIDTH, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 3 },
  imageBlank: { alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 10, gap: 6 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  byline:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bylineText: { fontSize: 11, flexShrink: 1 },
});
