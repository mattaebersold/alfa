import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SubTabs from '../ui/SubTabs';
import UnderlineTabs from '../ui/UnderlineTabs';
import {
  View, StyleSheet, Animated, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '../../theme/Text';
import { Tag, ListFilter } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeading from '../ui/ScreenHeading';
import EmptyState from '../ui/EmptyState';
import FilterSummaryRow, { type FilterPill, COMPACT_FILTER_HEIGHT } from '../ui/FilterSummaryRow';
import SearchPill from '../ui/SearchPill';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../ui/LocationFilterRow';
import ListingCard from './ListingCard';
import ManageListingsEntry from './ManageListingsEntry';
import ListingSummaryModal from './ListingSummaryModal';
import { categoryLabel } from './listingFormat';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useGetListingsQuery, useGetListingMetaQuery, useGetUsageQuery } from '../../api/apiService';
import { ProUpsellModal } from '../pro/ProUpsell';
import {
  LISTING_LIMIT_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK, COLOR_WHITE, GUTTER, SURFACE_DARK, SURFACE_MID
} from '../../constants/config';
import { useLocationFilter, useNearFallback, isNear } from '../../hooks/useLocationFilter';
import NoResultsNear from '../ui/NoResultsNear';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import type { Listing, ListingKind, ListingShipping, ListingSort } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { SkeletonGrid } from '../ui/Skeleton';

const PAGE_SIZE = 12;
/** The list's one item — see the mosaic in the FlatList below. */
const MOSAIC = ['mosaic'];

/**
 * Everything the panel asks — where, category, condition, shipping and price,
 * in any combination — plus the sort, which orders rather than filters.
 */
interface MarketFilters {
  /** A LocationChoice: 'near', 'all' or a region key. */
  location: string;
  /** One category key, or null for all of them. */
  category: string | null;
  /** A floor on the 0-5 scale — "Good or better". */
  conditionMin: number | null;
  shipping: ListingShipping | null;
  minPrice: string;
  maxPrice: string;
  sort: ListingSort;
}

/**
 * How the list is ordered.
 *
 * 'match' is the default and does the work the marketplace exists for: the
 * server floats listings that fit a car in your garage, nearest first
 * underneath. Distance is only offered once there's a point from which to
 * measure.
 */
const SORT_OPTIONS: { key: ListingSort; label: string; needsLocation?: boolean }[] = [
  { key: 'match',      label: 'Best match' },
  { key: 'recent',     label: 'Newest' },
  { key: 'price_asc',  label: 'Price: low' },
  { key: 'price_desc', label: 'Price: high' },
  { key: 'distance',   label: 'Nearest', needsLocation: true },
];

const SHIPPING_OPTIONS: { key: ListingShipping | null; label: string }[] = [
  { key: null,     label: 'Any' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'ship',   label: 'Ships' },
  { key: 'both',   label: 'Either' },
];

/** A price box's contents as the API wants it — never NaN, which matches nothing. */
const asPrice = (v: string): number | undefined => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : undefined;
};

/**
 * The marketplace, as a list you can drop anywhere.
 *
 * For sale on one side, want ads on the other, and one row of filters over
 * both. It browses the listing collection (`/api/marketplace`) rather than the
 * posts the old marketplace read — see horacio's models/Listing.js for why
 * those are two different things.
 *
 * The default is near you with your garage's makes floated to the top, and that
 * ordering is the server's: every card that was lifted says so, because a list
 * reordered without saying why reads as a list in no order at all.
 *
 * Two hosts share this: the Marketplace tab, which wraps it in the app header
 * and a heading, and a group's Market section, which passes `groupId` and gets
 * the same browse narrowed to what was posted into that group. Extracted rather
 * than copied because the two were the same screen, and "the same" is not
 * something two copies stay.
 */
export default function MarketplaceBrowse({
  groupId,
  heading,
  listRef,
  onScroll,
  contentContainerStyle,
  style,
  stickyTop = 0,
  ground = SURFACE_DARK,
  embedded = false,
  cardBackground,
  lockKind,
  hideManageEntry = false,
}: {
  /**
   * Narrow to one group's listings. The server reads it as "only things in
   * this group" — `group_id` against the listing's `group_ids` — so nothing
   * public leaks into a group's market and nothing group-only leaks out.
   */
  groupId?: string;
  /** Shown above the list, scrolling away with it. Omitted where the host titles itself. */
  heading?: string;
  /** Typed loosely: the list's one item is the mosaic, not a listing. */
  listRef?: React.Ref<FlatList<any>>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The host's padding — a header to clear, a tab bar to sit above. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /**
   * How far down the list the switch and search pin once scrolled to — under
   * a floating header, say, following it as it hides. The list's own top when
   * omitted.
   */
  stickyTop?: number | Animated.Value | Animated.AnimatedInterpolation<number>;
  /**
   * The browse's own ground — painted here, so every host gets it, and the
   * pinned search bar matches it as it slides over the list. A step lighter
   * than the app's black by default, so the sub tabs' dark tracks have an
   * edge against it; a group's market passes its page's own.
   */
  ground?: string;
  /**
   * Drawn into a host's own scroller — a group page's Marketplace tab — rather
   * than as a list of its own: the same switch, categories, search, filter and
   * mosaic, laid out in the flow, with nothing pinned. Its first page only;
   * the host links on to the whole browse. No + and no "your listings" card
   * either — the host's tab has its own "New".
   */
  embedded?: boolean;
  /** The listing cards' fill, when the host's ground calls for another — see ListingCard. */
  cardBackground?: string;
  /**
   * Fix the browse to one half of the market and drop the For sale / Want ads
   * switch — for a host that gives each half a screen of its own (the home
   * header's Marketplace › Listings and Want Ads). Omitted, both, switchable.
   */
  lockKind?: ListingKind;
  /**
   * Leave out the "Your Listings" card at the top — for a host that has a
   * screen of its own for them (Marketplace › My Listings).
   */
  hideManageEntry?: boolean;
}) {
  const nav = useNavigation<any>();
  const colors = useColors();
  const brand = useBrandColor();
  const isPro = useIsPro();

  /**
   * What's left of this month's listings — the same read the events screen
   * does before its add button. Pro has nothing to count and doesn't ask; a
   * server that doesn't report `listings` gates nothing.
   */
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const listingAllowance = !isPro && usage?.listings?.limit != null ? usage.listings : null;
  // At the limit the plus opens the pitch rather than a form the server will
  // refuse after five steps of it have been filled in.
  const [upsell, setUpsell] = useState(false);
  /** The category row — hidden until the filter button beside the search opens it. */
  const [showTypes, setShowTypes] = useState(false);

  const [pickedKind, setKind] = useState<ListingKind>(lockKind ?? 'sale');
  // A locked host's kind wins over the switch's, which it doesn't show.
  const kind = lockKind ?? pickedKind;

  // The sticky bar: where it sits in the list (barY, in content), how tall it
  // is, and the scroll — so it can ride with the list until it reaches
  // stickyTop, then hold there. All on the native driver.
  const scrollY = useRef(new Animated.Value(0)).current;
  const barY = useRef(new Animated.Value(0)).current;
  const [barH, setBarH] = useState(0);
  const padTop = Number(StyleSheet.flatten(contentContainerStyle)?.paddingTop ?? 0) || 0;
  const barTranslate = useMemo(() => {
    const top = typeof stickyTop === 'number' ? new Animated.Value(stickyTop) : stickyTop;
    // max(barY - scroll, top), as top + max(barY - scroll - top, 0).
    const below = Animated.subtract(Animated.subtract(barY, scrollY), top)
      .interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });
    return Animated.add(top, below);
  }, [stickyTop, barY, scrollY]);
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true, listener: onScroll },
  ), [scrollY, onScroll]);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  // The categories and condition labels come from the server, so the filter UI
  // can't drift from the collection it describes.
  const { data: meta } = useGetListingMetaQuery();

  const location = useLocationFilter();
  const [filters, setFilters] = useState<MarketFilters>({
    location: 'near',
    category: null,
    conditionMin: null,
    shipping: null,
    minPrice: '',
    maxPrice: '',
    sort: 'match',
  });

  const params = useMemo(() => ({
    kind,
    page,
    limit: PAGE_SIZE,
    // A group's market is the whole group's, wherever its members are: no
    // radius, so no "near me".
    ...(groupId ? { group_id: groupId } : location.params),
    ...(activeSearch ? { q: activeSearch } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    // A want ad has no condition — it has a wish — so the floor is only ever
    // sent on the sale side, where the server stores one.
    ...(kind === 'sale' && filters.conditionMin !== null ? { condition_min: filters.conditionMin } : {}),
    ...(filters.shipping ? { shipping: filters.shipping } : {}),
    ...(asPrice(filters.minPrice) !== undefined ? { min_price: asPrice(filters.minPrice) } : {}),
    ...(asPrice(filters.maxPrice) !== undefined ? { max_price: asPrice(filters.maxPrice) } : {}),
    sort: filters.sort,
  }), [kind, page, location.params, groupId, activeSearch, filters]);

  const { data, isFetching, isLoading, refetch } = useGetListingsQuery(params);

  // Near me couldn't be answered — the server sent everything instead, and the
  // note under the row says why rather than leaving an empty-looking market.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);

  // Nothing near you: say so, then everything (same search and filters) under
  // "Other results". Changing those asks near me again first. Not in a
  // group's market, which has no location.
  useNearFallback(location, {
    settled: !groupId && !!data && !isFetching && !data.near_unavailable,
    empty: (data?.entries?.length ?? 0) === 0,
    key: JSON.stringify([kind, activeSearch, filters]),
  });
  const nearEmpty = !groupId && location.others
    ? <NoResultsNear radius={location.radius} style={styles.nearEmpty} />
    : null;

  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setEntries(data.entries);
    else setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.internal_id));
      return [...prev, ...data.entries.filter((e) => !seen.has(e.internal_id))];
    });
  }, [data, page]);

  /**
   * Start the list again.
   *
   * Every filter change does, because a page 2 of the old query appended to a
   * page 1 of the new one is a list of two different searches.
   */
  const restart = useCallback(() => {
    setPage(0);
    setEntries([]);
  }, []);

  const applyFilters = useCallback((draft: MarketFilters) => {
    // Only a real change restarts: applying the same thing would empty the list
    // and get the cached page straight back, which never re-runs the effect
    // that fills it.
    const same =
      draft.location === location.choice
      && draft.category === filters.category
      && draft.conditionMin === filters.conditionMin
      && draft.shipping === filters.shipping
      && draft.minPrice === filters.minPrice
      && draft.maxPrice === filters.maxPrice
      && draft.sort === filters.sort;
    if (same) return;

    if (draft.location !== location.choice) location.choose(draft.location);
    setFilters(draft);
    restart();
  }, [location, filters, restart]);

  const switchKind = useCallback((next: ListingKind) => {
    if (next === kind) return;
    setKind(next);
    restart();
  }, [kind, restart]);

  const runSearch = useCallback(() => {
    const next = search.trim();
    if (next === activeSearch) return;
    setActiveSearch(next);
    restart();
  }, [search, activeSearch, restart]);

  const clearSearch = useCallback(() => {
    setSearch('');
    if (!activeSearch) return;
    setActiveSearch('');
    restart();
  }, [activeSearch, restart]);

  const loadMore = useCallback(() => {
    if (!isFetching && data && entries.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, entries.length]);

  const handleRefresh = useCallback(() => {
    restart();
    refetch();
  }, [restart, refetch]);

  /**
   * What the row shows as applied: where, then each filter that's on, and
   * the sort when it isn't the default.
   */
  const pills: FilterPill[] = useMemo(() => {
    const out: FilterPill[] = [];
    const min = asPrice(filters.minPrice);
    const max = asPrice(filters.maxPrice);
    const conditionLabel = kind === 'sale' && filters.conditionMin !== null
      ? meta?.conditions?.[filters.conditionMin] : undefined;
    out.push(locationPill(location.choice));
    // Not the category: the sub tabs under the switch already show it.
    if (conditionLabel) out.push({ key: 'condition', label: `${conditionLabel}+` });
    if (filters.shipping) {
      out.push({
        key: 'shipping',
        label: SHIPPING_OPTIONS.find((s) => s.key === filters.shipping)?.label ?? filters.shipping,
      });
    }
    if (min !== undefined || max !== undefined) {
      out.push({
        key: 'price',
        label: min !== undefined && max !== undefined ? `$${min}–$${max}`
          : min !== undefined ? `$${min}+`
          : `Under $${max}`,
      });
    }
    if (filters.sort !== 'match') {
      out.push({
        key: 'sort',
        label: SORT_OPTIONS.find((s) => s.key === filters.sort)?.label ?? filters.sort,
      });
    }
    return out;
  }, [location.choice, filters, kind, meta]);

  const categoryOptions = useMemo(() => [
    { key: null as string | null, label: 'All' },
    ...(meta?.categories ?? []).map((c) => ({ key: c as string | null, label: categoryLabel(c) })),
  ], [meta]);

  const filterValue: MarketFilters = {
    ...filters,
    location: location.choice,
  };

  // For sale or wanted, at the top of the list — it scrolls away with it.
  const kindSwitch = (
    <>
      {/* For sale or wanted — two halves of the same market rather than
          two screens, so the filters above apply to whichever you're
          looking at. */}
      {lockKind ? null : (
      <View style={styles.kindRow}>
        {/* For sale or wanted, as the home header's options: plain labels,
            the picked one underlined. Listing something closes the row —
            inside a group, the group comes with it (see the create form's
            "Where to post" step). The allowance check is the same one the
            app's + runs: at the limit it's the pitch, not a form the
            server would refuse. */}
        <UnderlineTabs
          tabs={[
            { key: 'sale' as const, label: 'For sale' },
            { key: 'want' as const, label: 'Want ads' },
          ]}
          value={kind}
          onChange={switchKind}
          inset={GUTTER}
          action={{
            label: 'Add listing',
            accessibilityLabel: listingAllowance
              ? `${kind === 'want' ? 'Post a want ad' : 'List something for sale'}, ${listingAllowance.used} of ${listingAllowance.limit} used this month`
              : kind === 'want' ? 'Post a want ad' : 'List something for sale',
            onPress: () => (listingAllowance?.reached
              ? setUpsell(true)
              : nav.navigate('ListingCreate', { kind, ...(groupId ? { groupId } : {}) })),
          }}
        />
      </View>
      )}

    </>
  );

  /**
   * The categories, as sub tabs — All first, and picked by default. Hidden
   * until the filter button beside the search opens them, then shown under
   * the search row, above the listings.
   */
  const categories = showTypes ? (
    <View style={styles.categoryTabs}>
      <SubTabs
        options={categoryOptions.map((o) => ({ key: o.key ?? '', label: o.label }))}
        value={filters.category ?? ''}
        onChange={(key) => applyFilters({ ...filterValue, category: key || null })}
        inset={GUTTER}
        // The home header's look: a grey thumb, the others white and lighter.
        tone="grey"
      />
    </View>
  ) : null;
  /** A category is narrowing the list — marked on the button while the row is hidden. */
  const typeChosen = !!filters.category;

  // The search and filter, pinned once you scroll past them: drawn over the
  // list at their place in it (barY, less the scroll), never above `stickyTop`.
  const tools = (
    <>
      {/* Search on the left, the filter on the right — the pattern the
          photography map and the Events tab share. */}
      <View style={styles.toolsRow}>
      <SearchPill
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={runSearch}
        onBlur={runSearch}
        onClear={clearSearch}
        placeholder={kind === 'want' ? 'Search want ads…' : 'Search listings…'}
      />

      {/* Where to look — not in a group, which shows all of its own. */}
      {groupId ? null : (
      <FilterSummaryRow<MarketFilters>
        value={filterValue}
        onApply={applyFilters}
        pills={pills}
        compact
      >
        {(draft, setDraft) => (
          <>
            {/* Nearest-first means nothing once you've stopped
                measuring from anywhere, so leaving near me drops it. */}
            <LocationFilterRow
              choice={draft.location}
              allLabel="All Listings"
              AllIcon={Tag}
              onChoose={(choice) => setDraft((d) => ({
                ...d,
                location: choice,
                sort: isNear(choice) || d.sort !== 'distance' ? d.sort : 'match',
              }))}
            />

            {/* The category is on the browse screen itself now, as sub tabs
                under For sale / Want ads — not repeated here. */}


            {/* Condition, shipping, price and sort are off the panel for now; their
                fields stay in the filters at their defaults, so nothing
                applied changes and they can come back as they were. */}

          </>
        )}
      </FilterSummaryRow>
      )}

      {/* Shows and hides the categories under this row. White while open;
          a dot while closed with a category still applied. */}
      <TouchableOpacity
        style={[styles.typesBtn, { backgroundColor: showTypes ? COLOR_WHITE : SURFACE_MID }]}
        onPress={() => setShowTypes((v) => !v)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: showTypes }}
        accessibilityLabel={showTypes ? 'Hide categories' : 'Show categories'}
      >
        <ListFilter size={17} color={showTypes ? COLOR_BLACK : COLOR_WHITE} strokeWidth={2.4} />
        {!showTypes && typeChosen ? <View style={[styles.typesDot, { backgroundColor: brand }]} /> : null}
      </TouchableOpacity>
      </View>
      {categories}
    </>
  );
  const stickyBar = (
    <Animated.View
      style={[styles.stickyBar, { backgroundColor: ground, transform: [{ translateY: barTranslate }] }]}
      onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
    >
      {tools}
    </Animated.View>
  );

  // The mosaic: two columns of cards, each its photo's own shape.
  const mosaic = (
    <View style={styles.mosaic}>
      {[0, 1].map((col) => (
        <View key={col} style={styles.column}>
          {entries.filter((_, i) => i % 2 === col).map((item) => (
            <ListingCard
              key={item.internal_id}
              listing={item}
              natural
              background={cardBackground}
              conditions={meta?.conditions}
              onPress={(origin) => setSummary({ id: item.internal_id, origin })}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const emptyState = isLoading ? (
    <SkeletonGrid count={6} ratio={16 / 9} style={{ paddingHorizontal: GUTTER, paddingTop: 8 }} />
  ) : (
    <EmptyState
      title={kind === 'want' ? 'No want ads' : 'Nothing for sale'}
      message={
        activeSearch || pills.length > 1
          ? 'Try a wider radius or fewer filters.'
          : groupId
            ? 'Nothing has been posted to this group yet.'
            : 'Be the first to list something.'
      }
    />
  );

  const modals = (
    <>
      <ListingSummaryModal
        listingId={summary?.id ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title={LISTING_LIMIT_UPSELL.title}
        message={LISTING_LIMIT_UPSELL.message}
      />
    </>
  );

  if (embedded) {
    return (
      <View style={[{ backgroundColor: ground }, style]}>
        {kindSwitch}
        {tools}
        {!groupId && location.fellBack && (
          <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
        )}
        {nearEmpty}
        {entries.length ? mosaic : emptyState}
        {modals}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: ground }, style]}>
      <Animated.FlatList
        ref={listRef}
        style={styles.fill}
        // One item, the whole mosaic — the Cars page's grid: two columns,
        // each card its photo's own shape, so rows would leave gaps beside
        // the short ones. Alternating rather than balanced by height, since a
        // card's shape is only known once its photo loads.
        data={entries.length ? MOSAIC : []}
        keyExtractor={(item) => item}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        ListHeaderComponent={
          <>
            {/* Heading rides in the list so it scrolls away with the content. */}
            {!!heading && <ScreenHeading title={heading} />}

            {/* Your own side of the market, above the browse: what you're
                selling, what sold, and anyone waiting on an answer — the
                unread bubble is the reason it sits this high. */}
            {hideManageEntry ? null : <ManageListingsEntry
              variant="card"
              // The + inside the card, after the counts. The allowance check
              // is the same one the group's + runs — at the limit it's the
              // pitch, not a form the server would refuse.
              onNew={() => (listingAllowance?.reached
                ? setUpsell(true)
                : nav.navigate('ListingCreate', { kind, ...(groupId ? { groupId } : {}) }))}
            />}

            {kindSwitch}

            {/* Where the search and filter sit until you scroll past them —
                they're drawn over the list (stickyBar, below) so they can pin
                under the header; this holds their place in the flow. */}
            <View
              style={{ height: barH }}
              onLayout={(e) => barY.setValue(padTop + e.nativeEvent.layout.y)}
            />

            {/* On the screen, not in the panel — it explains the list below. */}
            {!groupId && location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}
            {nearEmpty}
          </>
        }
        renderItem={() => mosaic}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          isFetching && page > 0 ? (
            <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
      />

      {stickyBar}

      {modals}
    </View>
  );
}


const styles = StyleSheet.create({
  nearEmpty: { marginTop: 8 },
  fill: { flex: 1 },
  // Two columns of cards, each its photo's shape — the Cars page's mosaic.
  mosaic: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER },
  column: { flex: 1, gap: 10 },
  // Over the list, at its top; moved into place by a translate.
  // The top pad keeps the search off the header's edge once pinned.
  stickyBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 6 },
  // Every row's edge inset is the app's GUTTER, so the browse lines up with
  // the header's tabs and the rest of the home screen.
  // Under the search row, with room before the listings.
  categoryTabs: { marginTop: -2, marginBottom: 10 },
  // The categories' toggle — a circle the filter pill's height.
  typesBtn: {
    width: COMPACT_FILTER_HEIGHT, height: COMPACT_FILTER_HEIGHT, borderRadius: COMPACT_FILTER_HEIGHT / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  typesDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  // For sale / Want ads and Add listing, over the search.
  kindRow: { paddingTop: 4, paddingBottom: 8 },

  // The search and the filter pill, side by side.
  toolsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GUTTER, marginBottom: 10,
  },

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: GUTTER, marginBottom: 10 },

});
