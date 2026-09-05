import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable,
  FlatList, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Search as SearchIcon, X, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../ui/Avatar';
import SteeringWheel from '../ui/SteeringWheel';
import { useSearchQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/** One row, whatever it turned out to be. */
type Hit = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  /** Members get an avatar rather than a photo, initials and all. */
  user?: any;
  go: (nav: NavProp) => void;
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
      title: `@${u.username}`,
      subtitle: [u.firstName, u.lastName].filter(Boolean).join(' ') || undefined,
      user: u,
      go: (nav) => nav.navigate('UserDetail', { userId: u.user_id, username: u.username }),
    }),
  },
  {
    key: 'cars', kind: 'Car',
    toHit: (c) => ({
      id: `car-${c.internal_id}`, kind: 'Car',
      title: c.title || [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Car',
      subtitle: c.title ? [c.year, c.make, c.model].filter(Boolean).join(' ') : c.type,
      image: firstGalleryUrl(c.gallery) ?? (c.profile_image ? imageUrl(c.profile_image) : null),
      go: (nav) => (nav as any).navigate('CarDetail', { carId: c.internal_id }),
    }),
  },
  {
    key: 'posts', kind: 'Post',
    toHit: (p) => ({
      id: `post-${p.internal_id}`, kind: 'Post',
      title: p.title || '(Untitled)',
      subtitle: p.body ? stripHtml(p.body) : undefined,
      image: firstGalleryUrl(p.gallery),
      go: (nav) => nav.navigate('PostDetailModal', { postId: p.internal_id }),
    }),
  },
  {
    key: 'events', kind: 'Event',
    toHit: (e) => ({
      id: `event-${e.internal_id}`, kind: 'Event',
      title: e.title || 'Event',
      subtitle: e.location || (e.body ? stripHtml(e.body) : undefined),
      image: firstGalleryUrl(e.gallery) ?? (e.hero_image ? imageUrl(e.hero_image) : null),
      go: (nav) => nav.navigate('EventDetailModal', { eventId: e.internal_id }),
    }),
  },
  {
    key: 'rallys', kind: 'Rally',
    toHit: (r) => ({
      id: `rally-${r.internal_id}`, kind: 'Rally',
      title: r.title || 'Rally',
      subtitle: r.location || (r.body ? stripHtml(r.body) : undefined),
      image: firstGalleryUrl(r.gallery) ?? (r.hero_image ? imageUrl(r.hero_image) : null),
      go: (nav) => nav.navigate('RallyDetailModal', { rallyId: r.internal_id }),
    }),
  },
  {
    key: 'groups', kind: 'Group',
    toHit: (g) => ({
      id: `group-${g.internal_id}`, kind: 'Group',
      title: g.title || 'Group',
      subtitle: g.subtitle || g.region || undefined,
      image: firstGalleryUrl(g.gallery),
      go: (nav) => nav.navigate('GroupDetailModal', { groupId: g.internal_id }),
    }),
  },
  {
    key: 'routes', kind: 'Route',
    toHit: (r) => ({
      id: `route-${r.internal_id}`, kind: 'Route',
      title: r.title || 'Route',
      subtitle: [r.start_place, r.end_place].filter(Boolean).join(' → ') || undefined,
      image: firstGalleryUrl(r.gallery),
      go: (nav) => nav.navigate('RouteDetailModal', { routeId: r.internal_id }),
    }),
  },
  {
    key: 'articles', kind: 'Article',
    toHit: (a) => ({
      id: `article-${a.internal_id}`, kind: 'Article',
      title: a.title || 'Article',
      subtitle: a.body ? stripHtml(a.body) : undefined,
      image: firstGalleryUrl(a.gallery),
      go: (nav) => nav.navigate('ArticleDetail', { articleId: a.internal_id }),
    }),
  },
];

/**
 * A colour per result type.
 *
 * Drawn from the same palette the feed's type badges use, so a Post in search
 * is the colour a Post is everywhere else. The ones with no existing badge —
 * members, cars, routes — take brand colours that aren't already spoken for.
 */
const KIND_COLORS: Record<string, { bg: string; fg: string }> = {
  Member:  { bg: colors.badgeGarage,  fg: '#000000' },
  Car:     { bg: colors.badgeRecord,  fg: '#000000' },
  Post:    { bg: colors.badgeDefault, fg: '#000000' },
  Event:   { bg: colors.badgeEvent,   fg: '#000000' },
  Rally:   { bg: colors.tangerine,    fg: '#000000' },
  Group:   { bg: colors.badgeGroup,   fg: '#000000' },
  Route:   { bg: colors.green,        fg: '#000000' },
  Article: { bg: colors.badgeUpdate,  fg: '#FFFFFF' },
};

const isProUser = (u: any) => u?.accountType === 'pro' || u?.accountType === 'admin';

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
 * One filter chip, always in its type's colour.
 *
 * Unselected it's an outline in that colour; selected it fills with it. Colour
 * therefore means "this is what Cars look like" at all times, matching the
 * badge on every row below, and selection is carried by the fill rather than by
 * the hue — which leaves the hue free to do only one job.
 */
function FilterChip({ label, count, color, active, onPress }: {
  label: string;
  count?: number;
  color?: { bg: string; fg: string };
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const tint = color?.bg ?? c.fg;
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active
          ? { backgroundColor: tint, borderColor: tint }
          : { backgroundColor: 'transparent', borderColor: tint },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, { color: active ? (color?.fg ?? c.cream) : tint }]}>
        {label}{count !== undefined ? ` ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const keyboardHeight = useKeyboardHeight();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Null is "everything" — the chips narrow rather than choose. */
  const [kind, setKind] = useState<string | null>(null);

  // Typing is faster than the network. Without this every keystroke is a
  // request, and the answers arrive out of order.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Cleared on close so reopening starts fresh rather than on last time's answer.
  useEffect(() => {
    if (!visible) { setQuery(''); setDebounced(''); setKind(null); }
  }, [visible]);

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

  /** How many of each type the current search found, for the chip labels. */
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
    onClose();
    then?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => dismiss()}>
      {/* The screen behind, softened rather than replaced. */}
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={() => dismiss()} />

      {/* The sheet stops above the keyboard, so the list scrolls inside a real
          viewport. Padding the list's *content* by the keyboard instead — which
          is what this did — leaves the list itself taller than the screen and
          shifts its content every time the keyboard moves mid-drag. */}
      <View
        style={[styles.sheet, { paddingTop: insets.top + 14, paddingBottom: keyboardHeight }]}
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
            <X size={22} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* ── The field ── */}
        <View style={[styles.field, { backgroundColor: c.card, borderColor: c.borderDark }]}>
          <SearchIcon size={17} color={c.grey} />
          <TextInput
            style={[styles.input, { color: c.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Members, cars, posts, events, rallys, groups, routes"
            placeholderTextColor={c.grey}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {isFetching && ready ? <ActivityIndicator size="small" color={c.grey} /> : null}
        </View>

        {/* ── Filters ──
            Only the types this search actually turned up. A row of chips that
            lead to "nothing found" is a row of dead ends, and which types are
            even present changes with every query.

            Wrapped, not scrolled: a horizontal strip cut the last type off at
            the edge of the screen with nothing to say it was there, and a
            filter you can't see is a filter you don't know you have. There are
            at most eight of these and they're short, so two lines shows all
            of them. */}
        {ready && Object.keys(counts).length > 1 && (
          <View style={styles.chips}>
            <FilterChip
              label="All"
              active={kind === null}
              onPress={() => setKind(null)}
            />
            {SECTIONS.filter((sec) => counts[sec.kind]).map((sec) => (
              <FilterChip
                key={sec.kind}
                label={sec.kind}
                count={counts[sec.kind]}
                color={(KIND_COLORS[sec.kind] ?? KIND_COLORS.Post)}
                active={kind === sec.kind}
                onPress={() => setKind(kind === sec.kind ? null : sec.kind)}
              />
            ))}
          </View>
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
            <TouchableOpacity
              style={styles.row}
              onPress={() => dismiss(() => item.go(navigation))}
              activeOpacity={0.8}
            >
              {item.user ? (
                // Pro members carry their ring and wheel here too — a member is
                // recognised the same way wherever they turn up.
                <View style={[styles.avatarWrap, isProUser(item.user) && styles.proRing]}>
                  <Avatar user={item.user} size={isProUser(item.user) ? 58 : 66} />
                  {isProUser(item.user) && (
                    <View style={styles.proWheel}>
                      <SteeringWheel size={13} color="#000000" strokeWidth={2.5} />
                    </View>
                  )}
                </View>
              ) : item.image ? (
                <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: c.secondary }]} />
              )}

              <View style={styles.rowText}>
                {/* Above the title rather than beside the subtitle: it says what
                    kind of thing you're about to open, which is the first
                    question, and inline it was competing with the answer. */}
                <View style={styles.kindRow}>
                  <View
                    style={[
                      styles.kindBadge,
                      { backgroundColor: (KIND_COLORS[item.kind] ?? KIND_COLORS.Post).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindText,
                        { color: (KIND_COLORS[item.kind] ?? KIND_COLORS.Post).fg },
                      ]}
                    >
                      {item.kind}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{item.title}</Text>
                {item.subtitle ? (
                  <Text style={[styles.rowSub, { color: c.grey }]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.go, { backgroundColor: c.secondary }]}>
                <ChevronRight size={15} color={c.fg} />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A little extra dark over the blur — a plain blur of a bright feed is still
  // bright, and the field has to sit on something.
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { flex: 1, paddingHorizontal: 12 },
  topBar:   { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  closeBtn: { padding: 4 },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 13, height: 46,
    borderRadius: 12, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '600', padding: 0 },

  listFlex: { flex: 1 },
  list: { paddingTop: 12, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 9, borderRadius: 12,
    // Translucent rather than a solid card — the blurred page stays faintly
    // readable through each row, which is what keeps them looking like they're
    // floating over it instead of covering it.
    backgroundColor: 'rgba(0,0,0,0.30)',
    // Lifted off the blur, so the rows read as floating over the page rather
    // than as part of it.
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
      android: { elevation: 5 },
    }),
  },
  thumb:    { width: 66, height: 66, borderRadius: 10 },
  avatarWrap: { position: 'relative' },
  // The avatar shrinks by the ring's own width, so a pro member's row is the
  // same height as everyone else's.
  proRing:  { borderWidth: 2.5, borderColor: colors.pro, borderRadius: 34, padding: 1.5 },
  proWheel: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.pro,
    alignItems: 'center', justifyContent: 'center',
  },

  chips: {
    flexDirection: 'row', flexWrap: 'wrap',
    // `alignItems` matters here for the same reason it did when this scrolled:
    // without it the chips stretch to the tallest thing on their line.
    alignItems: 'center', gap: 8,
    paddingTop: 14, paddingBottom: 6,
  },
  chip: {
    height: 30, justifyContent: 'center',
    paddingHorizontal: 12, borderRadius: 999, borderWidth: 1,
  },
  chipText:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  rowText:  { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 14.5, fontWeight: '700' },
  // The badge sizes to its word rather than filling the row.
  kindRow:   { flexDirection: 'row' },
  kindBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  // Not bold — it's a label on the row, and at weight 800 it was reading as
  // loudly as the title next to it.
  kindText:  { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  rowSub:   { fontSize: 12, flexShrink: 1 },
  go: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: {
    textAlign: 'center', marginTop: 40,
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)',
  },
});
