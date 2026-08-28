import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, MapPin } from 'lucide-react-native';
import {
  useGetPostTagsQuery, useGetUserByIdQuery, useGetCarQuery, useGetEventQuery,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import BottomSheet from '../ui/SharedModal';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { useColors } from '../../hooks/useColors';
import { format } from 'date-fns';
import type { AppStackParamList } from '../../navigation/types';
import type { Event } from '../../types/api';
import { calendarDate } from '../../utils/calendarDate';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function kindFromEntryType(t: string): 'user' | 'car' | 'event' | null {
  if (t === 'user') return 'user';
  if (t === 'garagecar' || t === 'car') return 'car';
  if (t === 'event') return 'event';
  return null;
}

// ── Section wrapper (labeled, full-width card block) ──────────────────────────

/**
 * A labelled group of tags.
 *
 * No background of its own: the tags are already cards, and painting a card
 * behind a row of cards was two surfaces doing one job. The label and the gap
 * above it are what separate one group from the next.
 *
 * `stacked` is the half-width form used when cars and people sit beside each
 * other — its items run down the column one per row, since there is no room
 * for two across half a screen.
 */
function TagSection({ label, stacked, children }: {
  label: string;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={stacked ? styles.column : styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.grey }]}>{label}</Text>
      <View style={stacked ? styles.stack : styles.grid}>{children}</View>
    </View>
  );
}

// ── Individual rows (each resolves its own entity) ────────────────────────────

type Go = (fn: (nav: Nav) => void) => void;

function CarTagRow({ id, go, stacked }: { id: string; go: Go; stacked?: boolean }) {
  const colors = useColors();
  const { data: car } = useGetCarQuery(id, { skip: !id });
  if (!car) return null;
  const img = car.profile_image ? imageUrl(car.profile_image) : firstGalleryUrl(car.gallery);
  const name = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';
  return (
    <TouchableOpacity
      style={[styles.badge, stacked ? styles.badgeStacked : styles.gridItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      onPress={() => go((n) => n.navigate('CarDetail', { carId: car.internal_id }))}
      activeOpacity={0.75}
    >
      {img
        ? <Image source={{ uri: img }} style={styles.badgeThumb} contentFit="cover" />
        : <View style={[styles.badgeThumb, { backgroundColor: colors.segment }]} />}
      <Text style={[styles.badgeName, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

function UserTagRow({ id, go, stacked }: { id: string; go: Go; stacked?: boolean }) {
  const colors = useColors();
  const { data: user } = useGetUserByIdQuery(id, { skip: !id });
  if (!user) return null;
  return (
    <TouchableOpacity
      style={[styles.badge, stacked ? styles.badgeStacked : styles.gridItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      onPress={() => go((n) => n.navigate('UserDetail', { userId: user.user_id, username: user.username }))}
      activeOpacity={0.75}
    >
      <Avatar user={user} size={28} />
      <Text style={[styles.badgeName, { color: colors.fg }]} numberOfLines={1}>@{user.username}</Text>
    </TouchableOpacity>
  );
}

function EventTagRow({ id, onOpen, stacked }: { id: string; onOpen: (e: Event) => void; stacked?: boolean }) {
  const colors = useColors();
  const { data: event } = useGetEventQuery(id, { skip: !id });
  if (!event) return null;
  const img = firstGalleryUrl(event.gallery);
  return (
    <TouchableOpacity
      style={[styles.badge, stacked ? styles.badgeStacked : styles.gridItem, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
      onPress={() => onOpen(event)}
      activeOpacity={0.75}
    >
      {img
        ? <Image source={{ uri: img }} style={styles.badgeThumb} contentFit="cover" />
        : <View style={[styles.badgeThumb, styles.badgeThumbFallback, { backgroundColor: colors.segment }]}>
            <Calendar size={14} color={colors.grey} />
          </View>}
      <Text style={[styles.badgeName, { color: colors.fg }]} numberOfLines={1}>{event.title || 'Event'}</Text>
    </TouchableOpacity>
  );
}

// ── Event detail shown in the shared bottom-sheet modal ───────────────────────

function EventModalContent({ event, onViewFull }: { event: Event; onViewFull: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(event.gallery);
  let date: string | null = null;
  const eventDay = calendarDate(event.event_date);
  if (eventDay) {
    try { date = format(eventDay, 'EEEE, MMMM d, yyyy'); } catch { date = null; }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      {hero && <Image source={{ uri: hero }} style={styles.eventHero} contentFit="cover" />}
      {date && (
        <View style={styles.eventRow}>
          <Calendar size={16} color={colors.primaryAlt} />
          <Text style={[styles.eventRowText, { color: colors.fg }]}>
            {date}{event.event_time ? ` · ${event.event_time}` : ''}
          </Text>
        </View>
      )}
      {event.location && (
        <View style={styles.eventRow}>
          <MapPin size={16} color={colors.primaryAlt} />
          <Text style={[styles.eventRowText, { color: colors.fg }]}>{event.location}</Text>
        </View>
      )}
      {event.body ? <Text style={[styles.eventBody, { color: colors.muted }]}>{stripHtml(event.body)}</Text> : null}
      <TouchableOpacity style={[styles.viewBtn, { backgroundColor: colors.primaryAlt }]} onPress={onViewFull} activeOpacity={0.85}>
        <Text style={styles.viewBtnText}>View full event</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const uniq = (arr: string[]) => Array.from(new Set(arr));

interface PostTagBadgesProps {
  postId: string;
  /**
   * Lets the host dismiss itself before the target screen loads — a tagged
   * user or car opened from inside a modal should replace it, not stack on
   * top of it. Defaults to navigating straight away.
   */
  onNavigate?: (go: (nav: Nav) => void) => void;
}

export default function PostTagBadges({ postId, onNavigate }: PostTagBadgesProps) {
  const nav = useNavigation<Nav>();
  const go = (fn: (n: Nav) => void) => (onNavigate ? onNavigate(fn) : fn(nav));
  const { data: tags } = useGetPostTagsQuery(postId, { skip: !postId });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const carIds: string[] = [];
  const userIds: string[] = [];
  const eventIds: string[] = [];
  (tags ?? []).forEach((t) => {
    const kind = kindFromEntryType(t.tag_entry_type);
    if (kind === 'car') carIds.push(t.tag_internal_id);
    else if (kind === 'user') userIds.push(t.tag_internal_id);
    else if (kind === 'event') eventIds.push(t.tag_internal_id);
  });

  const cars = uniq(carIds);
  const users = uniq(userIds);
  const events = uniq(eventIds);

  if (cars.length + users.length + events.length === 0) return null;

  return (
    <>
      {/* Cars on the left, people on the right — but only when there are both.
          One of them alone in a half-width column would leave the other half
          empty, so a lone section takes the full width and lays its own items
          out two across instead. */}
      {cars.length > 0 && users.length > 0 ? (
        <View style={styles.columns}>
          <TagSection label="Tagged Cars" stacked>
            {cars.map((id, i) => <CarTagRow key={`c-${id}-${i}`} id={id} go={go} stacked />)}
          </TagSection>
          <TagSection label="Tagged People" stacked>
            {users.map((id, i) => <UserTagRow key={`u-${id}-${i}`} id={id} go={go} stacked />)}
          </TagSection>
        </View>
      ) : (
        <>
          {cars.length > 0 && (
            <TagSection label="Tagged Cars">
              {cars.map((id, i) => <CarTagRow key={`c-${id}-${i}`} id={id} go={go} />)}
            </TagSection>
          )}
          {users.length > 0 && (
            <TagSection label="Tagged People">
              {users.map((id, i) => <UserTagRow key={`u-${id}-${i}`} id={id} go={go} />)}
            </TagSection>
          )}
        </>
      )}
      {events.length > 0 && (
        <TagSection label="Tagged Events">
          {events.map((id, i) => <EventTagRow key={`e-${id}-${i}`} id={id} onOpen={setSelectedEvent} />)}
        </TagSection>
      )}

      {/* Tagged-event detail modal */}
      <BottomSheet
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || 'Event'}
      >
        {selectedEvent && (
          <EventModalContent
            event={selectedEvent}
            onViewFull={() => {
              const eventId = selectedEvent.internal_id;
              setSelectedEvent(null);
              go((n) => n.navigate('EventDetailModal', { eventId }));
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  // Matches the card inset either side of it, so the tags line up with the
  // sections above and below rather than sitting in their own margin.
  section:      { paddingHorizontal: 12, paddingTop: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  /**
   * Two columns, always.
   *
   * `space-between` with a width just under half is what fixes the count: a
   * gap-based row can fit three narrow items or one wide one depending on the
   * screen, so the grid changed shape between devices. This can only ever be
   * two, and the leftover 3% is the gutter.
   */
  grid:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  gridItem:     { width: '48.5%' },
  badgeStacked: { width: '100%' },

  // The two side-by-side sections, and one of them.
  columns:      { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 16, gap: 10 },
  // `minWidth: 0` so a long car name shrinks its column rather than pushing
  // the other one off the screen.
  column:       { flex: 1, minWidth: 0 },
  // One per row: half a screen has no room for two across.
  stack:        { gap: 8 },

  // Fills whichever container it lands in — half of `grid`, all of `stack`.
  badge:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingLeft: 7, paddingRight: 10, borderRadius: 10, borderWidth: 1 },
  badgeThumb:   { width: 28, height: 28, borderRadius: 14 },
  badgeThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  badgeName:    { flex: 1, fontSize: 13, fontWeight: '600' },

  eventHero:    { width: '100%', height: 160, borderRadius: 12, marginBottom: 14 },
  eventRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  eventRowText: { flex: 1, fontSize: 14, fontWeight: '600' },
  eventBody:    { fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: 16 },
  viewBtn:      { paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  viewBtnText:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
