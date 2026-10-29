import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { Check } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import type { TagItem } from './PostTagPicker';
import { COLOR_WHITE, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const CARD_WIDTH = 104;

export interface TagCard {
  tag: TagItem;
  /** The photo that is the tile. */
  image?: string | null;
  /** Drawn in the tile when there's no photo — a glyph, initials. */
  fallback?: React.ReactNode;
  /** The tile's fill behind `fallback`, in place of black — a member's own colour. */
  fallbackBg?: string;
}

/**
 * A row of photo tiles you tap to tag — the garage strip's look, for anything
 * a tag card offers up front (your cars, what you've tagged lately).
 *
 * The same tags the search finds: tapping one is exactly what picking it out
 * of the results does, and tapping it again takes it off. Nothing to show,
 * nothing drawn.
 */
export default function TagCardStrip({
  cards,
  selectedIds,
  onToggle,
  title,
  bleed = 0,
}: {
  cards: TagCard[];
  selectedIds: string[];
  onToggle: (tag: TagItem) => void;
  /** A small caption over the row — "Recently tagged". */
  title?: string;
  /**
   * The padding of whatever it sits in. The strip reaches out past it to that
   * container's edges, so the tiles scroll edge to edge, and the first one
   * still starts on the padding line.
   */
  bleed?: number;
}) {
  const colors = useColors();
  if (cards.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {title ? <Text style={[styles.title, { color: colors.grey }]}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}
      >
        {cards.map(({ tag, image, fallback, fallbackBg }) => {
          const selected = selectedIds.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.card,
                // No border and no ground of its own — the photo is the tile,
                // and tagged is the teal check on it.
                { backgroundColor: colors.inputBg },
              ]}
              onPress={() => onToggle(tag)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${selected ? 'Untag' : 'Tag'} ${tag.label}`}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} />
              ) : (
                <View style={[styles.image, styles.fallback, fallbackBg ? { backgroundColor: fallbackBg } : null]}>{fallback}</View>
              )}
              {selected && (
                <View style={[styles.check, { backgroundColor: colors.teal }]}>
                  <Check size={11} color={COLOR_WHITE} strokeWidth={3.5} />
                </View>
              )}
              {/* On the photo rather than in a bar under it: the name sits in
                  the image's lower edge, on a see-through band. */}
              {/* A member's handle on one line — it's one word, and wrapped it
                  broke mid-name. A car's or a spot's name may take two. */}
              <Text style={styles.label} numberOfLines={tag.kind === 'user' ? 1 : 2}>{tag.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { marginBottom: 12 },
  title:   { fontSize: 11, fontFamily: FONT_INTER.bold, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 },
  row:     { gap: 8 },
  // Tighter corners than the app's radius: at this size a full one rounds
  // away a real share of a small photo.
  card:    { width: CARD_WIDTH, borderRadius: 6, overflow: 'hidden' },
  // Taller now that it carries the name — the photo is the whole tile.
  image:   { width: '100%', height: 78 },
  // The glyph or initials sit above the name band, not under it. Black, not
  // the tile's input grey: that's within a shade of the tag card behind it,
  // so a photo-less tile read as a hole in the card rather than a tile.
  fallback:{ alignItems: 'center', justifyContent: 'center', paddingBottom: 18, backgroundColor: COLOR_BLACK },
  check:   {
    position: 'absolute', top: 5, right: 5,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  label:   {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 6, paddingTop: 4, paddingBottom: 5,
    fontSize: 11, fontFamily: FONT_INTER.bold, lineHeight: 14, color: COLOR_WHITE,
    // A see-through black band across the photo's foot, so the name reads over
    // any picture without hiding the car behind it.
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
