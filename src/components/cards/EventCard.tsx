import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../ui/Avatar';
import EventDateBadge from '../society/EventDateBadge';
import EventImage from '../society/EventImage';
import { firstGalleryUrl } from '../../utils/image';
import { categoryFor, occurrenceDate, ORS_EVENT_COLOR } from '../../constants/eventTypes';
import { contrastText } from '../../hooks/useBrandColor';
import type { SocietyEvent, User } from '../../types/api';

/**
 * The card follows its photo's own shape, but a panorama or a very tall crop
 * would otherwise turn one card into a sliver or a skyscraper. These bounds sit
 * outside anything a phone camera produces, so ordinary photos pass through.
 */
const MIN_RATIO = 0.5;
const MAX_RATIO = 3;

interface EventCardProps {
  event: SocietyEvent;
  onPress?: (event: SocietyEvent) => void;
  /** 'carousel' is fixed-width for horizontal lists; 'row' is a shallower card. */
  variant?: 'default' | 'carousel' | 'row';
  width?: number;
  /**
   * Hold the photo to a fixed shape (16/9, say) instead of letting the card
   * take the photo's own. Worth it where the cards sit side by side and the
   * ragged heights read as sloppy rather than as photos being photos.
   */
  ratio?: number;
  /**
   * Show who's interested, bottom-right. Off where the card is small enough
   * that the stack crowds the title more than the faces are worth.
   */
  showInterested?: boolean;
}

/** Up to three overlapping avatars, then "+N" for the rest. */
function InterestedStack({ users, total }: { users?: User[]; total: number }) {
  if (!users?.length) return null;
  const extra = total - users.length;

  return (
    <View style={styles.stack}>
      {users.map((user, i) => (
        <View key={user.user_id} style={i > 0 ? styles.stackOverlap : undefined}>
          <Avatar user={user} size={30} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.stackMore, styles.stackOverlap]}>
          <Text style={styles.stackMoreText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The society event card — upcoming carousel, day sheet, Your Events and the
 * feed all use it, so an event reads the same wherever it appears.
 *
 * A category-coloured bar caps the card — "Event" on the left, the category on
 * the right — over a photo carrying the date badge and title along the bottom
 * and the interested avatars bottom-right.
 */
export default function EventCard({
  event, onPress, variant = 'default', width, ratio, showInterested = true,
}: EventCardProps) {
  // The photo's own shape, once it has decoded. Until then — and for events with
  // no photo at all — the card keeps the variant's shape so a list of them
  // doesn't start out ragged.
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);

  if (!event) return null;

  const category = categoryFor(event.category);
  const date = occurrenceDate(event);
  const hero = firstGalleryUrl(event.gallery);
  const fallbackRatio = variant === 'row' ? 16 / 7 : 4 / 3;
  // A caller-set shape wins outright; nothing measures the photo in that case,
  // since the frame isn't going to move whatever comes back.
  const frameRatio = ratio ?? measuredRatio ?? fallbackRatio;

  return (
    <TouchableOpacity
      style={[styles.card, width != null && { width }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.9}
    >
      <View style={{ aspectRatio: frameRatio }}>
        <EventImage
          uri={hero}
          style={StyleSheet.absoluteFill}
          onAspectRatio={ratio == null
            ? (r) => setMeasuredRatio(Math.min(Math.max(r, MIN_RATIO), MAX_RATIO))
            : undefined}
        />

        {/* Scrim — keeps the overlaid text legible on any photo. It has to
            carry a white title over a bright sky or a pale car, so the bottom
            third goes nearly solid rather than merely tinted. */}
        <LinearGradient
          colors={['transparent', 'rgba(15,15,15,0.55)', 'rgba(15,15,15,0.97)']}
          locations={[0.2, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* The category, worn as a tag along the top. This is the colour coding
            that the full-width header bar used to carry — the same hue, sized
            to a label rather than to a band across the card, so the photo gets
            the room and a row of cards reads as photos with tags on them
            instead of a stack of coloured stripes. */}
        <View style={styles.topRow}>
          <View style={[styles.categoryPill, { backgroundColor: category.color }]}>
            <Text
              style={[styles.categoryText, { color: contrastText(category.color) }]}
              numberOfLines={1}
            >
              {category.label}
            </Text>
          </View>
          {event.ors_sponsored && (
            <View style={[styles.orsBadge, { backgroundColor: ORS_EVENT_COLOR }]}>
              <Text style={styles.orsBadgeText}>ORS Event</Text>
            </View>
          )}
        </View>

        {showInterested && (
          <View style={styles.interested}>
            <InterestedStack users={event.interested_preview} total={event.interested_count ?? 0} />
          </View>
        )}

        {/* Date badge + title along the bottom. The right padding is there to
            keep copy clear of the avatar stack — without the stack the title
            gets the full width instead. */}
        <View style={[styles.body, !showInterested && styles.bodyWide]}>
          <EventDateBadge date={date} size="sm" />
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        </View>
      </View>

      {/* The category hue once more as a rule under the card. A tag alone is
          easy to miss when scanning a row; this is enough colour to sort cards
          at a glance without taking any space back from the photo. */}
      <View style={[styles.accent, { backgroundColor: category.color }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1A1A' },

  accent: { height: 3 },

  // Tags run along the top of the photo; the avatars sit bottom-right and the
  // copy along the bottom, so this edge is the one corner nothing else claims.
  topRow: {
    position: 'absolute', top: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  categoryPill: {
    flexShrink: 1,
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryText: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  orsBadge: {
    flexShrink: 0,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  orsBadgeText: {
    fontSize: 10, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  interested: { position: 'absolute', bottom: 8, right: 8 },
  stack:        { flexDirection: 'row', alignItems: 'center' },
  stackOverlap: { marginLeft: -10 },
  stackMore: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  stackMoreText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },

  body: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 12, paddingRight: 110,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  bodyWide: { paddingRight: 12 },
  // The shadow is the belt to the scrim's braces: it holds the letters apart
  // from whatever detail sits directly behind them, which a flat wash can't.
  title: {
    flex: 1, fontSize: 16, lineHeight: 20, fontWeight: '800', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
