import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquare, Newspaper, BookMarked } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import type { GroupActivityItem } from '../../types/api';
import Avatar from '../ui/Avatar';
import { COMMON_RADIUS, GUTTER, COLOR_BADGE_NEWS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * Something posted in a group you're in, on the home feed.
 *
 * A group's discussions, news and resources used to live only inside the group,
 * which meant joining one was worth nothing unless you remembered to go and
 * look. This is that content brought out to where you already are.
 *
 * It reads as a *notice* rather than as a post: who posted, where, and the
 * title. The group's own picture fills the left half and fades into the card,
 * so the group is recognisable at a glance without the post itself dressed up
 * like a photo of somebody's car. Tapping opens the summary, which is where the
 * body and the photos are.
 */

export const GROUP_KIND: Record<GroupActivityItem['kind'], {
  label: string;
  Icon: typeof MessageSquare;
  color: string;
}> = {
  discussion: { label: 'Discussion', Icon: MessageSquare, color: palette.badgeGroup },
  news:       { label: 'News',       Icon: Newspaper,     color: COLOR_BADGE_NEWS },
  resource:   { label: 'Resource',   Icon: BookMarked,    color: palette.badgeRecord },
};

export default function GroupActivityCard({ item, onPress }: {
  item: GroupActivityItem;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const spec = GROUP_KIND[item.kind] ?? GROUP_KIND.discussion;
  const { Icon } = spec;

  const groupImage = firstGalleryUrl(item.group?.gallery);
  const groupName = item.group?.title ?? 'a group';
  const who = item.user?.username ? `@${item.user.username}` : 'A member';

  return (
    <SummaryTouchable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      accessibilityLabel={`${who} posted ${spec.label.toLowerCase()} to ${groupName}: ${item.title ?? ''}`}
    >
      {groupImage ? (
        <View style={styles.art} pointerEvents="none">
          <Image source={{ uri: groupImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          {/* Fades the picture into the card, so the words over its right
              edge sit on the card's own colour. */}
          <LinearGradient
            colors={['transparent', colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: spec.color }]}>
          <Icon size={11} color={palette.badgeFg} strokeWidth={2.4} />
          {/* Never uppercase, no letter-spacing — house rule for badges. */}
          <Text style={[styles.badgeText, { color: palette.badgeFg }]}>{spec.label}</Text>
        </View>

        <View style={styles.who}>
          <Avatar user={item.user as any} size={30} />
          <View style={styles.whoText}>
            <Text style={[styles.byline, { color: colors.grey }]} numberOfLines={1}>
              {who} posted to the group
            </Text>
            <Text style={[styles.group, { color: colors.fg }]} numberOfLines={1}>
              {groupName}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
          {item.title || 'Untitled'}
        </Text>
      </View>
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    // Same vertical spacing as the post cards around it — with none on top,
    // a group card first in the feed sat tucked under the header.
    marginHorizontal: GUTTER, marginVertical: 6,
    borderRadius: COMMON_RADIUS, borderWidth: 1, overflow: 'hidden',
  },
  art: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%' },
  // Anchored to the card's right edge, starting over the picture's fading
  // half rather than clear of it. Its contents stay left-aligned.
  body: { alignSelf: 'flex-end', width: '65%', paddingVertical: 14, paddingHorizontal: 14, gap: 8 },

  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold, letterSpacing: 0 },

  who:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whoText: { flex: 1 },
  byline: { fontSize: 12, fontFamily: FONT_INTER.medium },
  group:  { fontSize: 13, fontFamily: FONT_INTER.semibold, marginTop: 1 },
  title:  { fontSize: 16, fontFamily: FONT_INTER.bold, lineHeight: 21 },
});
