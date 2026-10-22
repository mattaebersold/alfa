import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { MapPin, Search, X } from 'lucide-react-native';
import AddressField from '../ui/AddressField';
import { useGetRecentPostPlacesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { PlaceDetail, PostPlace } from '../../types/api';
import { PILL_RADIUS, FORM_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** How many recent places are offered before the search is the better route. */
const RECENT_MAX = 6;

/**
 * A Google place, from what the details call handed back.
 *
 * A post's place has to be somewhere a pin can go, so a pick without a
 * coordinate isn't one — the details call failed or Google had nothing, and
 * the field stays open for another go. The name falls back to what the
 * suggestion said, which is what the member saw and tapped.
 */
export function postPlaceFrom(detail: PlaceDetail, typed?: string): PostPlace | null {
  const name = (detail.name || typed || '').trim();
  if (!detail.place_id || !name || detail.lat == null || detail.lng == null) return null;
  return {
    place_id: detail.place_id,
    name,
    address: detail.address ?? null,
    lat: detail.lat,
    lng: detail.lng,
  };
}

/**
 * Where a post was made — the composer's "Add a location".
 *
 * Standalone rather than a kind of tag. A photo spot is a pin someone made for
 * the shot; this is just the place, out of Google's list, and it belongs to the
 * post the way its words do. The posts made at one place are then one list (see
 * PlacePostsModal), grouped by Google's `place_id`.
 *
 * Three states, one at a time:
 *   - Picked: the place as a row, with an X to take it off. No field — a post
 *     has one place, and a field under a picked one would read as "add another".
 *   - Not picked: the places you've posted at before, as pills to tap, then the
 *     search. Recents first because they're the likely answer, and a tap beats
 *     typing the name of the café you post from every weekend.
 *   - Typing: AddressField's own suggestions, in flow under the field.
 *
 * Only the card's body: the host draws the card and its "Add a Location" head,
 * so the create form and the edit pane can frame it their own way.
 */
export default function PostLocationField({ value, onChange }: {
  value: PostPlace | null;
  onChange: (place: PostPlace | null) => void;
}) {
  const colors = useColors();
  const signedIn = useAppSelector((s) => !!s.auth.userInfo?.user_id);
  // Signed-in only on the server; asking without a session is a 401 for nothing.
  const { data: recentData } = useGetRecentPostPlacesQuery(undefined, { skip: !signedIn || !!value });
  const recents = (recentData?.places ?? []).slice(0, RECENT_MAX);

  const [query, setQuery] = useState('');
  /**
   * The field's latest text, for the name fallback. A pick sets the text to the
   * suggestion's name and only then waits on the details call, and the handler
   * that answers it was made a render earlier — its `query` is still what was
   * typed, not what was tapped.
   */
  const latest = useRef('');
  const onQuery = (text: string) => { latest.current = text; setQuery(text); };

  const pick = (place: PostPlace) => {
    onQuery('');
    onChange(place);
  };

  if (value) {
    return (
      <View style={[styles.picked, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <MapPin size={16} color={colors.fg} />
        <View style={styles.pickedText}>
          <Text style={[styles.pickedName, { color: colors.fg }]} numberOfLines={1}>{value.name}</Text>
          {value.address ? (
            <Text style={[styles.pickedAddress, { color: colors.grey }]} numberOfLines={1}>{value.address}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onChange(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove location"
        >
          <X size={16} color={colors.grey} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {recents.length > 0 && (
        <View style={styles.recentWrap}>
          {/* The tag cards' "Recently tagged" caption, over pills rather than
              photo tiles — a place has no picture of its own to show. */}
          <Text style={[styles.recentTitle, { color: colors.grey }]}>Recent places</Text>
          <View style={styles.recentPills}>
            {recents.map((p) => (
              <TouchableOpacity
                key={p.place_id}
                style={[styles.pill, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={() => pick({ place_id: p.place_id, name: p.name, address: p.address ?? null, lat: p.lat, lng: p.lng })}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Add location ${p.name}`}
              >
                <MapPin size={12} color={colors.grey} />
                <Text style={[styles.pillText, { color: colors.fg }]} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* The same box and search glyph as the tag searches above it. The glyph
          sits over the field's left padding rather than beside it in a row:
          AddressField's suggestions drop down under its own input, and inside
          a row they'd be squeezed in beside the glyph. */}
      <View>
        <AddressField
          value={query}
          onChangeText={onQuery}
          onPlacePicked={(detail) => {
            const place = postPlaceFrom(detail, latest.current);
            if (place) pick(place);
          }}
          placeholder="Search for a place…"
          inputStyle={[styles.input, { color: colors.fg, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
        />
        <View style={styles.searchIcon} pointerEvents="none">
          <Search size={15} color={colors.grey} />
        </View>
      </View>
    </View>
  );
}

/** The search box's height — the glyph is centred against it. */
const INPUT_H = 42;

const styles = StyleSheet.create({
  recentWrap:  { marginBottom: 12 },
  // TagCardStrip's caption.
  recentTitle: { fontSize: 11, fontFamily: FONT_INTER.bold, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 },
  recentPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 30, borderRadius: PILL_RADIUS, borderWidth: 1,
    maxWidth: '100%',
  },
  pillText: { fontSize: 12, fontFamily: FONT_INTER.semibold, maxWidth: 200 },

  // PostTagPicker's inputBox, with room on the left for the glyph laid over it.
  input: {
    height: INPUT_H, fontSize: 14,
    paddingLeft: 35, paddingRight: 12, paddingVertical: 0,
    borderWidth: 1, borderRadius: FORM_RADIUS,
  },
  searchIcon: {
    position: 'absolute', left: 12, top: 0, height: INPUT_H,
    justifyContent: 'center',
  },

  picked: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderRadius: FORM_RADIUS,
  },
  pickedText:    { flex: 1, minWidth: 0 },
  pickedName:    { fontSize: 14, fontFamily: FONT_INTER.semibold },
  pickedAddress: { fontSize: 12, marginTop: 1 },
});
