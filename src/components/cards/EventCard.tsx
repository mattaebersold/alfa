import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../ui/Avatar';
import EventDateBadge from '../society/EventDateBadge';
import EventImage from '../society/EventImage';
import { firstGalleryUrl } from '../../utils/image';
import { categoryFor, occurrenceDate } from '../../constants/eventTypes';
import type { SocietyEvent, User } from '../../types/api';

interface EventCardProps {
  event: SocietyEvent;
  onPress?: (event: SocietyEvent) => void;
  /** 'carousel' is fixed-width for horizontal lists; 'row' is a shallower card. */
  variant?: 'default' | 'carousel' | 'row';
  width?: number;
}

/** Up to three overlapping avatars, then "+N" for the rest. */
function InterestedStack({ users, total }: { users?: User[]; total: number }) {
  if (!users?.length) return null;
  const extra = total - users.length;

  return (
    <View style={styles.stack}>
      {users.map((user, i) => (
        <View key={user.user_id} style={i > 0 ? styles.stackOverlap : undefined}>
          <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={30} />
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
export default function EventCard({ event, onPress, variant = 'default', width }: EventCardProps) {
  if (!event) return null;

  const category = categoryFor(event.category);
  const date = occurrenceDate(event);
  const hero = firstGalleryUrl(event.gallery);

  return (
    <TouchableOpacity
      style={[styles.card, width != null && { width }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.9}
    >
      {/* Header bar — the card's loudest signal that this is an event */}
      <View style={[styles.headerBar, { backgroundColor: category.color }]}>
        <Text style={styles.headerText}>Event</Text>
        <Text style={[styles.headerText, styles.headerCategory]} numberOfLines={1}>
          {category.label}
        </Text>
      </View>

      <View style={{ aspectRatio: variant === 'row' ? 16 / 7 : 4 / 3 }}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} />

        {/* Scrim — keeps the overlaid text legible on any photo */}
        <LinearGradient
          colors={['transparent', 'rgba(15,15,15,0.35)', 'rgba(15,15,15,0.92)']}
          locations={[0.25, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.interested}>
          <InterestedStack users={event.interested_preview} total={event.interested_count ?? 0} />
        </View>

        {/* Date badge + title along the bottom. The right padding keeps copy
            clear of the avatar stack. */}
        <View style={styles.body}>
          <EventDateBadge date={date} size="sm" />
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1A1A' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, gap: 12,
  },
  headerText:     { fontSize: 14, fontWeight: '800', color: '#000000' },
  headerCategory: { flexShrink: 1, textAlign: 'right' },

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
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
