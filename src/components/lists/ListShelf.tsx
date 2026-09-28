import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { ChevronRight, Lock, Plus } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import ListPreviewMosaic from './ListPreviewMosaic';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import type { List } from '../../types/api';
import { COMMON_RADIUS, COLOR_GRAY_23, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** As many as fit before "View all" is the better answer — same as PostStrip. */
export const LIST_SHELF_PREVIEW_COUNT = 6;

const CARD_GAP = 12;
const ROW_PAD_LEFT = 12;
const CARD_WIDTH = 168;
/** Tall enough that the three-up mosaic's small tiles are still pictures, not swatches. */
const PREVIEW_HEIGHT = 104;
/** The post cards' shade — see PostStrip's `cardBackground` on the profile. */
const CARD_BG = COLOR_GRAY_23;

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
  const brand = useBrandColor();
  const brandText = useBrandTextColor();

  if (lists.length === 0 && !onAdd) return null;
  const hasMore = !!onViewAll && (total ?? lists.length) > lists.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headActions}>
          {/* Empty, the panel below is the button — one is enough. */}
          {onAdd && lists.length > 0 && (
            <TouchableOpacity
              // Brand-filled: a grey chip beside the heading read as a tag,
              // not as the one thing on the shelf you can do.
              style={[styles.addBtn, { backgroundColor: brand }]}
              onPress={onAdd}
              hitSlop={8}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={addLabel}
            >
              <Plus size={13} color={brandText} strokeWidth={2.6} />
              <Text style={[styles.addText, { color: brandText }]}>{addLabel}</Text>
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
        // Only the owner gets here (see the early return). A line of grey text
        // was easy to scroll past; a panel the width of the shelf, that opens
        // the form, says there's something to put here.
        <TouchableOpacity
          style={[styles.emptyPanel, { borderColor: colors.borderDark }]}
          onPress={onAdd}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <View style={[styles.emptyIcon, { backgroundColor: brand }]}>
            <Plus size={18} color={brandText} strokeWidth={2.8} />
          </View>
          <View style={styles.emptyText}>
            <Text style={[styles.emptyTitle, { color: colors.fg }]}>{addLabel}</Text>
            {emptyHint ? <Text style={[styles.hint, { color: colors.grey }]}>{emptyHint}</Text> : null}
          </View>
        </TouchableOpacity>
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
                // The post cards' darker shade, so the page's shelves match.
                style={[styles.card, { backgroundColor: CARD_BG, borderColor: colors.borderDark }]}
                onPress={(origin) => onListPress(list, origin)}
                accessibilityLabel={`${list.title}, ${count} item${count === 1 ? '' : 's'}`}
              >
                {/* What's on it, not just what's on the front of it — see ListPreviewMosaic. */}
                <View>
                  <ListPreviewMosaic list={list} height={PREVIEW_HEIGHT} />
                  {/* The count rides on the picture, so the text below is just
                      the title — the same shape as a post card's caption. */}
                  <View style={styles.countBadge}>
                    {list.private ? <Lock size={10} color={COLOR_WHITE} /> : null}
                    <Text style={styles.countBadgeText}>
                      {count} item{count === 1 ? '' : 's'}
                      {/* Only ever sent to the author — nobody else receives a draft. */}
                      {list.status === 'draft' ? ' · Draft' : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardText}>
                  <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={2}>{list.title}</Text>
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
  title:       { fontSize: 17, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: COMMON_RADIUS,
  },
  addText:     { fontSize: 12, fontFamily: FONT_INTER.extrabold },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  hint:        { fontSize: 13, lineHeight: 18 },
  emptyPanel: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: ROW_PAD_LEFT, padding: 16,
    borderRadius: COMMON_RADIUS, borderWidth: 1.5, borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText:  { flex: 1, gap: 3 },
  emptyTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: {
    width: CARD_WIDTH, borderRadius: COMMON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  // Same padding and type as a post card's caption (PostStrip).
  cardText:  { padding: 10 },
  cardTitle: { fontSize: 13, fontFamily: FONT_INTER.semibold, lineHeight: 17 },
  countBadge: {
    position: 'absolute', left: 8, bottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  countBadgeText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
