import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
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
import { COMMON_RADIUS } from '../../constants/radius';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Three tiles across the padded section, so a fourth peeks from the slider.
const POST_TILE = (SCREEN_WIDTH - 32 - 16) / 3;

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
  /**
   * The poster's own shape, once it has decoded. 4:3 until then, and for the
   * stand-in, which has no shape of its own worth taking.
   */
  const [heroRatio, setHeroRatio] = useState(4 / 3);

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
  /**
   * Who gets the options menu, and what's in it.
   *
   * Mirrors horacio exactly, so nothing is offered that would come back 403:
   * `updateEntry` accepts the owner or the co-owner, `deleteEntry` accepts the
   * owner alone.
   *
   * The admin bypass that used to be here is gone. It's the reason an admin saw
   * an edit button on every event on the site — the server still honours it, so
   * moderation is unaffected, but it isn't something to put in front of someone
   * browsing the calendar.
   */
  const isOwner = !!userInfo && userInfo.user_id === event.user_id;
  /** The member who made it — not shown for the club's own (admin) events. */
  const organizer = event.user?.username && event.user.accountType !== 'admin' ? event.user : null;
  const canEdit = isOwner || (!!userInfo && userInfo.user_id === (event as any).coowner_id);

  const handleOptions = () => {
    Alert.alert(event.title ?? 'Event', undefined, [
      {
        text: 'Edit event',
        onPress: () => {
          onNavigateAway?.();
          (nav as any).navigate('SocietyEventCreate', { eventId });
        },
      },
      // Deleting is the owner's alone — a co-owner who can edit still can't
      // remove somebody else's event out from under them.
      ...(isOwner ? [{
        text: 'Delete event',
        style: 'destructive' as const,
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
      }] : []),
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
      {/* Hero — the poster whole, at its own shape, as a rounded card inset
          from the edges. It used to run edge to edge, cropped to 4:3 with
          the title laid over its lower half: a tall flyer lost its date and
          the title fought whatever was under it. Now the picture is the
          picture and the title sits beneath it on solid colour. */}
      <View
        style={[
          styles.hero,
          { aspectRatio: heroRatio, marginTop: headerPad, backgroundColor: colors.segment },
        ]}
      >
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={setHeroRatio} />
        <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
          <Text style={styles.categoryText}>{category.label}</Text>
        </View>

        {canEdit && (
          <TouchableOpacity
            style={styles.optionsBtn}
            onPress={handleOptions}
            hitSlop={8}
            accessibilityLabel="Event options"
          >
            <MoreHorizontal size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.heroTitle, { color: colors.fg }]} numberOfLines={3}>{event.title}</Text>

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
        {/* Who put this on, when it's a member rather than the club. An
            admin-made event is the society's own, and a face on it would read
            as one person's meet. Tapping goes to their profile. */}
        {organizer && (
          <TouchableOpacity
            style={styles.organizerRow}
            onPress={() => go('UserDetail', { userId: organizer.user_id, username: organizer.username })}
            activeOpacity={0.75}
          >
            <Avatar user={organizer} size={40} />
            <View style={styles.organizerText}>
              <Text style={[styles.organizerLabel, { color: colors.grey }]}>Organizer</Text>
              <Text style={[styles.organizerHandle, { color: colors.fg }]} numberOfLines={1}>
                @{organizer.username}
              </Text>
            </View>
          </TouchableOpacity>
        )}

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
                <Avatar user={user} size={54} />
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
  // aspectRatio and marginTop are set inline — the poster's own shape, and
  // clearance for a floating header on the screen route.
  hero: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  comments: { marginTop: 8, marginHorizontal: -16 },
  optionsBtn: {
    position: 'absolute', right: 10, top: 10,
    width: 36, height: 36, borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute', left: 10, top: 10,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  categoryText: {
    fontSize: 10, fontWeight: '800', color: '#000000',
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, letterSpacing: -0.5,
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
    marginHorizontal: 16, marginTop: 16, height: 44, borderRadius: COMMON_RADIUS,
  },
  calendarBtnText: { fontSize: 14, fontWeight: '800' },

  section: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  body:      { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  quiet:     { fontSize: 13, fontStyle: 'italic' },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  organizerText: { flexShrink: 1 },
  organizerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  organizerHandle: { fontSize: 15, fontWeight: '700', marginTop: 1 },

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
    height: 50, borderRadius: COMMON_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  interestText: { fontSize: 15, fontWeight: '800' },
});
