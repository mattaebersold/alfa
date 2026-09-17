import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import CarPosterCard from '../cards/CarPosterCard';
import RowEndSpacer from '../ui/RowEndSpacer';
import { shuffle } from '../../utils/array';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const ROW_PAD = 14; // matches the section heading's inset
const CARD_WIDTH = SCREEN_WIDTH * 0.85;

interface Props {
  onCarPress: (carId: string) => void;
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
 * The row sizes its own cards, so the poster takes a width and drops its
 * margins rather than using `compact` — that variant scales the name down for
 * half-width grids, and these are the widest cards on the screen.
 */
function FeaturedCarsRow({ onCarPress }: Props) {
  const { data } = useGetSiteSettingsQuery();
  // Shuffled per mount: the featured list is longer than the row shows at a
  // glance, so a fixed order means the same two or three cars are the only ones
  // anyone ever sees. Memoised on the data — an unmemoised shuffle reorders on
  // every re-render, which turns a scroll into a slot machine.
  const featured = data?.featured_cars;
  const cars = useMemo(() => shuffle(featured ?? []), [featured]);

  if (!cars.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Featured Cars</Text>
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
            onBeforeNavigate={() => onCarPress(car.internal_id)}
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
  container: { backgroundColor: '#000', paddingTop: 14, paddingBottom: 4 },
  heading: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.4,
    paddingHorizontal: 14, marginBottom: 10, color: '#FFFFFF',
  },
  // Padding rather than margin on the cards: a horizontal ScrollView clips at
  // its content bounds, so the glow needs the room to be inside them.
  scroll: { gap: CARD_GAP, paddingLeft: ROW_PAD, paddingTop: 4, paddingBottom: 18 },
  card:   { width: CARD_WIDTH, marginHorizontal: 0, marginVertical: 0 },
});
