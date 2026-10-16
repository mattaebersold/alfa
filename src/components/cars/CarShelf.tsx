import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Images, Plus } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { clampMediaRatio } from '../../utils/postMedia';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** One card on the shelf: a picture, what it is, and a line under it. */
export interface ShelfCard {
  key: string;
  image?: string | null;
  title: string;
  subtitle?: string;
  /** A short label in a pill on the picture's top-left corner — a mod's kind. */
  badge?: string;
  /** An icon before the badge's words — a gallery's photo count. */
  BadgeIcon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
}

const CARD_WIDTH = 168;
const CARD_GAP = 10;
const MEDIA_RATIO = 4 / 3;
/** A card with no picture: a well darker than the card around it. */
const BLANK_BG = '#151515';

/**
 * A car's mods or albums as a shelf — the latest few sideways, and the rest
 * behind "View all". PostStrip's shape (card width, header, link), for the two
 * kinds of thing on a car page that aren't posts, so the three shelves read as
 * one set.
 *
 * Presentational: the page fetches the handful and says what a tap does.
 */
export default function CarShelf({ title, cards, total, onViewAll, onAdd, addLabel, ruled = false, ruleGap, cardWidth = CARD_WIDTH, spaceBelow = 0 }: {
  title: string;
  cards: ShelfCard[];
  /** The whole count, for the link's label. */
  total?: number;
  onViewAll: () => void;
  /** Owner only: a button beside View all that opens the form for one more. */
  onAdd?: () => void;
  /** "Add mod" — the button's words. */
  addLabel?: string;
  /** A rule above, setting this shelf apart from the one before it. */
  ruled?: boolean;
  /** Room above the rule, when the default 26 is too much for what's above. */
  ruleGap?: number;
  /** The cards' width. */
  cardWidth?: number;
  /** Room under the shelf — for the last of a set, before whatever follows. */
  spaceBelow?: number;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  // Nothing to show is nothing to say — an empty shelf reads as a failure.
  // Except to the owner, who gets the heading and its Add: the shelf is where
  // the first one goes.
  const empty = cards.length === 0;
  if (empty && !onAdd) return null;

  return (
    <View style={[styles.wrap, ruled && [styles.ruled, { borderTopColor: colors.border }, ruleGap != null && { marginTop: ruleGap }], spaceBelow > 0 && { paddingBottom: spaceBelow }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headActions}>
          {/* Just a +, in the account's colour — the one thing here only the
              owner can do. Its words are for the screen reader. */}
          {onAdd ? (
            <TouchableOpacity
              style={[styles.addCircle, { backgroundColor: brand }]}
              onPress={onAdd}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={addLabel ?? 'Add'}
            >
              <Plus size={16} color={COLOR_BLACK} strokeWidth={2.8} />
            </TouchableOpacity>
          ) : null}
          {!empty && (
          <TouchableOpacity
            style={[styles.viewAllBtn, { borderColor: colors.borderDark }]}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total ?? cards.length} ${title.toLowerCase()}`}
          >
            <Text style={[styles.viewAllText, { color: colors.fg }]}>View all</Text>
          </TouchableOpacity>
          )}
        </View>
      </View>
      {!empty && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {cards.map((c) => <ShelfTile key={c.key} card={c} width={cardWidth} />)}
        <RowEndSpacer />
      </ScrollView>
      )}
    </View>
  );
}

/**
 * One card — a mod, an album — as the shelf draws it, and as the list behind
 * its "View all" draws it too, so the two are the same card.
 */
export function ShelfTile({ card: c, width, naturalRatio = false }: {
  card: ShelfCard;
  width: number;
  /** The picture at its own shape (clamped) rather than 4:3 — for a mosaic. */
  naturalRatio?: boolean;
}) {
  const colors = useColors();
  const [ratio, setRatio] = useState(MEDIA_RATIO);
  const shape = naturalRatio ? { aspectRatio: ratio } : null;
  return (
    <TouchableOpacity
          style={[styles.card, { width, backgroundColor: colors.card, borderColor: colors.borderDark }]}
      onPress={c.onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={c.title}
    >
      {c.image ? (
        <Image
        source={{ uri: c.image }}
        style={[styles.image, shape]}
        contentFit="cover"
        transition={150}
        onLoad={naturalRatio ? (e) => {
          const { width: w, height: h } = e.source;
          if (w && h) setRatio(clampMediaRatio(w / h));
        } : undefined}
      />
      ) : (
        // Darker than the card, so a blank picture reads as a hole for one.
        <View style={[styles.image, styles.imageBlank, { backgroundColor: BLANK_BG }]}>
          <Images size={22} color={colors.grey} />
        </View>
      )}
      {c.badge ? (
        // A badge with an icon (a photo count) is a size up: it's a number
        // and a glyph, and at the words' size the pair read as a speck.
        <View style={[styles.badge, c.BadgeIcon && styles.badgeLarge]} pointerEvents="none">
          {c.BadgeIcon ? <c.BadgeIcon size={15} color={COLOR_WHITE} strokeWidth={2.4} /> : null}
          <Text style={[styles.badgeText, c.BadgeIcon && styles.badgeTextLarge]} numberOfLines={1}>{c.badge}</Text>
        </View>
      ) : null}
      {/* The name over the foot of the picture, on a fade to black so it
          reads on any photo — the card is the picture now. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.45, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
        {c.subtitle ? (
          <Text style={styles.cardSub} numberOfLines={1}>{c.subtitle}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** The cards' corners — a touch tighter than the app's 20, at this size. */
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  // Room between one shelf and the next.
  wrap: { paddingTop: 30 },
  // A full-width rule with room either side of it.
  ruled: { marginTop: 26, paddingTop: 26, borderTopWidth: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // Buttons tucked nearer the edge than the title is.
    paddingLeft: 16, paddingRight: 10, paddingBottom: 10,
  },
  title: { fontSize: 17, fontFamily: FONT_INTER.semibold },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Outlined, and as tall as the + beside it.
  viewAllBtn: { height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewAllText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  addCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { paddingLeft: 16, gap: CARD_GAP },
  card: { borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // Rounded at the foot as well, as PostStrip's — the picture as its own tile.
  image: {
    width: '100%', aspectRatio: MEDIA_RATIO,
    borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden',
  },
  imageBlank: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 8, left: 8, maxWidth: '80%',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  badgeLarge: { gap: 5, paddingHorizontal: 11, paddingVertical: 6 },
  badgeTextLarge: { fontSize: 13.5 },
  cardTitle: { fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 18, color: COLOR_WHITE },
  cardSub: { fontSize: 11.5, fontFamily: FONT_INTER.medium, color: 'rgba(255,255,255,0.75)' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  overlay: { position: 'absolute', left: 10, right: 10, bottom: 9, gap: 1 },
});
