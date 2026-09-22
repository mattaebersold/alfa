import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';
import ListPreviewMosaic from './ListPreviewMosaic';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import type { List } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/**
 * Shorter than the shelf card's preview: this card is full width, so at 104
 * the hero tile would be a letterbox, and a pane of these is a scroll, not a
 * glance — each one needs to give way to the next sooner.
 */
const PREVIEW_HEIGHT = 96;

interface Props {
  list: List;
  /**
   * `origin` is this row's rect on screen. A list opens as a summary panel now,
   * and the panel grows out of whatever was tapped — see SummaryTouchable.
   */
  onPress: (list: List, origin: SummaryOrigin | null) => void;
}

/**
 * A list in a vertical stack — the profile's "View all" pane.
 *
 * Preview on top, words beneath, the same order as the shelf card, so a list
 * looks like the same list whether you meet it sideways or in the full pane.
 */
export default function ListCard({ list, onPress }: Props) {
  const colors = useColors();
  // The server sends a count with the summary; a payload that carries the
  // items but not the number still knows how many it has.
  const count = list.item_count ?? (list.items ?? []).filter((i) => !i.deleted).length;

  return (
    <SummaryTouchable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={(origin) => onPress(list, origin)}
      activeOpacity={0.8}
      accessibilityLabel={`${list.title}, ${count} item${count === 1 ? '' : 's'}`}
    >
      {/* What's on it, not just what's on the front of it — see ListPreviewMosaic. */}
      <ListPreviewMosaic list={list} height={PREVIEW_HEIGHT} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
            {list.title}
          </Text>
          {list.private && <Lock size={12} color={colors.grey} style={styles.lockIcon} />}
        </View>
        <View style={styles.meta}>
          <Text style={[styles.count, { color: colors.grey }]}>
            {count} item{count === 1 ? '' : 's'}
          </Text>
          {/* Only ever sent to the author — nobody else receives a draft. */}
          {list.status === 'draft' ? (
            <View style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.muted }]}>Draft</Text>
            </View>
          ) : null}
          {list.category ? (
            <View style={[styles.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.muted }]}>{list.category}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: COMMON_RADIUS,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  lockIcon: {
    flexShrink: 0,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  count: {
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
});
