import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { FONT_INTER } from '../../theme/fonts';
import { FEED_CARD_GUTTER } from '../../constants/config';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { FilterDivider, FilterLabel } from '../../filters/FilterSummaryRow';
import {
  useFeedPreferences, FEED_SORTS, FEED_CONTENT,
} from '../../hooks/useFeedPreferences';
import type { FeedContent, FeedSort } from '../../types/api';

/** Ink on a brand fill. */
const ON_FILL = '#000000';

/**
 * The home feed's settings, folded into one line above the first card —
 * "Auto ⌄" (with what's shown, when not everything is), in grey with no box around it. Tapping it opens a summary with the feed's
 * order and a checklist of the kinds of row it carries.
 *
 * Like the browse screens' filters (FilterSummaryRow), the panel works on a
 * draft: nothing changes until Apply, so trying an order doesn't refetch the
 * feed behind the panel on every tap. Applied, it's saved to the account
 * (User.feedPreferences) and follows the member to the web and other phones.
 */
export default function FeedPrefsBanner() {
  const colors = useColors();
  const brand = useBrandColor();
  const { feedSort, feedContent, setFeedPrefs } = useFeedPreferences();

  // Undefined while closed; the rect it grows from while open.
  const [origin, setOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const [draftSort, setDraftSort] = useState<FeedSort>(feedSort);
  const [draftContent, setDraftContent] = useState<FeedContent>(feedContent);

  const open = (from: SummaryOrigin | null) => {
    // Every open starts from what's applied; closing without Apply discards.
    setDraftSort(feedSort);
    setDraftContent(feedContent);
    setOrigin(from);
  };

  const apply = () => {
    const changed = FEED_CONTENT.filter(({ key }) => draftContent[key] !== feedContent[key]);
    if (draftSort === feedSort && !changed.length) return;
    setFeedPrefs({
      ...(draftSort !== feedSort ? { sort: draftSort } : {}),
      ...(changed.length ? { content: Object.fromEntries(changed.map(({ key }) => [key, draftContent[key]])) } : {}),
    });
  };

  const sortLabel = FEED_SORTS.find((s) => s.key === feedSort)?.label ?? 'Auto';
  const on = FEED_CONTENT.filter(({ key }) => feedContent[key]);
  // Nothing to say when it's all on — the default isn't worth a word.
  const contentLabel = on.length === FEED_CONTENT.length ? ''
    : on.length === 0 ? 'Nothing'
    : on.length <= 2 ? on.map((c) => c.label).join(', ')
    : `${on.length} of ${FEED_CONTENT.length} types`;

  return (
    <>
      <SummaryTouchable
        style={styles.banner}
        onPress={open}
        activeOpacity={0.8}
        accessibilityLabel={`Feed settings: ${sortLabel}${contentLabel ? `, ${contentLabel}` : ''}`}
      >
        <SlidersHorizontal size={14} color={colors.grey} strokeWidth={2.4} />
        <Text style={[styles.bannerText, { color: colors.grey }]} numberOfLines={1}>
          {sortLabel}{contentLabel ? `   ${contentLabel}` : ''}
        </Text>
        <ChevronDown size={16} color={colors.grey} strokeWidth={2.4} />
      </SummaryTouchable>

      <SummaryModal
        visible={origin !== undefined}
        onClose={() => setOrigin(undefined)}
        origin={origin}
        actionLabel="Apply"
        actionRounded
        onAction={apply}
      >
        <View style={styles.body}>
          {FEED_SORTS.map((opt) => {
            const active = draftSort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.row}
                onPress={() => setDraftSort(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.radio, { borderColor: active ? brand : colors.borderDark }]}>
                  {active ? <View style={[styles.radioDot, { backgroundColor: brand }]} /> : null}
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.fg }]}>{opt.label}</Text>
                  {opt.description ? (
                    <Text style={[styles.rowHint, { color: colors.grey }]}>{opt.description}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}

          <FilterDivider />

          <FilterLabel>Show</FilterLabel>
          {/* Two columns: short labels, so a single file of them ran long. */}
          <View style={styles.grid}>
          {FEED_CONTENT.map((opt) => {
            const checked = draftContent[opt.key];
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.row, styles.gridCell]}
                onPress={() => setDraftContent((d) => ({ ...d, [opt.key]: !d[opt.key] }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <View
                  style={[
                    styles.box,
                    checked ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.borderDark },
                  ]}
                >
                  {checked ? <Check size={12} color={ON_FILL} strokeWidth={3.5} /> : null}
                </View>
                <Text style={[styles.rowLabel, { color: colors.fg }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
          </View>
          <FilterDivider last />
        </View>
      </SummaryModal>
    </>
  );
}

const styles = StyleSheet.create({
  // No box: a tight line of grey over the feed, at the non-post cards' inset.
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: FEED_CARD_GUTTER, marginTop: 6,
    paddingHorizontal: 4, paddingVertical: 0,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },

  body: { paddingTop: 14 },
  // 44pt targets, like the filter chips.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6 },
  rowText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '50%' },
  rowLabel: { fontSize: 15, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  rowHint: { fontSize: 12.5, fontFamily: FONT_INTER.regular, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
