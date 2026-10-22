import React, { createContext, useContext, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { MapPin } from 'lucide-react-native';
import PlacePostsModal from './PlacePostsModal';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import type { PostPlace } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The place whose list this is being drawn inside, if any.
 *
 * A post opened from a place's list carries that same place on its card, and a
 * tap there would open the list again over itself — a loop with a modal for
 * every turn. Inside the list (PlacePostsModal provides this) the line is just
 * words.
 */
export const CurrentPlaceContext = createContext<string | null>(null);

/**
 * Where a post was made, as one small line: a pin and the place's name.
 *
 * Under the post and its tags rather than up by the author — it's a fact about
 * the post, like what's tagged in it, not about who made it — and small, so it
 * reads as a footnote rather than a second title. A tap opens the place: every
 * post made there, in a summary over wherever you were.
 *
 * Owns its own modal, so any card that draws this gets the whole behaviour
 * without its host wiring anything.
 */
export default function PostPlaceLine({ place, color, style }: {
  place?: PostPlace | null;
  /** The line's ink — the card's muted colour, which a diecast card changes. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insidePlace = useContext(CurrentPlaceContext);
  const [open, setOpen] = useState<{ origin: SummaryOrigin | null } | null>(null);

  if (!place?.place_id || !place.name) return null;
  const ink = color ?? colors.grey;

  const line = (
    <>
      <MapPin size={12} color={ink} />
      <Text style={[styles.name, { color: ink }]} numberOfLines={1}>{place.name}</Text>
    </>
  );

  if (insidePlace === place.place_id) {
    return <View style={[styles.row, style]}>{line}</View>;
  }

  return (
    <>
      <SummaryTouchable
        style={[styles.row, style]}
        onPress={(origin) => setOpen({ origin })}
        activeOpacity={0.7}
        accessibilityLabel={`Posts at ${place.name}`}
      >
        {line}
      </SummaryTouchable>
      <PlacePostsModal
        place={open ? place : null}
        origin={open?.origin}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Sized to its words, so the tap is on the line and not the card's width.
  row:  { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  name: { fontSize: 12.5, fontFamily: FONT_INTER.medium, flexShrink: 1 },
});
