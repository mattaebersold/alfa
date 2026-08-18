import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Clock, Repeat, MapPin, Check, Plus, CalendarPlus, MoreHorizontal } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import CheckeredFlag from '../ui/CheckeredFlag';
import InlineComments from '../social/InlineComments';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import {
  useGetSocietyEventQuery,
  useGetEventInterestedUsersQuery,
  useGetEventTaggedPostsQuery,
  useToggleEventInterestMutation,
  useDeleteSocietyEventMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { categoryFor, formatTime, occurrenceDate, ORS_EVENT_COLOR } from '../../constants/eventTypes';
import EventDateBadge from './EventDateBadge';
import EventImage from './EventImage';
import { googleCalendarUrl } from '../../utils/calendarLinks';
import RowEndSpacer from '../ui/RowEndSpacer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Three tiles across the padded section, so a fourth peeks from the slider.
const POST_TILE = (SCREEN_WIDTH - 32 - 16) / 3;

/**
 * Zero-alpha version of a hex colour. A literal 'transparent' stop interpolates
 * through transparent *black*, which shows as a grey band on Android — fading
 * to the background's own colour at 0 alpha keeps it clean.
 */
const fadeOut = (hex: string): string => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0)`;
};

/** Time / repeats block beside the date badge. */
function InfoTile({ icon: Icon, label, value, large }: { icon: any; label: string; value?: string | null; large?: boolean }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={{ flexShrink: 1 }}>
      <View style={styles.tileHead}>
        <Icon size={11} color={colors.grey} />
        <Text style={[styles.tileLabel, { color: colors.grey }]}>{label}</Text>
      </View>
      <Text
        style={[large ? styles.tileValueLarge : styles.tileValue, { color: colors.fg }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The event detail content, shared by the slide-up sheet and the /event route.
 * Scroll and any surrounding chrome belong to the caller.
 *
 * `topInset` pushes the category badge clear of a floating header; the sheet
 * has its own header bar and passes nothing.
 */
export function EventDetailBody({
  eventId,
  occurrenceDate: clickedDate,
  topInset = 12,
  onNavigateAway,
}: {
  eventId: string;
  occurrenceDate?: string;
  topInset?: number;
  onNavigateAway?: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [deleteEvent] = useDeleteSocietyEventMutation();

  const { data: event, isLoading } = useGetSocietyEventQuery(eventId);
  const { data: interestedData } = useGetEventInterestedUsersQuery(eventId);
  const { data: taggedData } = useGetEventTaggedPostsQuery(eventId);

  if (isLoading || !event) return <Spinner />;

  const category = categoryFor(event.category);
  const hero = firstGalleryUrl(event.gallery);
  // The occurrence that was tapped, else the event's own next date.
  const shownDate = clickedDate || occurrenceDate(event);
  const interested = interestedData?.entries ?? [];
  // Server returns these newest-first; a slider only wants the recent handful.
  const taggedPosts = (taggedData?.entries ?? []).slice(0, 10);
  const headerPad = topInset;
  const isOwner =
    !!userInfo && (userInfo.user_id === event.user_id || userInfo.accountType === 'admin');

  const handleOptions = () => {
    Alert.alert(event.title ?? 'Event', undefined, [
      {
        text: 'Edit event',
        onPress: () => {
          onNavigateAway?.();
          (nav as any).navigate('SocietyEventCreate', { eventId });
        },
      },
      {
        text: 'Delete event',
        style: 'destructive',
        onPress: () => Alert.alert('Delete event', "This can't be undone.", [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteEvent(eventId).unwrap();
                onNavigateAway?.();
              } catch {
                Alert.alert('Error', 'Could not delete this event.');
              }
            },
          },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Leaving for another screen closes whatever surface this is inside.
  const go = (screen: string, params: object) => {
    onNavigateAway?.();
    (nav as any).navigate(screen, params);
  };

  const openMap = () => {
    const query = event.location_lat && event.location_lng
      ? `${event.location_lat},${event.location_lng}`
      : encodeURIComponent(event.location ?? '');
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  };

  return (
    <>
      {/* Hero */}
      <View style={styles.hero}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} />
        {/* Lower edge dissolves into the page so the title sits on solid colour. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', fadeOut(colors.cream), colors.cream]}
          locations={[0, 0.3, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[styles.categoryBadge, { backgroundColor: category.color, top: headerPad }]}>
          <Text style={styles.categoryText}>{category.label}</Text>
        </View>

        {isOwner && (
          <TouchableOpacity
            style={[styles.optionsBtn, { top: headerPad }]}
            onPress={handleOptions}
            hitSlop={8}
            accessibilityLabel="Event options"
          >
            <MoreHorizontal size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <Text style={[styles.heroTitle, { color: colors.fg }]} numberOfLines={3}>{event.title}</Text>
      </View>

      {/* Sponsorship banner — under the title, so it frames the event rather
          than reading as one more attribute of it. */}
      {event.ors_sponsored && (
        <View style={[styles.orsBanner, { backgroundColor: ORS_EVENT_COLOR }]}>
          <CheckeredFlag size={14} color="#000000" />
          <Text style={styles.orsBannerText}>ORS Sponsored Event</Text>
        </View>
      )}

      <View style={styles.tiles}>
        <EventDateBadge date={shownDate} />
        <InfoTile icon={Clock} label="Time" value={formatTime(event.start_time)} large />
        {event.frequency !== 'single' && (
          <InfoTile icon={Repeat} label="Repeats" value={event.schedule_label} />
        )}
      </View>

      {shownDate ? (
        <TouchableOpacity
          style={[styles.calendarBtn, { backgroundColor: colors.card }]}
          onPress={() => {
            const url = googleCalendarUrl(event, shownDate);
            if (url) Linking.openURL(url);
          }}
          activeOpacity={0.85}
        >
          <CalendarPlus size={15} color={colors.fg} />
          <Text style={[styles.calendarBtnText, { color: colors.fg }]}>Add to Calendar</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.section}>
        {event.event_organizer ? (
          <Text style={[styles.quiet, { color: colors.grey }]}>
            Organized by {event.event_organizer}
          </Text>
        ) : null}

        {/* Description */}
        {event.body ? (
          <Text style={[styles.body, { color: colors.muted }]}>{stripHtml(event.body)}</Text>
        ) : null}

        {/* Who's interested */}
        {/* Who's interested — the avatars speak for themselves */}
        {interested.length === 0 ? null : (
          <View style={styles.avatarRow}>
            {interested.slice(0, 12).map((user) => (
              <TouchableOpacity
                key={user.user_id}
                onPress={() => go('UserDetail', { userId: user.user_id, username: user.username })}
              >
                <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={54} />
              </TouchableOpacity>
            ))}
            {(interestedData?.total ?? 0) > 12 && (
              <Text style={[styles.quiet, { color: colors.grey }]}>
                +{(interestedData?.total ?? 0) - 12}
              </Text>
            )}
          </View>
        )}

        {/* Location — a static map preview that opens the maps app */}
        {event.location ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Location</Text>
            <TouchableOpacity style={styles.locationRow} onPress={openMap} activeOpacity={0.8}>
              <MapPin size={14} color={colors.grey} />
              <Text style={[styles.locationText, { color: colors.fg }]}>{event.location}</Text>
            </TouchableOpacity>
            {event.location_lat && event.location_lng ? (
              <TouchableOpacity onPress={openMap} activeOpacity={0.9}>
                <Image
                  source={{
                    uri: `https://maps.googleapis.com/maps/api/staticmap?center=${event.location_lat},${event.location_lng}` +
                      `&zoom=14&size=640x320&scale=2&maptype=roadmap` +
                      `&markers=color:red%7C${event.location_lat},${event.location_lng}` +
                      `&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''}`,
                  }}
                  style={styles.map}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {/* Posts tagged with this event — most recent first, as a slider */}
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>Posts from this event</Text>
        {taggedPosts.length === 0 ? (
          <EmptyState title="No posts tagged yet" />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.postRow}
            // Negative margin lets the row bleed to the screen edge inside a
            // padded section, so the last card isn't cut off mid-gutter.
            style={styles.postRowOuter}
            snapToInterval={POST_TILE + 8}
            decelerationRate="fast"
          >
            {taggedPosts.map((post) => {
              const thumb = firstGalleryUrl(post.gallery);
              return (
                <TouchableOpacity
                  key={post.internal_id}
                  style={styles.postTile}
                  onPress={() => go('PostDetailModal', { postId: post.internal_id })}
                  activeOpacity={0.85}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.segment }]} />
                  )}
                </TouchableOpacity>
              );
            })}
            <RowEndSpacer width={16} />
          </ScrollView>
        )}

        {/* Comments — last, so the screen ends where the conversation is */}
        <View style={styles.comments}>
          <InlineComments documentId={eventId} entryType="society_event" />
        </View>
      </View>
    </>
  );
}

/** The Interested toggle — pinned by the caller, above the content. */
export function EventInterestBar({ eventId }: { eventId: string }) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: event } = useGetSocietyEventQuery(eventId);
  const [toggleInterest, { isLoading: toggling }] = useToggleEventInterestMutation();

  if (!event) return null;

  return (
    <TouchableOpacity
      style={[
        styles.interestBtn,
        event.is_interested ? { backgroundColor: brand } : { backgroundColor: colors.card },
        toggling && { opacity: 0.6 },
      ]}
      onPress={() => toggleInterest(eventId)}
      disabled={toggling}
      activeOpacity={0.85}
    >
      {toggling
        ? <ActivityIndicator size="small" color={event.is_interested ? '#000000' : colors.fg} />
        : event.is_interested ? <Check size={17} color="#000000" /> : <Plus size={17} color={colors.fg} />}
      <Text style={[styles.interestText, { color: event.is_interested ? '#000000' : colors.fg }]}>
        {event.is_interested ? 'Interested' : "I'm Interested"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 4 / 3, justifyContent: 'flex-end' },
  comments: { marginTop: 8, marginHorizontal: -16 },
  optionsBtn: {
    position: 'absolute', right: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute', left: 16,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  categoryText: {
    fontSize: 10, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800',
    paddingHorizontal: 16, paddingBottom: 10, letterSpacing: -0.5,
  },

  orsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 9, borderRadius: 10,
  },
  orsBannerText: {
    fontSize: 12, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  tiles: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, marginTop: 6 },

  tileHead:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 13, fontWeight: '800' },
  tileValueLarge: { fontSize: 20, fontWeight: '800' },

  calendarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 16, height: 44, borderRadius: 12,
  },
  calendarBtnText: { fontSize: 14, fontWeight: '800' },

  section: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  body:      { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  quiet:     { fontSize: 13, fontStyle: 'italic' },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },

  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationText: { fontSize: 14, flex: 1 },
  map: { width: '100%', height: 130, borderRadius: 12 },

  postRowOuter: { marginHorizontal: -16 },
  postRow:      { paddingLeft: 16, gap: 8 },
  postTile:     { width: POST_TILE, aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  interestBtn: {
    height: 50, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  interestText: { fontSize: 15, fontWeight: '800' },
});
