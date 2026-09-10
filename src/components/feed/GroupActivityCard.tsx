import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MessageSquare, Newspaper, BookMarked, ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { GroupActivityItem } from '../../types/api';

/**
 * Something posted in a group you're in, on the home feed.
 *
 * A group's discussions, news and resources used to live only inside the group,
 * which meant joining one was worth nothing unless you remembered to go and
 * look. This is that content brought out to where you already are.
 *
 * It reads as a *notice* rather than as a post: a single line of context, the
 * title, and a chevron. The group's own posts are usually text — a question, a
 * link, a spec sheet — and dressing one up in the same frame as a photo of
 * somebody's car would both flatter it and crowd the feed. Tapping opens the
 * summary, which is where the body and the photos are.
 */

const KIND: Record<GroupActivityItem['kind'], {
  label: string;
  Icon: typeof MessageSquare;
  color: string;
}> = {
  discussion: { label: 'Discussion', Icon: MessageSquare, color: palette.badgeGroup },
  news:       { label: 'News',       Icon: Newspaper,     color: palette.badgeEvent },
  resource:   { label: 'Resource',   Icon: BookMarked,    color: palette.badgeRecord },
};

export default function GroupActivityCard({ item, onPress }: {
  item: GroupActivityItem;
  onPress: () => void;
}) {
  const colors = useColors();
  const spec = KIND[item.kind] ?? KIND.discussion;
  const { Icon } = spec;

  const groupImage = firstGalleryUrl(item.group?.gallery);
  const avatar = imageUrl(item.user?.profile?.[0] ?? item.user?.gallery?.[0]?.filename);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${spec.label} in ${item.group?.title ?? 'a group'}: ${item.title ?? ''}`}
    >
      {/* The group's colour bar. It's the one thing that distinguishes two
          notices from each other at a glance in a scrolling feed. */}
      <View style={[styles.stripe, { backgroundColor: spec.color }]} />

      <View style={styles.body}>
        <View style={styles.context}>
          {groupImage ? (
            <Image source={{ uri: groupImage }} style={styles.groupImg} contentFit="cover" />
          ) : (
            <View style={[styles.groupImg, { backgroundColor: colors.segment }]} />
          )}
          <View style={[styles.badge, { backgroundColor: spec.color }]}>
            <Icon size={10} color="#FFFFFF" />
            {/* Never uppercase, no letter-spacing — house rule for badges. */}
            <Text style={styles.badgeText}>{spec.label}</Text>
          </View>
          <Text style={[styles.group, { color: colors.grey }]} numberOfLines={1}>
            {item.group?.title ?? 'Group'}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
          {item.title || 'Untitled'}
        </Text>

        <View style={styles.byline}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : null}
          <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>
            {item.user?.username ? `@${item.user.username}` : 'A member'}
          </Text>
        </View>
      </View>

      <ChevronRight size={16} color={colors.grey} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  stripe: { width: 4, alignSelf: 'stretch' },
  body:   { flex: 1, paddingVertical: 12, paddingLeft: 12, gap: 6 },

  context:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupImg:  { width: 18, height: 18, borderRadius: 5 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0 },
  group:     { flex: 1, fontSize: 11, fontWeight: '600' },

  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },

  byline:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar:     { width: 16, height: 16, borderRadius: 8 },
  bylineText: { fontSize: 11, fontWeight: '600' },

  chevron: { marginHorizontal: 10 },
});
