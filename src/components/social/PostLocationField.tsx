import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin, Search } from 'lucide-react-native';
import AddressField from '../ui/AddressField';
import { ChoiceCardRow, type ChoiceCardItem } from './PostToSelector';
import { TagCardFrame, ROW_PAD } from './PostTagPicker';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useGetRecentPostPlacesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { PlaceDetail, PostPlace } from '../../types/api';

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
 * Drawn as one of the tag cards (TagCardFrame): the places you've posted at
 * before as Post To's cards, dragged sideways — recents first, because a tap
 * beats typing the name of the café you post from every weekend — then the
 * search, with AddressField's own suggestions in flow under it. A card's
 * check is the pick. A post has one place: picked, the search goes, and
 * tapping the checked card again takes it off.
 */
export default function PostLocationField({ value, onChange, framed = true }: {
  value: PostPlace | null;
  onChange: (place: PostPlace | null) => void;
  /**
   * Drawn as a tag card — the frame, the pin and "Add a Location" — as the
   * create form shows it, under Tag Events. Off for a host that heads it
   * itself (the edit pane).
   */
  framed?: boolean;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const signedIn = useAppSelector((s) => !!s.auth.userInfo?.user_id);
  // Signed-in only on the server; asking without a session is a 401 for nothing.
  const { data: recentData } = useGetRecentPostPlacesQuery(undefined, { skip: !signedIn });
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

  // Recent places as Post To's cards — a pin, a check, the place's name — and
  // the check is the pick: one at a time, tapped again to take it off. A place
  // found by search joins the row at its front, checked, so it has a card too.
  const place = (p: { place_id: string; name: string; address?: string | null; lat: number; lng: number }): PostPlace =>
    ({ place_id: p.place_id, name: p.name, address: p.address ?? null, lat: p.lat, lng: p.lng });
  const shown = value && !recents.some((r) => r.place_id === value.place_id) ? [value, ...recents] : recents;
  const cards: ChoiceCardItem[] = shown.map((p) => {
    const on = value?.place_id === p.place_id;
    return {
      key: p.place_id,
      label: p.name,
      Icon: MapPin,
      active: on,
      onPress: () => (on ? onChange(null) : pick(place(p))),
    };
  });

  const body = (
    <>
      {cards.length > 0 && (
        <View style={[styles.recents, value && styles.recentsPicked]}>
          <ChoiceCardRow items={cards} bleed={framed ? ROW_PAD : 0} />
        </View>
      )}

      {/* The search, until a place is picked — one place per post. The same
          box and search glyph as the tag searches above it; the glyph sits
          over the field's left padding rather than beside it in a row, since
          AddressField's suggestions drop down under its own input. */}
      {!value && (
        <View>
          <AddressField
            value={query}
            onChangeText={onQuery}
            onPlacePicked={(detail) => {
              const found = postPlaceFrom(detail, latest.current);
              if (found) pick(found);
            }}
            placeholder="Search for a place…"
            inputStyle={styles.input}
          />
          <View style={styles.searchIcon} pointerEvents="none">
            <Search size={15} color={colors.grey} />
          </View>
        </View>
      )}
    </>
  );

  return framed ? (
    <TagCardFrame title="Add a Location" Icon={MapPin} count={value ? 1 : 0} accent={brand}>{body}</TagCardFrame>
  ) : body;
}

/** The search box's height — the glyph is centred against it. */
const INPUT_H = 42;

const styles = StyleSheet.create({
  recents: { marginBottom: 12 },
  // Nothing under the row once a place is picked.
  recentsPicked: { marginBottom: 0 },

  // AddressField's FormInput at PostTagPicker's inputBox height, with room on
  // the left for the glyph laid over it.
  input: { height: INPUT_H, paddingLeft: 35, paddingRight: 12, paddingVertical: 0 },
  searchIcon: {
    position: 'absolute', left: 12, top: 0, height: INPUT_H,
    justifyContent: 'center',
  },
});
