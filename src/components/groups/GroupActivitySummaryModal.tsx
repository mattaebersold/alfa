import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import GroupItemActions from './GroupItemActions';
import { GROUP_KIND } from '../feed/GroupActivityCard';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import type { GroupActivityItem } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A group post, answered in place over the home feed.
 *
 * The feed's group card is a notice; this is enough of the post to decide
 * whether it's worth going to — the picture, the words, a like and the
 * comments. The
 * conversation lives in the group, and the button at the foot goes there.
 */
export default function GroupActivitySummaryModal({ item, origin, onClose, onViewInGroup }: {
  item: GroupActivityItem | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
  /** Runs once the panel has closed — a navigation, see SummaryModal. */
  onViewInGroup: (item: GroupActivityItem) => void;
}) {
  const colors = useColors();
  if (!item) return <SummaryModal visible={false} onClose={onClose}>{null}</SummaryModal>;

  const spec = GROUP_KIND[item.kind] ?? GROUP_KIND.discussion;
  const { Icon } = spec;
  const hero = firstGalleryUrl(item.gallery);
  const body = item.body ? stripHtml(item.body).trim() : '';
  const timeAgo = item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : '';

  return (
    <SummaryModal
      visible
      onClose={onClose}
      origin={origin}
      actionLabel="View it in the group"
      actionPill
      onAction={() => onViewInGroup(item)}
    >
      {hero ? <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" /> : null}

      <View style={styles.body}>
        <View style={styles.context}>
          <View style={[styles.badge, { backgroundColor: spec.color }]}>
            <Icon size={11} color={palette.badgeFg} strokeWidth={2.4} />
            <Text style={[styles.badgeText, { color: palette.badgeFg }]}>{spec.label}</Text>
          </View>
          <Text style={[styles.group, { color: colors.grey }]} numberOfLines={1}>
            {item.group?.title ?? 'Group'}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.fg }]}>{item.title || 'Untitled'}</Text>

        <View style={styles.meta}>
          <Avatar user={item.user as any} size={24} />
          <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>
            {item.user?.username ? `@${item.user.username}` : 'A member'}{timeAgo ? ` · ${timeAgo}` : ''}
          </Text>
        </View>

        {body ? (
          <Text style={[styles.text, { color: colors.fg }]} numberOfLines={12}>{body}</Text>
        ) : null}

        {item.kind === 'resource' && item.url ? (
          <TouchableOpacity
            style={[styles.link, { borderColor: colors.border }]}
            onPress={() => Linking.openURL(item.url!)}
            accessibilityRole="link"
          >
            <ExternalLink size={14} color={colors.primaryAlt} />
            <Text style={[styles.linkText, { color: colors.primaryAlt }]} numberOfLines={1}>{item.url}</Text>
          </TouchableOpacity>
        ) : null}

        <GroupItemActions kind={item.kind} item={item} style={styles.votes} />
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: 16, gap: 10 },

  context: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold, letterSpacing: 0 },
  group:     { flex: 1, fontSize: 12, fontFamily: FONT_INTER.semibold },

  title:    { fontSize: 19, fontFamily: FONT_INTER.bold, lineHeight: 25 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flexShrink: 1, fontSize: 12, fontFamily: FONT_INTER.medium },
  text:     { fontSize: 14.5, lineHeight: 22 },

  link: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  linkText: { flex: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },
  votes:    { flexDirection: 'row', marginTop: 4 },
});
