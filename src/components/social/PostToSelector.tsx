import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Globe, Users } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';

export interface PostToGroup { internal_id: string; title?: string }

/**
 * Where a post goes: the public feed, a group, or both.
 *
 * Tiles rather than a list of checkbox rows. These are destinations you pick
 * between, and a stack of rows made the choice look like a settings screen —
 * you read it top to bottom instead of seeing your options at once. Two to a
 * row is what fits a group's name without truncating most of them.
 *
 * Selection is carried by the whole tile — brand border, tinted ground and a
 * filled check — rather than by a small box on the left, so a glance tells you
 * where this is going.
 */
export default function PostToSelector({
  isPublic,
  onTogglePublic,
  groups,
  selectedGroupIds,
  onToggleGroup,
}: {
  isPublic: boolean;
  onTogglePublic: () => void;
  groups: PostToGroup[];
  selectedGroupIds: string[];
  onToggleGroup: (groupId: string) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  const tile = (
    key: string,
    label: string,
    Icon: typeof Globe,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.tile,
        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
        active && { borderColor: brand, backgroundColor: brand + '1F' },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <View style={styles.tileTop}>
        <Icon size={18} color={active ? brand : colors.grey} />
        <View style={[
          styles.check,
          { borderColor: active ? brand : colors.inputBorder },
          active && { backgroundColor: brand },
        ]}>
          {active && <Check size={11} color={contrastText(brand)} strokeWidth={3.5} />}
        </View>
      </View>
      <Text
        style={[styles.tileLabel, { color: active ? colors.fg : colors.muted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.grid}>
      {tile('__public', 'Post publicly', Globe, isPublic, onTogglePublic)}
      {groups.map((g) =>
        tile(
          g.internal_id,
          g.title ?? 'Group',
          Users,
          selectedGroupIds.includes(g.internal_id),
          () => onToggleGroup(g.internal_id),
        ))}
      {/* An odd number of tiles would otherwise stretch the last one across
          the row. */}
      {(groups.length + 1) % 2 === 1 && <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    // Two per row, with the gap between them taken off each.
    width: '47.8%', flexGrow: 1,
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 12,
    gap: 10,
  },
  spacer: { width: '47.8%', flexGrow: 1 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: { fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
});
