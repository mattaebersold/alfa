import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, type LayoutChangeEvent } from 'react-native';
import { Check, Globe, Users } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

export interface PostToGroup { internal_id: string; title?: string }

const CARD_GAP = 8;
/**
 * A card's share of the row it sits in — the same proportion the "My Groups"
 * shelf on GroupsScreen uses: a little over two fit, and the part of the
 * third that shows is what says the row goes on. Measured off the row's own
 * width rather than the screen's, because the hosts wrap this in cards with
 * different paddings, and a fixed fraction of the screen inside the narrowest
 * of them left the third card with nothing to peek with.
 */
const CARD_FRACTION = 0.42;
/** Before the first layout has reported a width. */
const FALLBACK_WIDTH = Math.round(Dimensions.get('window').width * CARD_FRACTION);
/** One height for every card, so a long group name doesn't make its card taller. */
const CARD_HEIGHT = 96;

/**
 * Where a post goes: the public feed, a group, or both.
 *
 * A row of cards you scroll sideways, the next one peeking in from the right.
 * It was a two-up grid, which grew a row for every pair of groups — a member
 * of eight groups scrolled past a wall of tiles to reach the Post button. The
 * row takes one line of the form however many groups there are, and matches
 * the shelves elsewhere in the app (ListShelf, RouteStrip, GroupsScreen).
 *
 * Public stays first: it's the default, and the one every post is deciding
 * for or against. Selection is carried by the whole card — brand border,
 * tinted ground and a filled check — as it was on the tiles.
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
  const [rowWidth, setRowWidth] = useState(0);
  const cardWidth = rowWidth > 0 ? Math.round(rowWidth * CARD_FRACTION) : FALLBACK_WIDTH;
  const onLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width);

  const card = (
    key: string,
    label: string,
    Icon: typeof Globe,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.card,
        { width: cardWidth, backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
        active && { borderColor: brand, backgroundColor: brand + '1F' },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
    >
      <View style={styles.cardTop}>
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
        style={[styles.cardLabel, { color: active ? colors.fg : colors.muted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Card by card, so the peek stays put wherever the row is left.
      snapToInterval={cardWidth + CARD_GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      onLayout={onLayout}
    >
      {card('__public', 'Post publicly', Globe, isPublic, onTogglePublic)}
      {groups.map((g) =>
        card(
          g.internal_id,
          g.title ?? 'Group',
          Users,
          selectedGroupIds.includes(g.internal_id),
          () => onToggleGroup(g.internal_id),
        ))}
      <RowEndSpacer width={CARD_GAP} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: CARD_GAP },
  card: {
    height: CARD_HEIGHT,
    borderRadius: COMMON_RADIUS, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 13.5, fontWeight: '700', lineHeight: 18 },
});
