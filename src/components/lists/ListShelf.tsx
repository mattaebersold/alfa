import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, Lock, Plus } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import ListPreviewMosaic from './ListPreviewMosaic';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import type { List } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** As many as fit before "View all" is the better answer — same as PostStrip. */
export const LIST_SHELF_PREVIEW_COUNT = 6;

const CARD_GAP = 12;
const ROW_PAD_LEFT = 12;
const CARD_WIDTH = 168;
/** Tall enough that the three-up mosaic's small tiles are still pictures, not swatches. */
const PREVIEW_HEIGHT = 104;

/**
 * A shelf of lists — a handful, sideways, with the rest behind "View all".
 *
 * The same shape RouteStrip and PostStrip give a page's drives and posts, used
 * on a profile (the member's lists) and on a car's page (that car's). Purely
 * presentational, for the same reason those are: the two hosts fetch different
 * things and mean different things by "add".
 *
 * Renders nothing when there's nothing to show *and* nothing to offer — an
 * empty shelf on somebody else's page reads as something failing to load. With
 * `onAdd` it stays, because for its owner the empty shelf is the invitation.
 */
export default function ListShelf({
  title,
  lists,
  total,
  onListPress,
  onViewAll,
  onAdd,
  addLabel = 'New list',
  emptyHint,
}: {
  title: string;
  lists: List[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  /** `origin` is the card's rect, for the summary panel to grow out of. */
  onListPress: (list: List, origin: SummaryOrigin | null) => void;
  onViewAll?: () => void;
  /** The owner's way to make one. The host decides whether that's a form or the Pro pitch. */
  onAdd?: () => void;
  addLabel?: string;
  /** One line under the heading while the shelf is empty — only ever seen by the owner. */
  emptyHint?: string;
}) {
  const colors = useColors();

  if (lists.length === 0 && !onAdd) return null;
  const hasMore = !!onViewAll && (total ?? lists.length) > lists.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headActions}>
          {onAdd && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.segment }]}
              onPress={onAdd}
              hitSlop={8}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={addLabel}
            >
              <Plus size={13} color={colors.fg} strokeWidth={2.6} />
              <Text style={[styles.addText, { color: colors.fg }]}>{addLabel}</Text>
            </TouchableOpacity>
          )}
          {hasMore && (
            <TouchableOpacity
              style={styles.viewAll}
              onPress={onViewAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`View all ${total} lists`}
            >
              <Text style={[styles.viewAllText, { color: colors.primaryAlt }]}>View all</Text>
              <ChevronRight size={14} color={colors.primaryAlt} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {lists.length === 0 ? (
        emptyHint ? <Text style={[styles.hint, { color: colors.grey }]}>{emptyHint}</Text> : null
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          // Card-by-card rather than page-by-page, so the peek stays put.
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {lists.map((list) => {
            const count = list.item_count ?? (list.items ?? []).filter((i) => !i.deleted).length;
            return (
              <SummaryTouchable
                key={list.internal_id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
                onPress={(origin) => onListPress(list, origin)}
                accessibilityLabel={`${list.title}, ${count} item${count === 1 ? '' : 's'}`}
              >
                {/* What's on it, not just what's on the front of it — see ListPreviewMosaic. */}
                <ListPreviewMosaic list={list} height={PREVIEW_HEIGHT} />
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={2}>{list.title}</Text>
                  <View style={styles.cardMeta}>
                    <Text style={[styles.cardCount, { color: colors.grey }]}>
                      {count} item{count === 1 ? '' : 's'}
                    </Text>
                    {list.private ? <Lock size={10} color={colors.grey} /> : null}
                    {/* Only ever sent to the author — nobody else receives a draft. */}
                    {list.status === 'draft' ? (
                      <Text style={[styles.cardCount, { color: colors.grey }]}>· Draft</Text>
                    ) : null}
                  </View>
                </View>
              </SummaryTouchable>
            );
          })}
          <RowEndSpacer width={ROW_PAD_LEFT} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, gap: 12,
  },
  title:       { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: COMMON_RADIUS,
  },
  addText:     { fontSize: 12, fontWeight: '800' },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },
  hint:        { fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: {
    width: CARD_WIDTH, borderRadius: COMMON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  cardText:  { paddingHorizontal: 10, paddingVertical: 9, gap: 3 },
  // Two lines reserved whether or not they're used, so a shelf of mixed title
  // lengths keeps one baseline for its counts.
  cardTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18, minHeight: 36 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardCount: { fontSize: 12, fontWeight: '600' },
});
