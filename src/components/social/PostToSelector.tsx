import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Dimensions, type LayoutChangeEvent } from 'react-native';
import { Text } from '../../theme/Text';
import { Check, ChevronDown, ChevronUp, Globe, Users } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, SURFACE_BLACK, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

export interface PostToGroup { internal_id: string; title?: string }

const CARD_GAP = 8;
/**
 * A card's share of the row it sits in: two fit, and the part of the third
 * that shows is what says the row goes on. Measured off the row's own
 * width rather than the screen's, because the hosts wrap this in cards with
 * different paddings, and a fixed fraction of the screen inside the narrowest
 * of them left the third card with nothing to peek with.
 */
const CARD_FRACTION = 0.34;
/** Before the first layout has reported a width. */
const FALLBACK_WIDTH = Math.round(Dimensions.get('window').width * CARD_FRACTION);
/** One height for every card, so a long group name doesn't make its card taller. */
const CARD_HEIGHT = 96;
/** The scrolling row's: shorter, since it's one line of a longer form. */
const ROW_CARD_HEIGHT = 84;

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
 * for or against. Selection is carried by the whole card — tinted ground and
 * a filled check — with no border on either state.
 */
/** One choice card: an icon, a check, and its name under them. */
export interface ChoiceCardItem {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  active: boolean;
  onPress: () => void;
}

/**
 * The cards this picker is made of, on their own — a sideways row (or a
 * two-across grid) of choices you tick, the next one peeking in from the right.
 * Post To is one; the location card's recent places are another, so the two
 * read as the same kind of choice.
 */
export function ChoiceCardRow({ items, bleed = 0, layout = 'row' }: {
  items: ChoiceCardItem[];
  /** See PostToSelector's `bleed`. */
  bleed?: number;
  layout?: 'row' | 'grid';
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const [rowWidth, setRowWidth] = useState(0);
  const cardWidth = layout === 'grid'
    ? (rowWidth > 0 ? Math.floor((rowWidth - CARD_GAP) / 2) : FALLBACK_WIDTH)
    : (rowWidth > 0 ? Math.round(rowWidth * CARD_FRACTION) : FALLBACK_WIDTH);
  // Sized against the space inside the padding, as before the row bled out.
  const onLayout = (e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width - bleed * 2);

  const cards = items.map(({ key, label, Icon, active, onPress }) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.card,
        // Darker than the block they sit in, with a hairline edge; chosen,
        // the edge and the tint both take the brand colour.
        { width: cardWidth, height: layout === 'row' ? ROW_CARD_HEIGHT : CARD_HEIGHT, backgroundColor: SURFACE_BLACK, borderColor: colors.borderDark },
        active && { backgroundColor: brand + '1F', borderColor: brand },
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
        style={[styles.cardLabel, layout === 'row' && styles.cardLabelRow, { color: active ? colors.fg : colors.muted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  ));

  if (layout === 'grid') {
    return (
      <View style={styles.grid} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        {cards}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}
      // Card by card, so the peek stays put wherever the row is left.
      snapToInterval={cardWidth + CARD_GAP}
      snapToAlignment="start"
      decelerationRate="fast"
      keyboardShouldPersistTaps="handled"
      onLayout={onLayout}
    >
      {cards}
      <RowEndSpacer width={CARD_GAP} />
    </ScrollView>
  );
}

/** How many the checklist shows before "Show more" — three rows of two. */
const CHECKLIST_SHOWN = 6;

/**
 * Plain checkboxes, each as wide as its name, wrapping: a box and a name,
 * nothing tinted. Checked is a white box with a black tick and a white name;
 * unchecked, an outlined box and a grey name. Past six, the rest fold behind
 * "Show N more". The new-post form's Post To.
 */
function ChoiceChecklist({ items }: { items: ChoiceCardItem[] }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const overflow = items.length > CHECKLIST_SHOWN;
  const shown = overflow && !expanded ? items.slice(0, CHECKLIST_SHOWN) : items;
  const hidden = items.slice(CHECKLIST_SHOWN);
  const hiddenChecked = hidden.filter((i) => i.active).length;
  return (
    <View>
      <View style={styles.checkGrid}>
        {shown.map(({ key, label, active, onPress }) => (
          <TouchableOpacity
            key={key}
            style={styles.checkItem}
            onPress={onPress}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={label}
          >
            <View style={[
              styles.checkBox,
              active ? styles.checkBoxOn : { borderColor: colors.inputBorder },
            ]}>
              {active && <Check size={13} color={COLOR_BLACK} strokeWidth={3.5} />}
            </View>
            <Text style={[styles.checkLabel, { color: active ? COLOR_WHITE : colors.muted }]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {overflow && (
        <TouchableOpacity
          style={styles.moreRow}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <Text style={[styles.moreText, { color: colors.grey }]}>
            {expanded
              ? 'Show less'
              // Says when something ticked is folded away, so it isn't forgotten.
              : `Show ${hidden.length} more${hiddenChecked ? ` · ${hiddenChecked} checked` : ''}`}
          </Text>
          {expanded ? <ChevronUp size={15} color={colors.grey} /> : <ChevronDown size={15} color={colors.grey} />}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PostToSelector({
  isPublic,
  onTogglePublic,
  groups,
  selectedGroupIds,
  onToggleGroup,
  bleed = 0,
  layout = 'row',
}: {
  isPublic: boolean;
  onTogglePublic: () => void;
  groups: PostToGroup[];
  selectedGroupIds: string[];
  onToggleGroup: (groupId: string) => void;
  /**
   * The padding of whatever it sits in. The row reaches out past it to that
   * container's edges, so the cards scroll edge to edge, and the first one
   * still starts on the padding line — like the garage strip.
   */
  bleed?: number;
  /**
   * `row` scrolls sideways, one line however many groups (the post form).
   * `grid` lays the cards two across and wraps, every one in view at once —
   * the listing flow's last step, where the choice ends the form.
   * `checklist` is plain checkboxes, each its own width, folding past six (the post form).
   */
  layout?: 'row' | 'grid' | 'checklist';
}) {
  const items: ChoiceCardItem[] = [
    { key: '__public', label: layout === 'checklist' ? 'Public' : 'Post publicly', Icon: Globe, active: isPublic, onPress: onTogglePublic },
    ...groups.map((g) => ({
      key: g.internal_id,
      label: g.title ?? 'Group',
      Icon: Users,
      active: selectedGroupIds.includes(g.internal_id),
      onPress: () => onToggleGroup(g.internal_id),
    })),
  ];
  if (layout === 'checklist') return <ChoiceChecklist items={items} />;
  return <ChoiceCardRow items={items} bleed={bleed} layout={layout} />;
}

const styles = StyleSheet.create({
  row:  { gap: CARD_GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  card: {
    height: CARD_HEIGHT,
    borderRadius: COMMON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 13.5, fontFamily: FONT_INTER.bold, lineHeight: 18 },
  cardLabelRow: { fontSize: 11, lineHeight: 14 },

  // The checklist: each item as wide as its name, wrapping onto the next line.
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 20 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%' },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: COLOR_WHITE, borderColor: COLOR_WHITE },
  checkLabel: { flexShrink: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 14, paddingVertical: 2 },
  moreText: { fontSize: 13, fontFamily: FONT_INTER.semibold },
});
