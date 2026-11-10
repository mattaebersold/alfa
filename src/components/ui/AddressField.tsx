import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Text, useRoomAbove } from '@ors/kit';
import { MapPin } from 'lucide-react-native';
import FormInput from './FormInput';
import { attachedList } from './attachedList';
import { useColors } from '../../hooks/useColors';
import {
  useLazySearchPlacesQuery, useLazyGetPlaceDetailsQuery,
} from '../../api/apiService';
import type { PlaceDetail, PlacePrediction } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A text input that suggests addresses as you type.
 *
 * ## It is a text field first
 *
 * Whatever is typed is the value, always. Picking a suggestion fills the field
 * in and hands back a coordinate; ignoring the list entirely and typing "the
 * lay-by past the second bridge" is a perfectly good answer for a photo spot
 * and has to keep working. That's also what makes the failure mode acceptable:
 * with no maps key configured, or Google down, the suggestions simply never
 * appear and the field is the plain input it always was.
 *
 * ## Billing shapes the behaviour
 *
 * Google bills autocomplete per request. Two things keep that honest:
 *
 *   - A debounce, so a request goes out when typing pauses rather than per
 *     keystroke.
 *   - A session token, generated here, sent with every prediction request and
 *     then with the details call for the one chosen. Google bills that whole
 *     interaction as one session; without it, each keystroke is billed
 *     separately. A new token starts after each pick, because that ends the
 *     session as far as Google is concerned.
 */

const DEBOUNCE_MS = 350;
/** Matches horacio's MIN_QUERY — below this the server returns nothing anyway. */
const MIN_QUERY = 3;
/** The tallest the list gets when it opens above the field — about five places. */
const ABOVE_MAX_H = 250;

/** Opaque to us; it only has to be unique per interaction. */
function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface AddressFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /**
   * A suggestion was picked. The text has already been applied; this carries
   * the coordinate that came with it, which is the part a caller can't get from
   * the text alone.
   */
  onPlacePicked?: (place: PlaceDetail) => void;
  placeholder?: string;
  /** Biases ranking towards where the member is. Never filters. */
  near?: { lat: number; lng: number } | null;
  style?: any;
  /** Laid over the field's FormInput look — size and margins only. */
  inputStyle?: any;
  /**
   * Open the suggestions above the field, floating over what's there, instead
   * of in flow under it — where, low in a form, the keyboard covers them. In a
   * FormScrollView the field is brought down onto the keyboard and the list
   * gets the room above it (useRoomAbove), as the post form's tag searches do.
   */
  above?: boolean;
}

export default function AddressField({
  value, onChangeText, onPlacePicked, placeholder, near, style, inputStyle, above = false,
}: AddressFieldProps) {
  const colors = useColors();
  const room = useRoomAbove(ABOVE_MAX_H);
  const [search, { isFetching }] = useLazySearchPlacesQuery();
  const [fetchDetails] = useLazyGetPlaceDetailsQuery();

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const session = useRef(newSessionToken());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Suppresses the search that would otherwise follow a pick.
   *
   * Choosing a suggestion sets the text, which looks exactly like typing it —
   * so without this the list would immediately re-open showing the thing that
   * was just chosen.
   */
  const justPicked = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    const q = value.trim();
    if (q.length < MIN_QUERY) {
      setPredictions([]);
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        const result = await search({
          q,
          session: session.current,
          ...(near ? { lat: near.lat, lng: near.lng } : {}),
        }).unwrap();
        setPredictions(result.predictions ?? []);
        setOpen(true);
      } catch {
        // Silent: the field still works as a plain input, which is the whole
        // fallback. An error here is not the member's problem.
        setPredictions([]);
      }
    }, DEBOUNCE_MS);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback(async (prediction: PlacePrediction) => {
    justPicked.current = true;
    setOpen(false);
    setPredictions([]);

    // The label goes in immediately — the details round trip shouldn't make the
    // field look like the tap didn't register.
    onChangeText(prediction.primary);

    try {
      const { place } = await fetchDetails({
        place_id: prediction.place_id,
        session: session.current,
      }).unwrap();
      if (place) onPlacePicked?.(place);
    } catch {
      // The text is already set, which is most of the value. Only the
      // coordinate is lost, and every caller treats that as optional.
    } finally {
      // The session ended with that details call, whether or not it worked.
      session.current = newSessionToken();
    }
  }, [fetchDetails, onChangeText, onPlacePicked]);

  const rows = predictions.map((p) => (
    <TouchableOpacity
      key={p.place_id}
      style={styles.row}
      onPress={() => pick(p)}
      activeOpacity={0.7}
    >
      <MapPin size={13} color={colors.grey} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text style={[styles.primary, { color: colors.fg }]} numberOfLines={1}>
          {p.primary}
        </Text>
        {p.secondary ? (
          <Text style={[styles.secondary, { color: colors.grey }]} numberOfLines={1}>
            {p.secondary}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  ));
  const spinner = isFetching ? (
    <View style={styles.spinnerRow}>
      <ActivityIndicator size="small" color={colors.grey} />
    </View>
  ) : null;
  const showList = open && predictions.length > 0;

  if (above) {
    return (
      // Raised for good, not only while the list shows — a zIndex that changes
      // re-orders the native views and the field loses focus mid-word.
      <View ref={room.ref} collapsable={false} style={[style, styles.aboveHost]}>
        {showList && (
          <View style={[attachedList.listAbove, styles.aboveList, { borderColor: colors.inputBorder }]}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: room.maxHeight }}>
              {rows}
              {spinner}
            </ScrollView>
          </View>
        )}
        <FormInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { setOpen(predictions.length > 0); room.onFocus(); }}
          onBlur={room.onBlur}
          placeholder={placeholder}
          autoCorrect={false}
          style={[inputStyle, showList && attachedList.fieldOpenAbove]}
        />
      </View>
    );
  }

  return (
    <View style={style}>
      <FormInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setOpen(predictions.length > 0)}
        placeholder={placeholder}
        autoCorrect={false}
        style={[inputStyle, showList && attachedList.fieldOpenBelow]}
      />

      {showList && (
        <View style={[attachedList.listBelow, { borderColor: colors.inputBorder }]}>
          {rows}
          {spinner}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * In flow rather than floating.
   *
   * An absolutely-positioned dropdown would need the parent to allow overflow,
   * and both of these fields live inside scroll views where it would be clipped
   * by the next section. Pushing the content down is uglier in principle and
   * reliable in practice.
   */
  // The `above` variant: hangs off the top of the field, over what's above it.
  aboveHost: { zIndex: 20, elevation: 20 },
  aboveList: {
    position: 'absolute', left: 0, right: 0, bottom: '100%',
    boxShadow: '0px -6px 18px rgba(0, 0, 0, 0.45)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  rowIcon:   { marginTop: 1 },
  rowText:   { flex: 1 },
  primary:   { fontSize: 14, fontFamily: FONT_INTER.semibold },
  secondary: { fontSize: 12, marginTop: 1 },
  spinnerRow: { paddingVertical: 10, alignItems: 'center' },
});
