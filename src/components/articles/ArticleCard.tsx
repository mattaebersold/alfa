import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useGetUserByIdQuery } from '../../api/apiService';
import Avatar from '../ui/Avatar';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { Article } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** "show" → "Show": the category as the feed's badges word theirs. */
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * How a category reads on a chip or a badge. The stored keys are whatever
 * the editor typed — camelCase for the most part — so the ones we know get
 * a proper name and the rest are split on their capitals.
 */
const CATEGORY_LABELS: Record<string, string> = {
  siteUpdates: 'Site updates',
  hotTake: 'Hot takes',
  photography: 'Photography',
  user: 'Members',
  show: 'Shows',
  other: 'Other',
};

export const categoryLabel = (key: string) =>
  CATEGORY_LABELS[key] ?? titleCase(key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

export default function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const colors = useColors();
  const { openUser } = useSummary();
  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  // The list sends the author along; a server that doesn't yet is asked
  // for them, once per author, so the byline is never missing.
  const { data: fetchedAuthor } = useGetUserByIdQuery(article.user_id ?? '', { skip: !article.user_id || !!article.user?.username });
  const author = article.user?.username ? article.user : fetchedAuthor;
  const displayName = author?.username ?? '';
  // Shorthand date so it sits alongside the title without crowding it.
  const date = article.created_at
    ? format(new Date(article.created_at), 'M/d/yy')
    : '';

  /**
   * The author: avatar and handle in a dark pill, the car card's owner chip.
   * Bottom left of the photo; in the body when the article has none.
   */
  const authorChip = author ? (
    <TouchableOpacity
      style={styles.authorChip}
      onPress={() => author.user_id && openUser(author.user_id, null, userPreview(author))}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={displayName ? `Open ${displayName}'s profile` : 'Open author profile'}
    >
      <Avatar user={author} size={20} />
      {displayName ? (
        <Text style={styles.authorName} numberOfLines={1}>@{displayName}</Text>
      ) : null}
    </TouchableOpacity>
  ) : null;

  // The feed card's badge: a dark translucent pill over the photo.
  const categoryBadge = article.category ? (
    <View style={styles.categoryBadge}>
      <Text style={styles.category}>{categoryLabel(article.category)}</Text>
    </View>
  ) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hero ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
          {/* The car card's foot scrim: rising from the bottom-left corner, so
              the author's chip sits on a little shade whatever the photo. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.59)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.8, y: 0.2 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {categoryBadge && <View style={styles.heroBadges}>{categoryBadge}</View>}
          {authorChip && <View style={styles.heroAuthor}>{authorChip}</View>}
        </View>
      ) : null}

      <View style={styles.cardBody}>
        {/* No hero to overlay — fall back to an inline badge. */}
        {!hero && categoryBadge}

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>
            {article.title}
          </Text>
          {date ? (
            <Text style={[styles.date, { color: colors.grey }]}>{date}</Text>
          ) : null}
        </View>

        {article.body && (
          <Text style={[styles.excerpt, { color: colors.grey }]} numberOfLines={2}>
            {stripHtml(article.body)}
          </Text>
        )}

        {/* No photo to sit on — the author rides in the body instead. */}
        {!hero && authorChip}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:      {
    borderRadius: COMMON_RADIUS,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  // Rounded at the foot too, so the photo sits in the card rather than capping it.
  heroWrap:  { position: 'relative', borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  hero:      { width: '100%', aspectRatio: 16 / 9 },
  heroBadges: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },

  cardBody:  { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 4 },
  // FeedItemCard's imgBadge, so an article's badge reads as the feed's do.
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)', opacity: 0.8,
    borderRadius: PILL_RADIUS, paddingHorizontal: 8, paddingVertical: 3,
  },
  category:  { fontSize: 10, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, letterSpacing: 0.3 },

  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:     { flex: 1, fontSize: 17, fontFamily: FONT_INTER.bold, lineHeight: 24 },
  date:      { fontSize: 12, fontFamily: FONT_INTER.semibold, marginTop: 4 },

  excerpt:   { fontSize: 13, lineHeight: 19 },
  heroAuthor: { position: 'absolute', left: 10, bottom: 10, maxWidth: '70%' },
  // CarPosterCard's ownerChip: a dark pill with the avatar set into its end.
  authorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingLeft: 3, paddingRight: 9, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  authorName: { flexShrink: 1, fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
