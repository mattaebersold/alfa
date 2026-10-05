import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { Image } from 'expo-image';
import Avatar, { type AvatarUser } from '../ui/Avatar';
import { Search, X, Plus, User as UserIcon, Car as CarIcon, Flag, Users as UsersIcon, MapPin } from 'lucide-react-native';
import { SpotPicker } from '@ors/kit/src/photography';
import { useSearchQuery, useGetPreviouslyTaggedPhotoSpotsQuery } from '../../api/apiService';
import GarageCarStrip from './GarageCarStrip';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { contrastText, useBrandColor } from '../../hooks/useBrandColor';
import { PILL_RADIUS, COLOR_WHITE, COMMON_RADIUS, COLOR_GRAY_14 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

export type TagKind = 'user' | 'car' | 'event' | 'group' | 'spot';
export interface TagItem {
  id: string;
  label: string;
  kind: TagKind;
  /**
   * A gallery filename for a member (the Avatar resolves it) or a resolved URL
   * for a car. Optional: a tag is still a tag without a picture.
   */
  image?: string | null;
  /** The member themself, for the Avatar in a suggestion — initials and colour when there's no photo. */
  avatarUser?: AvatarUser;
}

// Small debounce so each row's search only fires when typing settles.
function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface RowProps {
  title: string;
  placeholder: string;
  Icon: any;
  accent: string;
  query: string;
  onQuery: (s: string) => void;
  selected: TagItem[];
  suggestions: TagItem[];   // matches from the active search (≥2 chars)
  onToggle: (t: TagItem) => void;
  /** Sits between the selected chips and the search field — see the cars row. */
  above?: React.ReactNode;
}

/**
 * One kind of tag: what's picked, and a search for more.
 *
 * Search only. The rows used to open with a strip of whoever and whatever
 * you'd tagged before, which looked like a set of suggestions and mostly
 * wasn't — the last five people you tagged are rarely the people in *this*
 * photo, and a row of faces that has to be scrolled past is a cost every
 * post paid. The garage strip above the car search is a different thing:
 * those are your own cars, not your history, and it stays.
 */
function TagRow({ title, placeholder, Icon, accent, query, onQuery, selected, suggestions, onToggle, above }: RowProps) {
  const colors = useColors();
  const selectedIds = new Set(selected.map((t) => t.id));
  const typing = query.trim().length >= 2;
  const list = suggestions.filter((i) => !selectedIds.has(i.id)).slice(0, 8);

  // Chips and count pills are filled with `accent`, so their text has to
  // follow the fill's brightness — black on gold, white on teal.
  const onAccent = contrastText(accent);

  return (
    // A card per kind rather than three bands divided by hairlines: tagging a
    // person and tagging a car are separate jobs, and stacked rules made them
    // read as one long form you scroll through by accident.
    <View style={[styles.row, { backgroundColor: COLOR_GRAY_14 }]}>
      <View style={styles.rowHeader}>
        <Icon size={15} color={COLOR_WHITE} />
        <Text style={[styles.rowTitle, { color: colors.fg }]}>{title}</Text>
        {selected.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: accent }]}>
            <Text style={[styles.countText, { color: onAccent }]}>{selected.length}</Text>
          </View>
        )}
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.chip, { backgroundColor: accent }]} onPress={() => onToggle(t)} activeOpacity={0.8}>
              {/* The picture from the suggestion, carried onto the chip. */}
              {t.kind === 'user' ? (
                <Avatar user={t.avatarUser ?? { username: t.label.replace(/^@/, '') }} size={22} />
              ) : t.image ? (
                <Image source={{ uri: t.image }} style={styles.chipThumb} contentFit="cover" />
              ) : null}
              <Text style={[styles.chipText, { color: onAccent }]} numberOfLines={1}>{t.label}</Text>
              <X size={12} color={onAccent} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {above}

      {/* Search input, with its results floating above it — above rather
          than below so the keyboard can't cover them, and floating so they
          never push the form around. Content that moved as you typed also
          had the form re-scrolling under the field on every keystroke. */}
      <View style={styles.searchWrap}>
        {(query.trim().length === 1 || typing) && (
          <View style={[styles.suggestBox, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}>
            {query.trim().length === 1 ? (
              <Text style={[styles.hint, { color: colors.grey }]}>Keep typing…</Text>
            ) : list.length > 0 ? (
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.suggestScroll}>
                {list.map((s, i) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.suggestRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                    onPress={() => { onToggle(s); onQuery(''); }}
                    activeOpacity={0.7}
                  >
                    {/* A picture of the thing, so two "911"s or two Matts
                        can be told apart before one's tagged. A member's is
                        their avatar; a car's or an event's the first photo,
                        or the kind's glyph when it has none. */}
                    {s.kind === 'user' ? (
                      <Avatar user={s.avatarUser ?? { username: s.label.replace(/^@/, '') }} size={30} />
                    ) : s.image ? (
                      <Image source={{ uri: s.image }} style={[styles.suggestThumb, { backgroundColor: colors.segment }]} contentFit="cover" transition={100} />
                    ) : (
                      <View style={[styles.suggestThumb, styles.suggestThumbEmpty, { backgroundColor: colors.segment }]}>
                        <Icon size={14} color={colors.grey} />
                      </View>
                    )}
                    <Text style={[styles.suggestText, { color: colors.fg }]} numberOfLines={1}>{s.label}</Text>
                    <Plus size={16} color={accent} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.hint, { color: colors.grey }]}>No matches</Text>
            )}
          </View>
        )}
        <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={15} color={colors.grey} />
          <TextInput
            style={[styles.input, { color: colors.fg }]}
            value={query}
            onChangeText={onQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.grey}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => onQuery('')} hitSlop={6}>
              <X size={15} color={colors.grey} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

interface Props {
  users: TagItem[];
  cars: TagItem[];
  events: TagItem[];
  /**
   * Groups. Opt-in: passing this array turns on the group row. Posts don't
   * pass it today, so their tag UI is unchanged; routes do.
   */
  groups?: TagItem[];
  /**
   * Photo spots — the places it was shot. Opt-in like groups: passing the
   * array turns the row on. The picker searches pinned spots by name, offers
   * the ones tagged before, and can start a new pin through `onCreateSpot`.
   */
  spots?: TagItem[];
  /** "Create a new pin" in the spots row, with the name typed. */
  onCreateSpot?: (name: string) => void;
  /**
   * Put the member's own garage above the car search as a row of tappable
   * thumbnails. On by default — searching for a car you own is the long way
   * round to a tag you could have picked from a picture.
   */
  showGarage?: boolean;
  onToggle: (t: TagItem) => void;
}

/**
 * The spots card: the same chrome as a TagRow, with the kit's spot picker
 * where the search would be — it brings its own search, recents and
 * "create a new pin".
 */
function SpotTagRow({ selected, onToggle, onCreate }: {
  selected: TagItem[];
  onToggle: (t: TagItem) => void;
  onCreate?: (name: string) => void;
}) {
  const colors = useColors();
  const accent = useBrandColor();
  const onAccent = contrastText(accent);
  const { data: previous } = useGetPreviouslyTaggedPhotoSpotsQuery();
  const recentIds = (previous?.spots ?? []).map((s) => s.internal_id);

  return (
    <View style={[styles.row, { backgroundColor: COLOR_GRAY_14 }]}>
      <View style={styles.rowHeader}>
        <MapPin size={15} color={COLOR_WHITE} />
        <Text style={[styles.rowTitle, { color: colors.fg }]}>Tag Photo Spots</Text>
        {selected.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: accent }]}>
            <Text style={[styles.countText, { color: onAccent }]}>{selected.length}</Text>
          </View>
        )}
      </View>

      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.chip, { backgroundColor: accent }]} onPress={() => onToggle(t)} activeOpacity={0.8}>
              {/* The picture from the suggestion, carried onto the chip. */}
              {t.kind === 'user' ? (
                <Avatar user={t.avatarUser ?? { username: t.label.replace(/^@/, '') }} size={22} />
              ) : t.image ? (
                <Image source={{ uri: t.image }} style={styles.chipThumb} contentFit="cover" />
              ) : null}
              <Text style={[styles.chipText, { color: onAccent }]} numberOfLines={1}>{t.label}</Text>
              <X size={12} color={onAccent} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <SpotPicker
        spotId={null}
        recentIds={recentIds}
        placeholder="Search pinned spots…"
        onChange={(spot) => {
          if (!spot) return;
          // Already picked: the chip's tap takes it off, so this is a no-op.
          if (selected.some((t) => t.id === spot.internal_id)) return;
          onToggle({ id: spot.internal_id, label: spot.title || 'Photo spot', kind: 'spot' });
        }}
        onCreateNew={(name) => onCreate?.(name)}
        // The same box and search glyph as the other tag searches.
        boxStyle={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        leading={<Search size={15} color={colors.grey} />}
        inputStyle={[styles.input, { color: colors.fg }]}
      />
    </View>
  );
}

export default function PostTagPicker({ users, cars, events, groups, spots, onCreateSpot, showGarage = true, onToggle }: Props) {
  const colors = useColors();
  // One colour for every kind of tag: the chips name the kind by their
  // picture and their row, not by a colour each.
  const brand = useBrandColor();

  const [userQ, setUserQ]   = useState('');
  const [carQ, setCarQ]     = useState('');
  const [eventQ, setEventQ] = useState('');
  const [groupQ, setGroupQ] = useState('');
  const dUser  = useDebounced(userQ);
  const dCar   = useDebounced(carQ);
  const dEvent = useDebounced(eventQ);
  const dGroup = useDebounced(groupQ);

  const { data: userSearch }  = useSearchQuery(dUser,  { skip: dUser.length < 2 });
  const { data: carSearch }   = useSearchQuery(dCar,   { skip: dCar.length < 2 });
  const { data: eventSearch } = useSearchQuery(dEvent, { skip: dEvent.length < 2 });
  const { data: groupSearch } = useSearchQuery(dGroup, { skip: !groups || dGroup.length < 2 });

  const toUser  = (u: any): TagItem => ({
    id: u.user_id || u.internal_id,
    label: u.username ? `@${u.username}` : ([u.firstName, u.lastName].filter(Boolean).join(' ') || 'User'),
    kind: 'user',
    image: u.gallery?.[0]?.filename ?? u.profilePicture ?? null,
    avatarUser: u,
  });
  const toCar   = (c: any): TagItem => ({
    id: c.internal_id,
    label: [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car',
    kind: 'car',
    image: firstGalleryUrl(c.gallery) ?? (c.profile_image ? imageUrl(c.profile_image) : null),
  });
  const toEvent = (e: any): TagItem => ({
    id: e.internal_id,
    label: e.title || 'Event',
    kind: 'event',
    image: firstGalleryUrl(e.gallery) ?? (e.hero_image ? imageUrl(e.hero_image) : null),
  });
  const toGroup = (g: any): TagItem => ({ id: g.internal_id, label: g.title || 'Group', kind: 'group' });

  return (
    <View>
      <TagRow
        title="Tag People" placeholder="Search members…" Icon={UserIcon} accent={brand}
        query={userQ} onQuery={setUserQ} selected={users}
        suggestions={(userSearch?.users ?? []).map(toUser)}
        onToggle={onToggle}
      />
      <TagRow
        title="Tag Cars"
        // The field is for cars that aren't yours; yours are the row above it.
        placeholder={showGarage ? 'Search other cars…' : 'Search cars…'}
        Icon={CarIcon} accent={brand}
        query={carQ} onQuery={setCarQ} selected={cars}
        suggestions={(carSearch?.cars ?? []).map(toCar)}
        onToggle={onToggle}
        above={showGarage
          ? <GarageCarStrip selectedIds={cars.map((c) => c.id)} onToggle={onToggle} bleed={ROW_PAD} />
          : undefined}
      />
      <TagRow
        title="Tag Events" placeholder="Search events…" Icon={Flag} accent={brand}
        query={eventQ} onQuery={setEventQ} selected={events}
        suggestions={(eventSearch?.events ?? []).map(toEvent)}
        onToggle={onToggle}
      />
      {groups && (
        <TagRow
          title="Tag Groups" placeholder="Search groups…" Icon={UsersIcon} accent={brand}
          query={groupQ} onQuery={setGroupQ} selected={groups}
          suggestions={(groupSearch?.groups ?? []).map(toGroup)}
            onToggle={onToggle}
        />
      )}
      {spots && <SpotTagRow selected={spots} onToggle={onToggle} onCreate={onCreateSpot} />}
    </View>
  );
}

/** A tag card's side padding — the garage strip bleeds out past it. */
const ROW_PAD = 14;

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: ROW_PAD, paddingTop: 12, paddingBottom: 12,
    // Optional Details' block: the app's radius on a ground a step darker
    // than the form, and no edge of its own.
    borderRadius: COMMON_RADIUS,
  },
  // Just the title, in white — the accent colour lives on the chips and count
  // now, where it marks what's been tagged rather than decorating the card.
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginBottom: 12,
  },
  // The same as Optional Details' title above, so the form's section heads match.
  rowTitle:     { fontSize: 15, fontFamily: FONT_INTER.bold },
  countPill:    { minWidth: 18, height: 18, borderRadius: PILL_RADIUS, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText:    { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.extrabold },

  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  // A picture at the left end, the name, the X: padded less on the picture's
  // side, so it sits near the chip's round end.
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, height: 30, borderRadius: PILL_RADIUS },
  chipThumb:    { width: 22, height: 22, borderRadius: 11 },
  chipText:     { color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold, maxWidth: 150 },

  // No border: the field is its darker fill against the card.
  // Outlined like the form's other fields, now the card around it has no edge.
  inputBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
  input:        { flex: 1, fontSize: 14, padding: 0 },

  // Raised for good, not only while the list shows — a zIndex that changes
  // re-orders the native views and the field loses focus mid-word.
  searchWrap:   { zIndex: 20, elevation: 20 },
  // Hangs off the top of the field, over whatever's above it.
  suggestBox:   {
    position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 6,
    borderWidth: 1, borderRadius: 10, overflow: 'hidden',
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.45)',
  },
  suggestScroll:{ maxHeight: 220 },
  suggestHeader:{ fontSize: 11, fontFamily: FONT_INTER.bold, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  suggestRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  suggestText:  { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  // Rounded square for a car or an event; the member's avatar is a circle.
  suggestThumb: { width: 34, height: 34, borderRadius: 8 },
  suggestThumbEmpty: { alignItems: 'center', justifyContent: 'center' },

  hint:         { fontSize: 13, paddingVertical: 10, paddingHorizontal: 12 },
});
