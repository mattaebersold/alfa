import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Lock } from 'lucide-react-native';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { List } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

interface Props {
  list: List;
  /**
   * `origin` is this row's rect on screen. A list opens as a summary panel now,
   * and the panel grows out of whatever was tapped — see SummaryTouchable.
   */
  onPress: (list: List, origin: SummaryOrigin | null) => void;
}

export default function ListCard({ list, onPress }: Props) {
  const colors = useColors();
  const coverUri = firstGalleryUrl(list.gallery);

  return (
    <SummaryTouchable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={(origin) => onPress(list, origin)}
      activeOpacity={0.8}
      accessibilityLabel={list.title}
    >
      {coverUri && (
        <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" />
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
            {list.title}
          </Text>
          {list.private && <Lock size={12} color={colors.grey} style={styles.lockIcon} />}
        </View>
        <View style={styles.meta}>
          <Text style={[styles.count, { color: colors.grey }]}>
            {list.item_count ?? 0} item{(list.item_count ?? 0) === 1 ? '' : 's'}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: COMMON_RADIUS,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cover: {
    width: 56,
    height: 56,
  },
  body: {
    flex: 1,
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
