import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Users } from 'lucide-react-native';
import { useGetGroupQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';

/**
 * "Posted in <group>", as a way into the group.
 *
 * A post that came from a group is a post with a context, and out in the home
 * feed that context was invisible — the same post read as someone's stray
 * thought rather than as part of a conversation happening somewhere. This is
 * that somewhere, and it's a button, because the natural next thought is "what
 * else is in there".
 *
 * It sits *below* the post rather than above it: the post is what you came to
 * read, and a banner over the top of it answered a question nobody had asked
 * yet. Underneath, it lands exactly where "and where was this?" occurs to you.
 *
 * Renders nothing until the group resolves, so a feed of posts doesn't flash a
 * row of empty bars while their groups load. Group data is cached by RTK Query,
 * so a feed full of posts from one group costs one request.
 */
export default function GroupAttribution({
  groupId,
  /** Fired before navigating — to close a sheet the post is sitting in. */
  onBeforeNavigate,
  /**
   * Hand the navigation to the host instead of doing it here. A post sitting
   * in a modal has to dismiss *and then* push, a frame apart, or the group
   * opens underneath the thing that's still animating away. Same contract
   * PostTagBadges uses.
   */
  onNavigate,
  /** A small pill instead of the banner, for lists rather than full cards. */
  compact = false,
}: {
  groupId?: string | null;
  onBeforeNavigate?: () => void;
  onNavigate?: (go: (nav: any) => void) => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { data: group } = useGetGroupQuery(groupId ?? '', { skip: !groupId });

  if (!groupId || !group) return null;

  // The banner if there is one — it's the group's own picture at the shape this
  // row wants. The profile shot is the fallback, then a plain badge.
  const image = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const name = group.title ?? 'Group';

  const open = () => {
    const go = (n: any) => n.navigate('GroupDetail', { groupId });
    if (onNavigate) return onNavigate(go);
    onBeforeNavigate?.();
    go(nav);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: colors.segment, borderColor: colors.borderDark }]}
        onPress={open}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Posted in ${name}. Open the group.`}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.pillThumb} contentFit="cover" />
        ) : (
          <View style={[styles.pillThumb, styles.blank, { backgroundColor: colors.card }]}>
            <Users size={12} color={colors.grey} />
          </View>
        )}
        <View style={styles.pillBadge}>
          <Text style={styles.pillBadgeText}>Group</Text>
        </View>
        <Text style={[styles.pillName, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
        <ChevronRight size={14} color={colors.grey} />
      </TouchableOpacity>
    );
  }

  return (
    // The margins live on a plain wrapper, and the banner fills it outright.
    // Carrying both the margins and an aspect ratio on one node left its width
    // to be resolved from the ratio rather than from the row it sits in, so the
    // banner came out short of the card's edge.
    <View style={styles.bannerWrap}>
    <TouchableOpacity
      style={styles.banner}
      onPress={open}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Posted in ${name}. Open the group.`}
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.segment }]} />
      )}

      {/* An even wash over the whole picture rather than a gradient off one
          edge. At this height the banner is a footnote to the post above it, and
          the flat scrim pushes the image back far enough that it reads as a
          label with a texture behind it rather than as a second photo competing
          with the post's own. */}
      <View
        style={[StyleSheet.absoluteFill, styles.scrim]}
        pointerEvents="none"
      />

      <View style={styles.bannerRow}>
        {/* A badge rather than the words "Posted in". At a glance the question
            is what kind of thing this row is, and the type badges elsewhere in
            the feed already answer that shape of question — this is the same
            badge a group carries anywhere else. */}
        <View style={styles.bannerBadge}>
          <Text style={styles.bannerBadgeText}>Group</Text>
        </View>
        <Text style={styles.bannerName} numberOfLines={1}>{name}</Text>
        <View style={styles.chevron}>
          <ChevronRight size={15} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        </View>
      </View>
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Inset and rounded like everything else in a feed card, rather than a
  // full-bleed band cutting across it. The inset is the wrapper's; the banner
  // takes the whole of what's left.
  bannerWrap: {
    alignSelf: 'stretch',
    marginHorizontal: 8, marginTop: 12, marginBottom: 4,
  },
  banner: {
    width: '100%',
    // A fixed height rather than `aspectRatio: 3`, which grew with the card and
    // made the group louder than the post on a wide screen. This is a row, and
    // a row's height doesn't depend on how much room it's given.
    height: 52,
    borderRadius: 10, overflow: 'hidden',
    justifyContent: 'center',
  },
  scrim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  bannerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12,
  },
  // Past the end of the scrim, so it gets a disc of its own to sit on.
  // Squared off rather than a disc, and darker than the scrim it sits on so it
  // reads as the thing you press rather than as part of the wash.
  chevron: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // The badge colour groups already wear in the feed's type badges.
  bannerBadge: {
    paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4,
    backgroundColor: colors.badgeGroup,
    flexShrink: 0,
  },
  bannerBadgeText: {
    fontSize: 9, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  // The shadow went with the gradient — an even scrim gives the text a
  // consistent ground, and a shadow on top of that just muddies it.
  bannerName: {
    flex: 1, minWidth: 0,
    fontSize: 13.5, fontWeight: '700', color: 'rgba(255,255,255,0.95)',
  },

  pillBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
    backgroundColor: colors.badgeGroup,
  },
  pillBadgeText: {
    fontSize: 8.5, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  pillThumb: { width: 22, height: 22, borderRadius: 5 },
  blank:     { alignItems: 'center', justifyContent: 'center' },
  pillName:  { fontSize: 12, fontWeight: '800', flexShrink: 1 },
});
