import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import { Navigation, CornerUpLeft, CornerUpRight, ArrowUp, Maximize2, PenLine } from 'lucide-react-native';
import RouteMap from '../../components/routes/RouteMap';
import RouteMapFullScreen from '../../components/routes/RouteMapFullScreen';
import VoteButton from '../../components/routes/VoteButton';
import RouteOwnerMenu from '../../components/routes/RouteOwnerMenu';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import LikeButton from '../../components/social/LikeButton';
import CommentButton from '../../components/social/CommentButton';
import CommentsSheet from '../../components/social/CommentsSheet';
import PostTagBadges from '../../components/social/PostTagBadges';
import GroupAttribution from '../../components/groups/GroupAttribution';
import { useGetRouteQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import {
  decodePolyline, formatDistance, formatDuration, formatSpeed, curvinessLabel,
} from '../../utils/routeGeometry';
import { openInMaps } from '../../utils/routeDirections';
import { format } from 'date-fns';
import type { RoutesStackParamList } from '../../navigation/types';
import { isPlottedRoute, type RoutePitStop } from '../../types/api';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type DetailRoute = RouteProp<RoutesStackParamList, 'RouteDetail'>;

/**
 * A single route: its shape on a map, the numbers behind it, who drove it and
 * in what, and what people made of it — the vote, likes and comments.
 */
export default function RouteDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  // Reached from the Routes tab and as a modal from anywhere else, so the
  // navigator isn't one known stack; RouteSave lives on the app stack above both.
  const navigation = useNavigation<any>();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const colors = useColors();
  // The map is the point of this screen, so it gets most of it — the numbers
  // and the vote read as something you scroll up to, over the top of it.
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const mapHeight = Math.round(screenH * 0.6);
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const { data, isLoading, isError, refetch } = useGetRouteQuery(params.routeId);
  const refreshControl = useRefreshControl(refetch);
  // Above the loading guard: a hook after an early return runs on some renders
  // and not others, which is the one thing hooks can't survive.
  const [fullMap, setFullMap] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  /**
   * The expand control fades out as the body climbs over the map, and stops
   * taking touches once it's gone. A boolean rather than a scroll offset, so
   * this re-renders twice a screen rather than sixty times a second — the fade
   * itself rides an Animated value on the native driver.
   */
  const [mapCovered, setMapCovered] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  if (isLoading) return <Spinner />;
  // Deleted, private, or never there — the API answers all three with a 404,
  // and a spinner that never ends is the wrong way to say so.
  if (isError || !data) {
    return (
      <View style={[ss.fill, { backgroundColor: colors.bg, justifyContent: 'center' }]}>
        <EmptyState title="Route not found" message="It may have been deleted, or made private." />
      </View>
    );
  }

  const { entry, user } = data;
  const stats = entry.stats;
  const path = entry.polyline ? decodePolyline(entry.polyline) : [];
  const isOwner = !!myId && myId === entry.user_id;
  const groupIds = entry.group_ids ?? [];

  const hasMap = path.length >= 2;

  return (
    /**
     * The map is pinned behind the page rather than scrolled with it.
     *
     * A route is a shape, and the shape is what you came to look at — so it
     * holds still while the description, the stats and the itinerary ride up
     * over it. The scroll view is transparent and opens with a spacer the
     * height of the map, which is what lets the map show through underneath
     * before anything has been scrolled.
     */
    <View style={[ss.fill, { backgroundColor: colors.bg }]}>
      {hasMap && (
        // Behind everything and taking no touches: the scroll view above owns
        // every gesture in this area, so a drag that starts on the map scrolls
        // the page instead of fighting it. The expand control is the way in to
        // a map you can actually pan.
        <View style={[styles.mapLayer, { height: mapHeight }]} pointerEvents="none">
          <RouteMap
            path={path}
            speeds={entry.speed_profile}
            markers={entry.pit_stops}
            color={brand}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <Animated.ScrollView
        refreshControl={refreshControl}
        style={ss.fill}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              const covered = e.nativeEvent.contentOffset.y > mapHeight * 0.45;
              setMapCovered((prev) => (prev === covered ? prev : covered));
            },
          },
        )}
      >
      {hasMap && (
        // Nothing in it — it exists so the body starts below the map, and so
        // the map behind is visible through it.
        <View style={{ height: mapHeight }} />
      )}

      <RouteMapFullScreen
        visible={fullMap}
        onClose={() => setFullMap(false)}
        path={path}
        speeds={entry.speed_profile}
        markers={entry.pit_stops}
        color={brand}
        title={entry.title}
      />

      {/* Rounded over the map it sits on, and pulled up far enough for the
          corners to actually show against it — a radius flush with the map's
          bottom edge would have nothing to round against. */}
      <View style={[
        styles.body,
        hasMap && styles.bodyOverMap,
        { backgroundColor: colors.bg },
      ]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]}>{entry.title || 'Untitled route'}</Text>
          {/* Only the creator gets Edit and Delete; the server checks again. */}
          {isOwner && (
            <RouteOwnerMenu
              routeId={entry.internal_id}
              color={colors.fg}
              onEdit={() => navigation.navigate('RouteSave', { routeId: entry.internal_id })}
              onDeleted={() => navigation.goBack()}
            />
          )}
        </View>

        {(entry.start_place || entry.end_place) && (
          <Text style={[styles.place, { color: colors.grey }]}>
            {[entry.start_place, entry.end_place].filter(Boolean).join(' → ')}
          </Text>
        )}

        {/* Who recorded it, who drove it, the car it was driven in and the
            events it was part of — the post badges, relabelled for a drive.
            The route's own car_id is folded in for routes saved before cars
            were tagged. Pulled out to the screen edge, since the badges bring
            their own inset. */}
        <View style={styles.tags}>
          <PostTagBadges
            postId={entry.internal_id}
            creatorId={user?.user_id ?? entry.user_id}
            extraCarIds={entry.car_id ? [entry.car_id] : undefined}
            labels={{ creator: 'Created By', users: 'Driven By', cars: 'Driven In', events: 'Events' }}
          />
        </View>

        <View style={styles.actionRow}>
        {/* Up, score, down — cast the way a group discussion vote is. */}
        <VoteButton
          routeId={entry.internal_id}
          score={data.vote_count ?? entry.vote_count ?? 0}
          userVote={data.user_vote ?? null}
          large
        />

        {/* Likes and comments ride the generic collections under the `route`
            type, which is what lets the server find the route's owner and tell
            them. */}
        <View style={[styles.socialPill, { borderColor: colors.border }]}>
          <LikeButton
            documentId={entry.internal_id}
            entryType="route"
            ownerId={entry.user_id}
            initialLiked={data.has_liked ?? false}
            initialCount={data.like_count ?? 0}
            color={colors.fg}
            size={19}
          />
          <CommentButton
            count={data.comment_count ?? 0}
            onPress={() => setCommentsOpen(true)}
            color={colors.fg}
          />
        </View>

        {/* Hands the route's corners to a maps app, which then does real
            turn-by-turn along the same roads. */}
        {path.length >= 2 && (
          <TouchableOpacity
            style={[styles.followBtn, { backgroundColor: brand }]}
            onPress={() => openInMaps(path)}
            activeOpacity={0.85}
          >
            <Navigation size={17} color={onBrand} />
            <Text style={[styles.followLabel, { color: onBrand }]}>Drive this route</Text>
          </TouchableOpacity>
        )}
        </View>

        {/* A plotted route's grid has no timed cells — there was nothing to
            time. In their place it says what it is, and when, if the member
            said. The numbers a route is sorted on stay honest that way. */}
        {stats && (isPlottedRoute(entry) ? (
          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            <GridStat label="Distance" value={formatDistance(stats.distance_meters)} colors={colors} />
            <GridStat
              label="Technical"
              value={`${curvinessLabel(stats.curviness)} (${stats.curviness})`}
              colors={colors}
            />
            <GridStat
              label="Driven"
              value={entry.driven_on ? format(new Date(entry.driven_on), 'MMM d, yyyy') : 'Plotted'}
              colors={colors}
            />
          </View>
        ) : (
          <View style={[styles.statsGrid, { borderColor: colors.border }]}>
            <GridStat label="Distance" value={formatDistance(stats.distance_meters)} colors={colors} />
            <GridStat label="Moving time" value={formatDuration(stats.moving_ms || stats.duration_ms)} colors={colors} />
            <GridStat label="Avg speed" value={formatSpeed(stats.avg_speed)} colors={colors} />
            <GridStat label="Top speed" value={formatSpeed(stats.max_speed)} colors={colors} />
            <GridStat
              label="Technical"
              value={`${curvinessLabel(stats.curviness)} (${stats.curviness})`}
              colors={colors}
            />
          </View>
        ))}

        {isPlottedRoute(entry) && (
          <View style={styles.plottedNote}>
            <PenLine size={13} color={colors.grey} />
            <Text style={[styles.meta, { color: colors.grey, flex: 1 }]}>
              Plotted on a map after the drive, not recorded live — the roads are right; there are no times or speeds.
            </Text>
          </View>
        )}

        {/* Surface is hidden alongside the picker on the save screen — every
            route is 'paved' by default, so printing it said nothing. The field
            is still stored; put the ` · ${entry.surface}` back when there are
            dirt drives worth telling apart. */}
        {entry.technical_rating ? (
          <Text style={[styles.meta, { color: colors.grey }]}>
            Driver rated it {entry.technical_rating}/5
          </Text>
        ) : null}

        {entry.body ? (
          <Text style={[styles.description, { color: colors.fg }]}>{entry.body}</Text>
        ) : null}

        <Itinerary
          startPlace={entry.start_place}
          endPlace={entry.end_place}
          stops={entry.pit_stops}
          colors={colors}
          brand={brand}
        />

        {/* The roads this drive followed. Resolved once when the route was
            saved and stored with it — reading them costs nothing. */}
        {entry.directions_status === 'ready' && entry.directions?.length ? (
          <View style={styles.directions}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>The route</Text>
            {entry.directions.map((step, i) => (
              <View key={`${step.road}-${i}`} style={[styles.step, { borderBottomColor: colors.border }]}>
                <TurnIcon turn={step.turn} color={brand} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepRoad, { color: colors.fg }]}>
                    {i === 0 ? 'Start on ' : turnPhrase(step.turn)}
                    <Text style={{ fontWeight: '800' }}>{step.road}</Text>
                  </Text>
                  <Text style={[styles.stepDistance, { color: colors.grey }]}>
                    {formatDistance(step.meters)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : entry.directions_status === 'pending' ? (
          <Text style={[styles.meta, { color: colors.grey }]}>Working out the roads…</Text>
        ) : null}

        {/* The groups it was shared into. Each is the same "posted in" banner
            a post carries, and goes through the group summary provider: a
            member lands on the group, anyone else gets its summary. */}
        {groupIds.length > 0 && (
          <View style={styles.groups}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Shared To</Text>
            <View style={styles.groupBanners}>
              {groupIds.map((groupId) => (
                <GroupAttribution key={groupId} groupId={groupId} />
              ))}
            </View>
          </View>
        )}
      </View>
      </Animated.ScrollView>

      {/* Outside the scroll view, so the sheet isn't clipped by the body panel.
          The count on the button is the server's, so it's refreshed on close. */}
      <CommentsSheet
        postId={entry.internal_id}
        entryType="route"
        visible={commentsOpen}
        onClose={() => {
          setCommentsOpen(false);
          refetch();
        }}
      />

      {/* Above the scroll view so it stays tappable over the map, and faded out
          by the time the body has climbed over the thing it expands. */}
      {hasMap && (
        <Animated.View
          style={[
            styles.expandBadge,
            {
              opacity: scrollY.interpolate({
                inputRange: [0, mapHeight * 0.45],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}
          pointerEvents={mapCovered ? 'none' : 'auto'}
        >
          <TouchableOpacity
            style={styles.expandHit}
            onPress={() => setFullMap(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open the route map full screen"
          >
            <Maximize2 size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

interface ItineraryRow {
  key: string;
  label: string;
  place: string;
  note?: string;
  kind: 'start' | 'stop' | 'end';
}

/**
 * The drive as a list of places: where it started, what it stopped for, where
 * it ended.
 *
 * The pieces were all on the screen already but scattered — the endpoints as a
 * "A → B" line under the title, the stops as a separate section further down —
 * so reading the shape of the day meant assembling it yourself. In order, with
 * a rail connecting the rows, it reads as one journey.
 *
 * Distinct from "The route" below it, which is the roads. This is the stops.
 */
function Itinerary({ startPlace, endPlace, stops, colors, brand }: {
  startPlace?: string;
  endPlace?: string;
  stops?: RoutePitStop[];
  colors: any;
  brand: string;
}) {
  const rows: ItineraryRow[] = [];

  if (startPlace?.trim()) {
    rows.push({ key: 'start', label: 'Start at', place: startPlace.trim(), kind: 'start' });
  }

  // `t` is milliseconds into the drive, so it's the true order when it's there.
  // Stops recorded before the field existed fall back to the order they were
  // saved in, which is the order they were dropped.
  const ordered = [...(stops ?? [])];
  if (ordered.length > 1 && ordered.every((st) => typeof st.t === 'number')) {
    ordered.sort((x, y) => (x.t as number) - (y.t as number));
  }
  ordered.forEach((stop, i) => {
    rows.push({
      key: `stop-${i}`,
      label: `Stop ${i + 1}`,
      place: stop.label?.trim() || 'Pit stop',
      note: stop.note?.trim() || undefined,
      kind: 'stop',
    });
  });

  if (endPlace?.trim()) {
    rows.push({ key: 'end', label: 'End at', place: endPlace.trim(), kind: 'end' });
  }

  // One line isn't an itinerary — the title and the map already say that much.
  if (rows.length < 2) return null;

  return (
    <View style={styles.directions}>
      <Text style={[styles.sectionTitle, { color: colors.fg }]}>Itinerary</Text>
      <View style={[styles.itinerary, { borderColor: colors.border }]}>
        {rows.map((row, i) => (
          <View key={row.key} style={styles.itinRow}>
            {/* The rail: a dot per stop, joined by a line that stops short of
                the last one so the list reads as ending rather than continuing. */}
            <View style={styles.itinRail}>
              <View style={[
                styles.itinDot,
                row.kind === 'stop'
                  ? { borderColor: brand, backgroundColor: colors.bg }
                  : { borderColor: brand, backgroundColor: brand },
              ]} />
              {i < rows.length - 1 && (
                <View style={[styles.itinLine, { backgroundColor: colors.border }]} />
              )}
            </View>

            <View style={styles.itinBody}>
              <Text style={[styles.itinLabel, { color: colors.grey }]}>{row.label}</Text>
              <Text style={[styles.itinPlace, { color: colors.fg }]}>{row.place}</Text>
              {row.note ? (
                <Text style={[styles.itinNote, { color: colors.grey }]}>{row.note}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Reads the turn as a sentence opener: "Turn right onto ", "Continue on ". */
function turnPhrase(turn?: string | null): string {
  if (!turn || turn === 'continue') return 'Continue on ';
  return `Turn ${turn} onto `;
}

function TurnIcon({ turn, color }: { turn?: string | null; color: string }) {
  if (!turn || turn === 'continue') return <ArrowUp size={17} color={color} />;
  return turn.includes('left')
    ? <CornerUpLeft size={17} color={color} />
    : <CornerUpRight size={17} color={color} />;
}

function GridStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.gridStat}>
      <Text style={[styles.gridValue, { color: colors.fg }]}>{value}</Text>
      <Text style={[styles.gridLabel, { color: colors.grey }]}>{label}</Text>
    </View>
  );
}

/** How far the body panel laps up over the bottom of the map. */
const BODY_OVERLAP = 22;
const BODY_RADIUS = 20;

const styles = StyleSheet.create({
  // The tab bar is hidden on this screen (see navigation/immersiveScreens), so
  // the only thing left to clear is the home indicator — the old fixed 140 was
  // sized for a bar that isn't there any more, and left a dead band under the
  // last section. Applied per-render from the safe-area inset.
  content: {},
  // Pinned behind the page, not scrolled with it.
  mapLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Top-right rather than bottom-right: the body climbs over the bottom of the
  // map, so anything down there is the first thing to be buried.
  expandBadge: {
    position: 'absolute', right: 12, top: 12,
    width: 36, height: 36, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  expandHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 16, gap: 12 },
  // Laps up over the bottom of the spacer, so the map behind shows through the
  // rounded corners rather than meeting them flush.
  bodyOverMap: {
    marginTop: -BODY_OVERLAP,
    borderTopLeftRadius: BODY_RADIUS,
    borderTopRightRadius: BODY_RADIUS,
    // Clears the rounded corners of the map showing through at the very top.
    paddingTop: 16 + BODY_OVERLAP / 2,
  },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  place: { fontSize: 14 },

  // The badges carry a 12 inset and a 16 top of their own, for sitting in a
  // full-width card; this cancels both so they line up with the body's gutter.
  tags: { marginHorizontal: -12, marginTop: -16 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  // Heart and comment in one outline the height of the vote pill beside it, so
  // the row reads as a set of controls rather than two icons floating loose.
  socialPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 42, paddingHorizontal: 10, borderRadius: COMMON_RADIUS, borderWidth: 1.5,
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, height: 42, borderRadius: COMMON_RADIUS,
  },
  followLabel: { fontSize: 15, fontWeight: '800' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 1, borderRadius: 12, padding: 4, marginTop: 4,
  },
  gridStat:  { width: '33.33%', paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  gridValue: { fontSize: 16, fontWeight: '800' },
  gridLabel: { fontSize: 11, marginTop: 2 },

  meta:        { fontSize: 13 },
  plottedNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 16, paddingTop: 10 },
  directions:   { marginTop: 8 },
  groups:       { marginTop: 8 },
  // The banners inset themselves 8 for a feed card's edge; the body already
  // has its gutter, so that's cancelled here.
  groupBanners: { marginHorizontal: -8, marginTop: -12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  step:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  stepRoad:     { fontSize: 14, lineHeight: 19 },
  stepDistance: { fontSize: 12, marginTop: 1 },
  description: { fontSize: 15, lineHeight: 22, marginTop: 4 },

  itinerary: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  itinRow:   { flexDirection: 'row', gap: 12 },
  // Fixed width so every label starts on the same line, and the dots stack into
  // a straight rail rather than following the text.
  itinRail:  { width: 14, alignItems: 'center', paddingTop: 14 },
  itinDot:   { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  // Fills whatever the row turned out to be — a stop with a note is taller.
  itinLine:  { flex: 1, width: 2, marginTop: 2, marginBottom: -2 },
  itinBody:  { flex: 1, paddingVertical: 10 },
  itinLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  itinPlace: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  itinNote:  { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
