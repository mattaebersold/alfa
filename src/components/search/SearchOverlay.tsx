import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Modal, Pressable, FlatList, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useGroupSummary } from '../../providers/GroupSummaryProvider';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MainTabs from '../ui/MainTabs';
import { useInputSurface, INPUT_TEXT_STYLE } from '../ui/FormInput';
import { useSearchQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { KeyboardAvoidingView } from '@ors/kit';
import MemberCard from '../members/MemberCard';
import CarPosterCard from '../cards/CarPosterCard';
import FeedItemCard from '../cards/FeedItemCard';
import EventCard from '../cards/EventCard';
import RallyCard from '../rallys/RallyCard';
import GroupCard from '../groups/GroupCard';
import RouteCard from '../cards/RouteCard';
import ListingCard from '../marketplace/ListingCard';
import ArticleCard from '../articles/ArticleCard';
import { priceLabel } from '../marketplace/listingFormat';
import { stripHtml } from '../../utils/text';
import type { AppStackParamList } from '../../navigation/types';
import { COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/** One row, whatever it turned out to be. */
type Hit = {
  id: string;
  kind: string;
  /** Title and subtitle are what ranking reads — see score. */
  title: string;
  subtitle?: string;
  /** The record itself, for its type's card. */
  item: any;
  /** `openGroup` routes a group by membership — see GroupSummaryProvider. */
  go: (nav: NavProp, openGroup: (groupId: string) => void) => void;
};

/**
 * How each collection the server returns becomes a row.
 *
 * Ordered as it reads: people first, then the things they've made, then the
 * places they gather. The server's key is the contract — `label` in
 * horacio's searchController — so adding a collection there means adding a
 * line here and nothing else.
 */
const SECTIONS: {
  key: string;
  kind: string;
  toHit: (item: any) => Hit;
}[] = [
  {
    key: 'users', kind: 'Member',
    toHit: (u) => ({
      id: `user-${u.user_id}`, kind: 'Member',
      item: u,
      title: `@${u.username}`,
      subtitle: [u.firstName, u.lastName].filter(Boolean).join(' ') || undefined,
      go: (nav) => nav.navigate('UserDetail', { userId: u.user_id, username: u.username }),
    }),
  },
  {
    key: 'cars', kind: 'Car',
    toHit: (c) => ({
      id: `car-${c.internal_id}`, kind: 'Car',
      item: c,
      title: c.title || [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Car',
      subtitle: c.title ? [c.year, c.make, c.model].filter(Boolean).join(' ') : c.type,
      go: (nav) => (nav as any).navigate('CarDetail', { carId: c.internal_id }),
    }),
  },
  {
    key: 'posts', kind: 'Post',
    toHit: (p) => ({
      id: `post-${p.internal_id}`, kind: 'Post',
      item: p,
      title: p.title || '(Untitled)',
      subtitle: p.body ? stripHtml(p.body) : undefined,
      go: (nav) => nav.navigate('PostDetailModal', { postId: p.internal_id }),
    }),
  },
  {
    key: 'events', kind: 'Event',
    toHit: (e) => ({
      id: `event-${e.internal_id}`, kind: 'Event',
      item: e,
      title: e.title || 'Event',
      subtitle: e.location || (e.body ? stripHtml(e.body) : undefined),
      go: (nav) => nav.navigate('EventDetailModal', { eventId: e.internal_id }),
    }),
  },
  {
    key: 'rallys', kind: 'Rally',
    toHit: (r) => ({
      id: `rally-${r.internal_id}`, kind: 'Rally',
      item: r,
      title: r.title || 'Rally',
      subtitle: r.location || (r.body ? stripHtml(r.body) : undefined),
      go: (nav) => nav.navigate('RallyDetailModal', { rallyId: r.internal_id }),
    }),
  },
  {
    key: 'groups', kind: 'Group',
    toHit: (g) => ({
      id: `group-${g.internal_id}`, kind: 'Group',
      item: g,
      title: g.title || 'Group',
      subtitle: g.subtitle || g.region || undefined,
      go: (_nav, openGroup) => openGroup(g.internal_id),
    }),
  },
  {
    key: 'routes', kind: 'Route',
    toHit: (r) => ({
      id: `route-${r.internal_id}`, kind: 'Route',
      item: r,
      title: r.title || 'Route',
      subtitle: [r.start_place, r.end_place].filter(Boolean).join(' → ') || undefined,
      go: (nav) => nav.navigate('RouteDetailModal', { routeId: r.internal_id }),
    }),
  },
  {
    /**
     * The marketplace. Its own kind rather than folded in with posts: a
     * listing is a different question ("can I buy this?") and the price is
     * what makes the row worth reading at a glance.
     */
    key: 'marketplace', kind: 'Listing',
    toHit: (l) => ({
      id: `listing-${l.internal_id}`, kind: 'Listing',
      item: l,
      title: l.title || 'Listing',
      subtitle: [
        priceLabel(l),
        l.sold ? 'Sold' : null,
        [l.year, l.make, l.model].filter(Boolean).join(' ') || null,
      ].filter(Boolean).join(' · ') || undefined,
      go: (nav) => nav.navigate('ListingDetailModal', { listingId: l.internal_id }),
    }),
  },
  {
    key: 'articles', kind: 'Article',
    toHit: (a) => ({
      id: `article-${a.internal_id}`, kind: 'Article',
      item: a,
      title: a.title || 'Article',
      subtitle: a.body ? stripHtml(a.body) : undefined,
      go: (nav) => nav.navigate('ArticleDetail', { articleId: a.internal_id }),
    }),
  },
];

/** Rows per collection while results are still grouped by type. */
const PER_SECTION = 4;

/** Below this the query is too short for ranking to mean anything. */
const RANK_FROM = 3;

/**
 * How well a row answers what was typed.
 *
 * The server returns each collection separately and in its own order, so
 * without this the list reads by type — every member, then every car — and the
 * best answer sits wherever its collection happens to fall. Scoring on the
 * title and re-sorting puts "911" the car above a post that merely mentions it.
 *
 * Deliberately crude and title-first. The subtitle is a tiebreak, not evidence:
 * a body that happens to contain the word is a much weaker match than a name
 * that starts with it, and weighting them evenly buries the obvious answers.
 */
function score(hit: Hit, q: string): number {
  const title = hit.title.toLowerCase().replace(/^@/, '');
  const query = q.toLowerCase();

  if (title === query) return 100;
  if (title.startsWith(query)) return 80;
  // A match at a word boundary — "carrera" in "911 Carrera" — beats one buried
  // mid-word, which is usually a coincidence.
  if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) return 60;
  if (title.includes(query)) return 40;
  if (hit.subtitle?.toLowerCase().includes(query)) return 20;
  return 10;
}

/**
 * Search, over whatever you were already looking at.
 *
 * A field on a blurred copy of the screen rather than a page of its own. Search
 * is something you do *while* somewhere, and pushing a route for it meant
 * leaving the place you were searching from and coming back to the top of it.
 * The blur keeps that place visible behind the answer, so dismissing puts you
 * back exactly where you were instead of re-entering.
 *
 * Results are interleaved by collection rather than grouped under headings —
 * at four rows apiece the headings would outnumber the answers, and the type is
 * already on every row.
 */
export default function SearchOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const surface = useInputSurface();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { openGroup } = useGroupSummary();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Null is "everything" — the tabs narrow rather than choose. */
  const [kind, setKind] = useState<string | null>(null);

  // Typing is faster than the network. Without this every keystroke is a
  // request, and the answers arrive out of order.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  /**
   * Back to empty — the query, the debounced copy of it, and the type filter.
   *
   * All three, because clearing only the field leaves `debounced` holding the
   * last search: the results below stay on screen and the tabs keep counting
   * a query that no longer exists.
   */
  const clear = useCallback(() => {
    setQuery('');
    setDebounced('');
    setKind(null);
  }, []);

  /**
   * Cleared on the way out *and* on the way in.
   *
   * Closing is the moment it's asked for, and that's what the prop change
   * below does. But the overlay never unmounts — it's a `Modal` inside a
   * header that lives on every screen — so its state outlives any single
   * close, and any path that gets it back on screen without `visible` having
   * cycled would reopen on the last search. Clearing on open too makes "fresh
   * every time" true by construction rather than by covering each route out.
   */
  useEffect(() => { clear(); }, [visible, clear]);

  const ready = debounced.length >= 2;
  const { data, isFetching } = useSearchQuery(debounced, { skip: !ready });

  const hits = useMemo<Hit[]>(() => {
    if (!data) return [];
    const all = SECTIONS
      // Narrowed to one type, the cap comes off — the whole point of picking
      // "Cars" is to see more than four of them.
      .filter((section) => !kind || section.kind === kind)
      .flatMap((section) => {
        const rows = Array.isArray(data[section.key]) ? data[section.key] : [];
        // Ranked, the per-type cap would throw away good answers before they
        // could be compared; grouped, it stops one type filling the screen.
        const ranking = !kind && debounced.length >= RANK_FROM;
        return (kind || ranking ? rows : rows.slice(0, PER_SECTION)).map(section.toHit);
      });

    if (kind || debounced.length < RANK_FROM) return all;

    return [...all]
      .map((hit) => ({ hit, s: score(hit, debounced) }))
      // Ties keep the order they came in, which is the section order — so an
      // equally good member and post still read people-first.
      .sort((a, b) => b.s - a.s)
      .map(({ hit }) => hit)
      .slice(0, 40);
  }, [data, kind, debounced]);

  /** How many of each type the current search found, for the tab labels. */
  const counts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!data) return out;
    for (const section of SECTIONS) {
      const rows = Array.isArray(data[section.key]) ? data[section.key] : [];
      if (rows.length > 0) out[section.kind] = rows.length;
    }
    return out;
  }, [data]);

  const dismiss = (then?: () => void) => {
    Keyboard.dismiss();
    clear();
    onClose();
    then?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => dismiss()} statusBarTranslucent navigationBarTranslucent>
      {/* The screen behind, softened rather than replaced.
          `blurMethod` is what gives Android a real backdrop blur — without it
          expo-blur degrades to a flat wash there and the feed stays legible
          straight through the results. */}
      <BlurView
        intensity={38}
        tint="dark"
        blurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim, Platform.OS === 'android' && styles.scrimAndroid]}
        onPress={() => dismiss()}
      />

      {/* The sheet stops above the keyboard (kit's KeyboardAvoidingView), so
          the list scrolls inside a real viewport. */}
      <KeyboardAvoidingView
        style={[styles.sheet, { paddingTop: insets.top + 14 }]}
        pointerEvents="box-none"
      >
        {/* ── Close ──
            Its own control in the corner, rather than only the ✕ inside the
            field — that one turns into "clear" the moment you've typed
            anything, leaving no way out but the backdrop. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => dismiss()}
            hitSlop={12}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <X size={22} color={COLOR_WHITE} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* ── The field ── */}
        <View style={[styles.field, surface]}>
          <SearchIcon size={17} color={c.grey} />
          <TextInput
            style={[styles.input, { color: c.fg }]}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isFetching && ready ? <ActivityIndicator size="small" color={c.grey} /> : null}
        </View>

        {/* ── Filters ──
            Only the types this search actually turned up. A tab that leads to
            "nothing found" is a dead end, and which types are even present
            changes with every query. Main tabs, as on home: picking a type is
            choosing a kind of thing. The row scrolls, bled past the sheet's
            padding so it runs off the edge rather than stopping short of it. */}
        {ready && Object.keys(counts).length > 1 && (
          <MainTabs
            tabs={[
              { key: 'all', label: 'All' },
              ...SECTIONS.filter((sec) => counts[sec.kind]).map((sec) => ({
                key: sec.kind, label: sec.kind, count: counts[sec.kind],
              })),
            ]}
            value={kind ?? 'all'}
            onChange={(k) => setKind(k === 'all' ? null : k)}
            inset={SHEET_PAD}
            style={styles.tabs}
          />
        )}

        {/* ── Results ── */}
        <FlatList
          // Without this the list sizes to its content and overflows the sheet
          // rather than scrolling within it — the reason it barely moved.
          style={styles.listFlex}
          data={hits}
          keyExtractor={(h) => h.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {!ready
                ? 'Type at least two characters'
                : isFetching
                  ? 'Searching…'
                  : `Nothing found for “${debounced}”`}
            </Text>
          }
          renderItem={({ item }) => (
            <ResultCard hit={item} open={() => dismiss(() => item.go(navigation, openGroup))} />
          )}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * A result as its type's own card — the one it wears everywhere else — rather
 * than a generic row. `open` closes the sheet first and then goes: iOS won't
 * push a screen while this Modal is still on its way out.
 */
function ResultCard({ hit, open }: { hit: Hit; open: () => void }) {
  const it = hit.item;
  switch (hit.kind) {
    case 'Member':  return <MemberCard member={it} onPress={open} style={styles.memberCard} />;
    case 'Car':     return <CarPosterCard car={it} onPress={open} showOwner />;
    case 'Post':    return <FeedItemCard post={it} onPress={open} />;
    case 'Event':   return <EventCard event={it} onPress={open} />;
    case 'Rally':   return <RallyCard rally={it} onPress={open} />;
    case 'Group':   return <GroupCard group={it} onPress={open} />;
    case 'Route':   return <RouteCard route={it} onPress={open} />;
    case 'Listing': return <ListingCard listing={it} onPress={open} />;
    case 'Article': return <ArticleCard article={it} onPress={open} />;
    default:        return null;
  }
}

/** The sheet's side padding — the tab row bleeds back out past it. */
const SHEET_PAD = 12;

const styles = StyleSheet.create({
  // A little extra dark over the blur — a plain blur of a bright feed is still
  // bright, and the field has to sit on something.
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  /**
   * More shade on Android, and grey rather than black.
   *
   * Even with the experimental method Android's blur is weaker than the iOS
   * one, and where it isn't supported it falls back to nothing at all — so the
   * scrim has to carry the separation on its own. At 0.45 the feed behind was
   * still reading through the gaps between result rows.
   *
   * Near-opaque black made the result rows disappear into it: they sit on
   * `card`, and a card on pure black at 0.86 has almost no edge left. A light
   * grey at the same weight keeps the rows reading as objects on a surface,
   * and still buries whatever was on screen behind it.
   */
  scrimAndroid: { backgroundColor: 'rgba(38,38,38,0.88)' },
  sheet: { flex: 1, paddingHorizontal: SHEET_PAD },
  topBar:   { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  closeBtn: { padding: 4 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, height: 46,
  },
  input: { ...INPUT_TEXT_STYLE, flex: 1, padding: 0 },

  listFlex: { flex: 1 },
  list: { paddingTop: 12, gap: 12 },
  // Members' cards are photo cards with no width of their own; here, the list's.
  memberCard: { width: '100%' },

  // 'auto' over MainTabs' own 100%, which would stop short at the sheet's right padding.
  tabs: { width: 'auto', marginHorizontal: -SHEET_PAD, flexGrow: 0, marginTop: 14, marginBottom: 4 },

  empty: {
    textAlign: 'center', marginTop: 40,
    fontSize: 14, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.55)',
  },
});
