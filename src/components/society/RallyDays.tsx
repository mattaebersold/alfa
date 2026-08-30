import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { rallyDayDate } from '../../utils/rally';
import type { RallyDay } from '../../types/api';

/**
 * The rally's itinerary: each day a self-contained card in one column.
 *
 * Contained the way the FAQ list is, so a day reads as one unit — heading, copy
 * and artwork inside a single panel — rather than as loose rows the eye has to
 * group. Single column: an itinerary is a sequence, and columns would ask the
 * reader to work out the order.
 *
 * The image sits under the description, where it illustrates what was just
 * described rather than competing with it for first read, and keeps its own
 * proportions — a day's artwork is whatever shape it was uploaded as, and a
 * fixed ratio would crop a tall photo or a wide route shot to fit.
 *
 * Mirrors murray's components/pages/rallys/RallyDays.js.
 */
export default function RallyDays({ days = [] }: { days?: RallyDay[] }) {
  const c = useColors();

  const items = days.filter(
    (day) => day?.title || day?.subtitle || day?.date || day?.description || day?.image?.filename,
  );
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: c.fg }]}>Itinerary</Text>

      <View style={styles.list}>
        {items.map((day, i) => {
          const dayDate = rallyDayDate(day.date);
          const art = day.image?.filename ? imageUrl(day.image.filename) : null;
          return (
            <View key={i} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.dayLabel, { color: c.grey }]}>
                DAY {i + 1}{dayDate ? ` · ${dayDate.toUpperCase()}` : ''}
              </Text>
              {day.title ? (
                <Text style={[styles.title, { color: c.fg }]}>{day.title}</Text>
              ) : null}
              {day.subtitle ? (
                <Text style={[styles.subtitle, { color: c.primaryAlt }]}>{day.subtitle}</Text>
              ) : null}
              {day.description ? (
                // The field is a plain textarea on the admin side, so the line
                // breaks someone typed are the only structure it has.
                <Text style={[styles.description, { color: c.muted }]}>{day.description}</Text>
              ) : null}
              {art ? (
                <RallyDayImage uri={art} alt={day.title ?? `Day ${i + 1}`} />
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Keeps the artwork's own proportions rather than cropping it to a card. */
function RallyDayImage({ uri, alt }: { uri: string; alt: string }) {
  const [ratio, setRatio] = React.useState(16 / 9);
  return (
    <Image
      source={{ uri }}
      style={[styles.dayImage, { aspectRatio: ratio }]}
      contentFit="cover"
      accessibilityLabel={alt}
      transition={150}
      onLoad={(e) => setRatio(e.source.width / e.source.height)}
    />
  );
}

const styles = StyleSheet.create({
  section:  { paddingHorizontal: 16, paddingTop: 28 },
  heading:  { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  list:     { gap: 12 },
  card:     { borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  dayLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title:    { fontSize: 20, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 15, fontWeight: '700', marginTop: 3 },
  description: { fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  dayImage: { width: '100%', borderRadius: 10, marginTop: 14 },
});
