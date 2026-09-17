import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import RouteCard from '../cards/RouteCard';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import type { DrivingRoute } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** As many as fit before "View all" is the better answer — same as PostStrip. */
export const ROUTE_STRIP_PREVIEW_COUNT = 6;

const CARD_GAP = 12;
const ROW_PAD_LEFT = 12;
/**
 * Wide enough for the trace plus a readable column of words beside it, short
 * of full width so the next card peeks out and says the row scrolls — the same
 * bargain the garage carousel strikes.
 */
const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 360);

/**
 * A shelf of recorded drives — a handful of them, sideways, with the rest
 * behind a button.
 *
 * The same shape PostStrip gives a page's posts, for the same reason: a count
 * on a tile is a poor substitute for seeing the drives themselves. The cards
 * are RouteCard in `compact` — the feed card minus its action bar, which has
 * no business inside a row that swipes the same way its buttons sit.
 *
 * Purely presentational: the host owns the fetching and what "View all" opens,
 * because a profile and a car page answer those differently.
 */
export default function RouteStrip({
  title,
  routes,
  total,
  onRoutePress,
  onViewAll,
}: {
  title: string;
  routes: DrivingRoute[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  /** Overrides opening the route, for hosts that must close a sheet first. */
  onRoutePress?: (route: DrivingRoute) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();

  // Nothing to show is nothing to say — an empty shelf reads as something
  // failing to load.
  if (routes.length === 0) return null;
  const hasMore = (total ?? routes.length) > routes.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total} routes`}
          >
            <Text style={[styles.viewAllText, { color: colors.primaryAlt }]}>View all</Text>
            <ChevronRight size={14} color={colors.primaryAlt} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        // Card-by-card rather than page-by-page, so the peek stays put.
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {routes.map((route) => (
          <View key={route.internal_id} style={styles.item}>
            {/* The feed card takes whatever width it's given; here it's given
                the shelf's, plus a border and corners so a card reads as a
                card rather than as a slab of the page. */}
            <RouteCard
              route={route}
              compact
              style={[styles.card, { borderColor: colors.borderDark }]}
              onPress={onRoutePress ? () => onRoutePress(route) : undefined}
            />
          </View>
        ))}
        <RowEndSpacer width={ROW_PAD_LEFT} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title:       { fontSize: 17, fontWeight: '800' },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  item: { width: CARD_WIDTH },
  // Drops the feed card's vertical margins — the row supplies the rhythm here.
  card: {
    marginVertical: 0, paddingBottom: 12,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
