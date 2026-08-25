import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Users } from 'lucide-react-native';
import { useGetGroupQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
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
        <Text style={[styles.pillLabel, { color: colors.grey }]}>Posted in</Text>
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

      {/* The label sits on the picture, so the scrim has to carry white text
          over whatever the group happens to use as its banner. It runs left to
          right and fades out: the words are on the left and need the cover,
          the right is where the picture gets to be a picture. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.28)', 'transparent']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.bannerRow}>
        <View style={styles.bannerText}>
          <Text style={styles.bannerLabel}>Posted in</Text>
          <Text style={styles.bannerName} numberOfLines={1}>{name}</Text>
        </View>
        <View style={styles.chevron}>
          <ChevronRight size={18} color="#FFFFFF" strokeWidth={3} />
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
    marginHorizontal: 12, marginTop: 18, marginBottom: 4,
  },
  banner: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: 12, overflow: 'hidden',
    justifyContent: 'center',
  },
  bannerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14,
  },
  bannerText:  { flex: 1, minWidth: 0 },
  // Past the end of the scrim, so it gets a disc of its own to sit on.
  chevron: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bannerLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase', letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  bannerName: {
    fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', marginTop: 6,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  pillThumb: { width: 22, height: 22, borderRadius: 5 },
  blank:     { alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  pillName:  { fontSize: 12, fontWeight: '800', flexShrink: 1 },
});
