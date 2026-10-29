import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import CarPosterCard from '../cards/CarPosterCard';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useShuffled } from '../../hooks/useShuffled';
import { GUTTER } from '../../constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
/** The row's inset — the app's gutter, as the heading and tools around it. */
const ROW_PAD = GUTTER;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

interface Props {
  /** Optional now: a tap opens the car's summary, which has its own way to the car. */
  onCarPress?: (carId: string) => void;
}

/**
 * The cars the site is showing off, as posters.
 *
 * These used to be their own card — a photo behind a flat black bar holding the
 * name and an avatar. It was the only car card in the app that looked like
 * that, which made the featured row read as a different kind of object rather
 * than as the best examples of the same one. It's the shared poster now, at the
 * full plate size and with the type-coloured glow underneath.
 *
 * Laid out as the garage's cards are (`plain`): the same plate, the same
 * counts down the bottom right, with the Featured pill and the owner up top.
 *
 * The row sizes its own cards, so the poster takes a width and drops its
 * margins rather than using `compact` — that variant scales the name down for
 * half-width grids, and these are the widest cards on the screen.
 */
function FeaturedCarsRow({ onCarPress }: Props) {
  const { data } = useGetSiteSettingsQuery();
  // A fresh order on every visit: the featured list is longer than the row
  // shows at a glance, so a fixed order means the same two or three cars are
  // the only ones anyone ever sees. Held still while you're on the screen —
  // see useShuffled.
  const cars = useShuffled(data?.featured_cars);

  if (!cars.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
      >
        {cars.map((car: any) => (
          <CarPosterCard
            key={car.internal_id}
            car={car}
            // A featured car belongs to someone, and this row is the one place
            // you meet it without having come from their profile.
            showOwner
            featured
            // Dressed as a garage card: its plate — name, then year/make/model —
            // and what's been logged against it down the bottom right.
            plain
            // Squares, so the row lines up; and a preview first, like the
            // members row — the summary has its own View Car.
            square
            summaryOnPress
            onBeforeNavigate={onCarPress ? () => onCarPress(car.internal_id) : undefined}
            style={styles.card}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
    </View>
  );
}

export default FeaturedCarsRow;

const styles = StyleSheet.create({
  // Transparent: on the page's own ground, not a black band across it.
  container: {},
  // Padding rather than margin on the cards: a horizontal ScrollView clips at
  // its content bounds, so the glow needs the room to be inside them.
  scroll: { gap: CARD_GAP, paddingLeft: ROW_PAD, paddingTop: 4, paddingBottom: 18 },
  card:   { width: CARD_WIDTH, marginHorizontal: 0, marginVertical: 0 },
});
