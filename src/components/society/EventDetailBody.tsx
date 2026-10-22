import React, { useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Linking, Dimensions, Alert,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Repeat, MapPin, UserPlus, UserCheck, CalendarPlus, Settings, Pencil, Trash2 } from 'lucide-react-native';
import { useEventInterest } from './ExpandableEventCard';
import Avatar from '../ui/Avatar';
import ActionSheet from '../ui/ActionSheet';
import { PANE_GRABBER_H } from '../ui/SharedModal';
import CheckeredFlag from '../ui/CheckeredFlag';
import InlineComments from '../social/InlineComments';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import {
  useGetSocietyEventQuery,
  useGetEventInterestedUsersQuery,
  useGetEventTaggedPostsQuery,
  useDeleteSocietyEventMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { categoryFor, formatTime, occurrenceDate, toDayKey, ORS_EVENT_COLOR, isOrsEvent } from '../../constants/eventTypes';
import EventDateBadge from './EventDateBadge';
import EventImage from './EventImage';
import { googleCalendarUrl } from '../../utils/calendarLinks';
import { openInMaps } from '../../utils/openInMaps';
import RowEndSpacer from '../ui/RowEndSpacer';
import type { SocietyEvent, User } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS } from '../../constants/config';
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
function MembersAttending({ users, onPressUser }: {
  users: User[];
  onPressUser: (user: User) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.membersBlock}>
      <Text style={[styles.sectionTitle, styles.membersTitle, { color: colors.fg }]}>Members attending</Text>
      {users.length === 0 ? (
        <Text style={[styles.quiet, { color: colors.grey }]}>No one yet — be the first.</Text>
      ) : (
        <View style={styles.avatarRow}>
          {users.map((user) => (
            <TouchableOpacity
              key={user.user_id}
              onPress={() => onPressUser(user)}
              accessibilityLabel={user.username}
            >
              <Avatar user={user} size={44} />
            </TouchableOpacity>
          ))}
        </View>
      )}
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

      {/* A rule between the head and the when. */}
      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      <View style={styles.tiles}>
        <EventDateBadge date={shownDate} />
        <View style={styles.whenText}>
          {formatTime(event.start_time) ? (
            <Text style={[styles.timeText, { color: colors.fg }]} numberOfLines={1}>
              {formatTime(event.start_time)}
            </Text>
          ) : null}
          {/* How often, as on the cards: the icon in a dark circle, the words bold. */}
          {event.frequency !== 'single' && event.schedule_label ? (
            <View style={styles.repeatRow}>
              <View style={[styles.repeatDot, { backgroundColor: colors.bg }]}>
                <Repeat size={13} color={colors.fg} strokeWidth={2.4} />
              </View>
              <Text style={[styles.repeatText, { color: colors.fg }]} numberOfLines={2}>
                {event.schedule_label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>


      <View style={styles.section}>

        {/* Description */}
        {event.body ? (
          <Text style={[styles.body, { color: colors.muted }]}>{stripHtml(event.body)}</Text>
        ) : null}

        {/* Location — tap the address for the maps app */}
        {event.location ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Location</Text>
            <TouchableOpacity style={styles.locationRow} onPress={openMap} activeOpacity={0.8}>
              <MapPin size={14} color={colors.grey} />
              <Text style={[styles.locationText, { color: colors.fg }]}>{event.location}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Who's going on this date, close under where */}
        <MembersAttending
          users={interested}
          onPressUser={(user) => go('UserDetail', { userId: user.user_id, username: user.username })}
        />

        {/* Posts tagged with this event — most recent first, as a slider */}
        <Text style={[styles.sectionTitle, styles.postsTitle, { color: colors.fg }]}>Posts from this event</Text>
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

/**
 * The pane's foot, pinned by the caller below the content: Attend and Add to
 * Calendar, side by side as pills. Attend is for the date the pane was
 * opened on.
 */
export function EventInterestBar({ eventId, occurrenceDate: clickedDate }: {
  eventId: string;
  /** The occurrence being looked at — what Attend and Add to Calendar act on. */
  occurrenceDate?: string;
}) {
  const colors = useColors();
  const day = clickedDate ? toDayKey(clickedDate) : undefined;
  const { data: event } = useGetSocietyEventQuery({ id: eventId, day });
  if (!event) return null;
  return <EventFoot event={event} clickedDate={clickedDate} colors={colors} />;
}

function EventFoot({ event, clickedDate, colors }: {
  event: SocietyEvent;
  clickedDate?: string;
  colors: ReturnType<typeof useColors>;
}) {
  const brand = useBrandColor();
  const shownDate = clickedDate || occurrenceDate(event);
  const { interested, onToggle, busy } = useEventInterest(event, shownDate);

  return (
    <View style={styles.footRow}>
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
          <Text style={[styles.footText, { color: colors.fg }]}>Add to Calendar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  comments: { marginTop: 8, marginHorizontal: -16 },
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

  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginTop: 18 },
  tiles: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, marginTop: 16 },
  whenText: { flex: 1, minWidth: 0, gap: 8 },
  // One line, AM/PM and all.
  timeText: { fontSize: 17, fontFamily: FONT_INTER.bold },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repeatDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  repeatText: { flexShrink: 1, fontSize: 13.5, fontFamily: FONT_INTER.bold },



  section: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  body:      { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontFamily: FONT_INTER.bold, marginTop: 10 },
  // A step down from the location; a clear break before the posts.
  membersBlock: { gap: 10, marginTop: 10 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quiet: { fontSize: 13, fontStyle: 'italic' },
  membersTitle: { marginTop: 0 },
  postsTitle: { marginTop: 22 },

  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationText: { fontSize: 14, flex: 1 },

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
