import React, { useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Linking, Dimensions, Alert, Platform,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import { Repeat, MapPin, UserPlus, UserCheck, CalendarPlus, Settings, Pencil, Trash2, CalendarDays, Navigation } from 'lucide-react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { format } from 'date-fns';
import { calendarDate } from '../../utils/calendarDate';
import { useEventInterest, BringingRow } from './ExpandableEventCard';
import { AttendeeCarBadge } from '../cards/EventCard';
import { carName } from './AttendCarSheet';
import Avatar from '../ui/Avatar';
import ActionSheet from '../ui/ActionSheet';
import { PANE_GRABBER_H } from '../ui/SharedModal';
import CheckeredFlag from '../ui/CheckeredFlag';
import InlineComments from '../social/InlineComments';
import Spinner from '../ui/Spinner';
import {
  useGetSocietyEventQuery,
  useGetEventInterestedUsersQuery,
  useGetEventTaggedPostsQuery,
  useDeleteSocietyEventMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl, carHeroUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { categoryFor, formatTime, occurrenceDate, toDayKey, ORS_EVENT_COLOR, isOrsEvent } from '../../constants/eventTypes';
import EventImage from './EventImage';
import { googleCalendarUrl } from '../../utils/calendarLinks';
import { openInMaps } from '../../utils/openInMaps';
import RowEndSpacer from '../ui/RowEndSpacer';
import type { SocietyEvent, User, EventAttendee } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS, PANE_BG } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Three tiles across the padded section, so a fourth peeks from the slider.
const POST_TILE = (SCREEN_WIDTH - 32 - 16) / 3;
/** The poster's width in the head, beside the title. */
const HEAD_PHOTO_W = 112;


/**
 * Members attending this date — every face, wrapping, each to its profile.
 * The Attend button is in the pane's foot.
 */
function MembersAttending({ users, onPressUser, onPressCar }: {
  users: EventAttendee[];
  onPressUser: (user: User) => void;
  onPressCar: (carId: string) => void;
}) {
  const colors = useColors();
  const withCars = users.filter((u) => u.car);
  return (
    <View style={styles.membersBlock}>
      <Text style={styles.sectionTitle}>Members attending</Text>
      {/* Only shown with someone in it — see the caller. */}
      {(
        <View style={styles.avatarRow}>
          {users.map((user) => (
            <TouchableOpacity
              key={user.user_id}
              onPress={() => onPressUser(user)}
              accessibilityLabel={user.car ? `${user.username}, bringing ${user.car.title ?? 'a car'}` : user.username}
            >
              <Avatar user={user} size={44} />
              <AttendeeCarBadge attendee={user} size={44} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* The cars coming — each with whose it is, each to its own page. */}
      {withCars.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, styles.carsTitle]}>Cars coming</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carsRow}>
            {withCars.map((user) => {
              const car = user.car!;
              const uri = carHeroUrl(car, 'thumb');
              return (
                <TouchableOpacity
                  key={`${user.user_id}_${car.internal_id}`}
                  style={[styles.carTile, { backgroundColor: colors.card }]}
                  onPress={() => onPressCar(car.internal_id)}
                  activeOpacity={0.85}
                  accessibilityLabel={`${carName(car)}, brought by ${user.username}`}
                >
                  {uri
                    ? <Image source={{ uri }} style={styles.carTileImage} contentFit="cover" />
                    : <View style={[styles.carTileImage, { backgroundColor: colors.secondary }]} />}
                  <View style={styles.carTileBody}>
                    <Text style={[styles.carTileTitle, { color: colors.fg }]} numberOfLines={1}>{carName(car)}</Text>
                    <View style={styles.carTileOwner}>
                      <Avatar user={user} size={16} />
                      <Text style={[styles.carTileUser, { color: colors.grey }]} numberOfLines={1}>{user.username}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

/** Your own car for this date, with the way to change it — only once you're going. */
function MyBringing({ event, shownDate }: { event: SocietyEvent; shownDate?: string | null }) {
  const { interested, myCar, canChooseCar, changeCar, sheet } = useEventInterest(event, shownDate);
  if (!interested) return null;
  return (
    <View style={styles.myBringing}>
      <BringingRow myCar={myCar} canChooseCar={canChooseCar} onChange={changeCar} />
      {sheet}
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
  fullBleed = false,
}: {
  eventId: string;
  occurrenceDate?: string;
  topInset?: number;
  /**
   * In the pane, which has no title row of its own (the title is in the
   * head): start just under its floating grabber.
   */
  fullBleed?: boolean;
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
  /** The owner's cog menu. */
  const [menuOpen, setMenuOpen] = useState(false);

  // Answered for the date it was opened on — attending is per occurrence.
  const day = clickedDate ? toDayKey(clickedDate) : undefined;
  const { data: event, isLoading } = useGetSocietyEventQuery({ id: eventId, day });
  const { data: interestedData } = useGetEventInterestedUsersQuery({ id: eventId, day });
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
  const canEdit = isOwner || (!!userInfo && userInfo.user_id === (event as any).coowner_id);

  const onEdit = () => {
    onNavigateAway?.();
    (nav as any).navigate('SocietyEventCreate', { eventId });
  };
  const onDelete = () => Alert.alert('Delete event', "This can't be undone.", [
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
  ]);

  // Leaving for another screen closes whatever surface this is inside.
  const go = (screen: string, params: object) => {
    onNavigateAway?.();
    (nav as any).navigate(screen, params);
  };

  const openMap = () => openInMaps(event);

  // The facts card's lines.
  const when = calendarDate(shownDate);
  const start = formatTime(event.start_time);
  const finish = formatTime(event.end_time);
  const timeLine = start ? (finish ? `${start} – ${finish}` : start) : null;
  // "Venue, 1 Main St, Portland, OR" → the venue (or street) leads, the rest under it.
  const place = (() => {
    const parts = (event.location ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    while (parts.length > 1 && /^(usa|us|united states)$/i.test(parts[parts.length - 1])) parts.pop();
    return { name: parts[0] ?? '', rest: parts.slice(1).join(', ') };
  })();
  const hasPoint = typeof event.location_lat === 'number' && typeof event.location_lng === 'number';
  const mapCamera = {
    coordinates: { latitude: event.location_lat as number, longitude: event.location_lng as number },
    zoom: 14,
  };

  return (
    <>
      {/* Your own event's controls — a cog in the pane's top right, opening
          the same kind of menu as every other cog: edit, and (the owner's
          alone — a co-owner who can edit can't remove it) delete. */}
      {canEdit && (
        <>
          <TouchableOpacity
            style={[styles.cog, { top: fullBleed ? 10 : headerPad }]}
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Event options"
          >
            <Settings size={19} color={COLOR_WHITE} strokeWidth={2.2} />
          </TouchableOpacity>
          <ActionSheet
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            title="Your event"
            options={[
              { label: 'Edit event', Icon: Pencil, onPress: onEdit },
              ...(isOwner ? [{ label: 'Delete event', Icon: Trash2, destructive: true, onPress: onDelete }] : []),
            ]}
          />
        </>
      )}

      {/* The head, laid out like the event cards: the poster small and
          rounded on the left (none at all when there isn't one), the category,
          the options and the title beside it. */}
      <View style={[styles.head, { marginTop: fullBleed ? PANE_GRABBER_H + 16 : headerPad + 12 }]}>
        {hero ? (
          <View
            style={[
              styles.headPhoto,
              // Its own shape, kept between a short landscape and a square-ish portrait.
              { height: HEAD_PHOTO_W / Math.min(Math.max(heroRatio, 0.8), 1.6), backgroundColor: colors.segment },
            ]}
          >
            <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={setHeroRatio} />
          </View>
        ) : null}
        <View style={styles.headText}>
          <View style={styles.headTop}>
            <View style={[styles.categoryInline, { backgroundColor: category.color }]}>
              <Text style={styles.categoryText}>{category.label}</Text>
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: COLOR_WHITE }]} numberOfLines={4}>{event.title}</Text>
        </View>
      </View>

      {/* Sponsorship banner — under the title, so it frames the event rather
          than reading as one more attribute of it. */}
      {isOrsEvent(event) && (
        <View style={[styles.orsBanner, { backgroundColor: ORS_EVENT_COLOR }]}>
          <CheckeredFlag size={14} color={COLOR_BLACK} />
          <Text style={styles.orsBannerText}>
            {event.ors_sponsored ? 'ORS Sponsored Event' : 'ORS will be attending'}
          </Text>
        </View>
      )}

      {/* The facts, together on one card: when, how often, where — each a
          row with its icon in the same column, the map under the address. */}
      <View style={styles.infoCard}>
        {when ? (
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}><CalendarDays size={17} color={COLOR_WHITE} strokeWidth={2.2} /></View>
            <View style={styles.infoText}>
              <Text style={styles.infoMain}>{format(when, 'EEEE, MMMM d')}</Text>
              {timeLine ? <Text style={styles.infoSub}>{timeLine}</Text> : null}
            </View>
          </View>
        ) : null}

        {event.frequency !== 'single' && event.schedule_label ? (
          <>
            {when ? <View style={styles.infoDivider} /> : null}
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}><Repeat size={16} color={COLOR_WHITE} strokeWidth={2.2} /></View>
              <View style={styles.infoText}>
                <Text style={styles.infoMain}>{event.schedule_label}</Text>
              </View>
            </View>
          </>
        ) : null}

        {event.location ? (
          <>
            {(when || event.schedule_label) ? <View style={styles.infoDivider} /> : null}
            <TouchableOpacity style={styles.infoRow} onPress={openMap} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Directions to ${event.location}`}>
              <View style={styles.infoIcon}><MapPin size={17} color={COLOR_WHITE} strokeWidth={2.2} /></View>
              <View style={styles.infoText}>
                <Text style={styles.infoMain} numberOfLines={2}>{place.name}</Text>
                {place.rest ? <Text style={styles.infoSub} numberOfLines={2}>{place.rest}</Text> : null}
              </View>
              <View style={styles.directions}>
                <Navigation size={13} color={COLOR_WHITE} strokeWidth={2.4} />
                <Text style={styles.directionsText}>Directions</Text>
              </View>
            </TouchableOpacity>
            {hasPoint ? (
              // A still picture of the spot — touches pass to the press over
              // it, which opens the maps app, rather than panning a map that
              // sits inside a scrolling pane.
              <TouchableOpacity style={styles.mapEmbed} onPress={openMap} activeOpacity={0.9} accessibilityLabel="Open in Maps">
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  {Platform.OS === 'ios' ? (
                    <AppleMaps.View
                      style={StyleSheet.absoluteFill}
                      cameraPosition={mapCamera}
                      markers={[{ id: 'event', coordinates: mapCamera.coordinates, systemImage: 'calendar', tintColor: category.color }] as any}
                      uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false, togglePitchEnabled: false }}
                    />
                  ) : (
                    <GoogleMaps.View
                      style={StyleSheet.absoluteFill}
                      cameraPosition={mapCamera}
                      markers={[{ id: 'event', coordinates: mapCamera.coordinates }] as any}
                      uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false, scrollGesturesEnabled: false, zoomGesturesEnabled: false, rotationGesturesEnabled: false, tiltGesturesEnabled: false, compassEnabled: false, myLocationButtonEnabled: false }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={styles.section}>

        {/* What it is — readable copy, not small print. */}
        {event.body ? (
          <View style={styles.block}>
            <Text style={styles.body}>{stripHtml(event.body)}</Text>
          </View>
        ) : null}

        {/* Who's going on this date, close under where — and what they're bringing. */}
        {/* A section only when there's someone in it — likewise the posts. */}
        {interested.length > 0 && (
        <View style={styles.block}>
        <MyBringing event={event} shownDate={shownDate} />
        <MembersAttending
          users={interested}
          onPressUser={(user) => go('UserDetail', { userId: user.user_id, username: user.username })}
          onPressCar={(carId) => go('CarDetail', { carId })}
        />
        </View>
        )}

        {/* Posts tagged with this event — most recent first, as a slider */}
        {taggedPosts.length > 0 && (
        <View style={styles.block}>
        <Text style={styles.sectionTitle}>Posts from this event</Text>
        {(
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
              const thumb = firstGalleryUrl(post.gallery, 'small');
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
        </View>
        )}

        {/* Comments — last, so the screen ends where the conversation is */}
        <View style={styles.comments}>
          <InlineComments
            documentId={eventId}
            entryType="society_event"
            // No rule above, and the pane's own ground rather than the page's.
            bare
            backgroundColor={fullBleed ? PANE_BG : undefined}
          />
        </View>
      </View>
    </>
  );
}

/**
 * The pane's foot, pinned by the caller below the content: Attend and Add to
 * Calendar, side by side as pills. Attend is for the date the pane was
 * opened on.
 */
export function EventInterestBar({ eventId, occurrenceDate: clickedDate, calendarLabel, after }: {
  eventId: string;
  /** The occurrence being looked at — what Attend and Add to Calendar act on. */
  occurrenceDate?: string;
  /** The calendar pill's words, in place of "Add to Calendar" — "Add" where three share the row. */
  calendarLabel?: string;
  /** More pills at the end of the row — an EventPill each. */
  after?: React.ReactNode;
}) {
  const colors = useColors();
  const day = clickedDate ? toDayKey(clickedDate) : undefined;
  const { data: event } = useGetSocietyEventQuery({ id: eventId, day });
  if (!event) return null;
  return <EventFoot event={event} clickedDate={clickedDate} colors={colors} calendarLabel={calendarLabel} after={after} />;
}

/** A pill in the event's foot row, dressed like Attend and Add to Calendar. */
export function EventPill({ Icon, label, accessibilityLabel, onPress }: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  /** What a screen reader says, when the label alone is too terse. */
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.footPill, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Icon size={16} color={colors.fg} strokeWidth={2.4} />
      <Text style={[styles.footText, { color: colors.fg }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Just the row of pills, for a host with no Attend to offer — see EventSummaryModal. */
export function EventPillRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.footRow}>{children}</View>;
}

function EventFoot({ event, clickedDate, colors, calendarLabel = 'Add to Calendar', after }: {
  event: SocietyEvent;
  clickedDate?: string;
  colors: ReturnType<typeof useColors>;
  calendarLabel?: string;
  after?: React.ReactNode;
}) {
  const brand = useBrandColor();
  const shownDate = clickedDate || occurrenceDate(event);
  const { interested, onToggle, busy, sheet } = useEventInterest(event, shownDate);

  return (
    <View style={styles.footRow}>
      {sheet}
      <TouchableOpacity
        style={[
          styles.footPill,
          { backgroundColor: interested ? brand : colors.card },
          busy && { opacity: 0.6 },
        ]}
        onPress={onToggle}
        disabled={busy}
        activeOpacity={0.85}
        accessibilityState={{ selected: interested }}
      >
        {interested
          ? <UserCheck size={17} color={COLOR_BLACK} strokeWidth={2.6} />
          : <UserPlus size={17} color={colors.fg} strokeWidth={2.6} />}
        <Text style={[styles.footText, { color: interested ? COLOR_BLACK : colors.fg }]}>
          {interested ? 'Attending' : 'Attend'}
        </Text>
      </TouchableOpacity>
      {shownDate ? (
        <TouchableOpacity
          style={[styles.footPill, { backgroundColor: colors.card }]}
          onPress={() => {
            const url = googleCalendarUrl(event, shownDate);
            if (url) Linking.openURL(url);
          }}
          activeOpacity={0.85}
        >
          <CalendarPlus size={16} color={colors.fg} />
          <Text style={[styles.footText, { color: colors.fg }]}>{calendarLabel}</Text>
        </TouchableOpacity>
      ) : null}
      {after}
    </View>
  );
}

const styles = StyleSheet.create({
  myBringing: {},
  carsRow: { gap: 10, paddingRight: 16 },
  carTile: { width: 150, borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  carTileImage: { width: 150, height: 96 },
  carTileBody: { padding: 8, gap: 4 },
  carTileTitle: { fontSize: 13, fontFamily: FONT_INTER.bold },
  carTileOwner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  carTileUser: { flex: 1, fontSize: 12, fontFamily: FONT_INTER.semibold },
  // marginTop is set inline — clearance for the grabber, or a floating header.
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 16 },
  headPhoto: { width: HEAD_PHOTO_W, borderRadius: 12, overflow: 'hidden' },
  headText: { flex: 1, minWidth: 0, gap: 6 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryInline: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  // Over the pane's top-right corner, clear of the grabber in the middle.
  cog: {
    position: 'absolute', right: 12, zIndex: 4,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  comments: { marginTop: 26, marginHorizontal: -16 },
  categoryText: {
    fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK,
  },
  heroTitle: { fontSize: 21, lineHeight: 25, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },

  orsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, paddingVertical: 9, borderRadius: 10,
  },
  orsBannerText: {
    fontSize: 12, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // The facts card: rows of icon + words, hairlines between, the map at its foot.
  infoCard: {
    marginHorizontal: 16, marginTop: 20, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoIcon: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoText: { flex: 1, minWidth: 0, gap: 2 },
  infoMain: { fontSize: 15, lineHeight: 20, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  infoSub: { fontSize: 13.5, lineHeight: 18, fontFamily: FONT_INTER.medium, color: 'rgba(255,255,255,0.72)' },
  // Lines up with the words, not the icons.
  infoDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: 14 + 34 + 12 },
  directions: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  directionsText: { fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  mapEmbed: { height: 150, marginHorizontal: 10, marginBottom: 10, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },

  // Every section the same distance from the last, its heading the same
  // distance from what it heads.
  section: { paddingHorizontal: 16, paddingTop: 4 },
  block: { marginTop: 26, gap: 10 },
  body:      { fontSize: 15, lineHeight: 23, color: 'rgba(255,255,255,0.88)' },
  sectionTitle: { fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  membersBlock: { gap: 10 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carsTitle: { marginTop: 16 },

  postRowOuter: { marginHorizontal: -16 },
  postRow:      { paddingLeft: 16, gap: 8 },
  postTile:     { width: POST_TILE, aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  footRow: { flexDirection: 'row', gap: 8 },
  footPill: {
    flex: 1, height: 48, borderRadius: PILL_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  footText: { fontSize: 14.5, fontFamily: FONT_INTER.extrabold },
});
