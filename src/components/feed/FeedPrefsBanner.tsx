import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { FONT_INTER } from '../../theme/fonts';
import { COMMON_RADIUS } from '../../theme/radius';
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
 * "Feed: Auto · Everything ⌄". Tapping it opens a summary with the feed's
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
  const contentLabel = on.length === FEED_CONTENT.length ? 'Everything'
    : on.length === 0 ? 'Nothing'
    : on.length <= 2 ? on.map((c) => c.label).join(', ')
    : `${on.length} of ${FEED_CONTENT.length} types`;

  return (
    <>
      <SummaryTouchable
        style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={open}
        activeOpacity={0.8}
        accessibilityLabel={`Feed settings: ${sortLabel}, ${contentLabel}`}
      >
        <SlidersHorizontal size={14} color={colors.grey} strokeWidth={2.4} />
        <Text style={[styles.bannerText, { color: colors.grey }]} numberOfLines={1}>
          Feed: <Text style={[styles.bannerStrong, { color: colors.fg }]}>{sortLabel}</Text>
          {'  ·  '}
          <Text style={[styles.bannerStrong, { color: colors.fg }]}>{contentLabel}</Text>
        </Text>
        <ChevronDown size={16} color={colors.fg} strokeWidth={2.4} />
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
          <FilterLabel>Order</FilterLabel>
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
                  <Text style={[styles.rowHint, { color: colors.grey }]}>{opt.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <FilterDivider />

          <FilterLabel>Show</FilterLabel>
          {FEED_CONTENT.map((opt) => {
            const checked = draftContent[opt.key];
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.row}
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
          <FilterDivider last />
        </View>
      </SummaryModal>
    </>
  );
}

const styles = StyleSheet.create({
  // The non-post cards' inset, so it lines up with the cards under it.
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: FEED_CARD_GUTTER, marginTop: 4,
    minHeight: 36, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: FONT_INTER.medium },
  bannerStrong: { fontFamily: FONT_INTER.semibold },

  body: { paddingTop: 14 },
  // 44pt targets, like the filter chips.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: FONT_INTER.semibold },
  rowHint: { fontSize: 12.5, fontFamily: FONT_INTER.regular, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
