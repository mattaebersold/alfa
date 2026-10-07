import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Lock, PenLine, Route as RouteIcon } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import RouteTrace from '../routes/RouteTrace';
import PostActionRail from '../social/PostActionRail';
import PostOptionsButton from '../social/PostOptionsButton';
import RouteOwnerMenu from '../routes/RouteOwnerMenu';
import { useAppSelector } from '../../store/store';
import LikersSheet from '../social/LikersSheet';
import { type SummaryOrigin } from '../ui/SummaryModal';
import { usePostLike } from '../../hooks/usePostLike';
import { useGetUserByIdQuery, useGetLikeUsersQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useCreateRoute } from '../../hooks/useCreateRoute';
import {
  formatDistance, formatDuration,
} from '../../utils/routeGeometry';
import { isPlottedRoute, type DrivingRoute, type Post } from '../../types/api';
import { routePhotoUrl } from '../../utils/routePhoto';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A recorded drive in the feed.
 *
 * The hero is the route's own shape rather than a photo — it's the one thing
 * every route has, and it reads at a glance in a way a map screenshot of an
 * unfamiliar area does not.
 *
 * Full-width by nature — it takes whatever its parent gives it. `compact`
 * narrows it enough to live in a sideways shelf (see RouteStrip) without a
 * second card existing to drift out of step with this one.
 */
export default function RouteCard({ route, compact = false, style, onPress }: {
  route: DrivingRoute;
  /**
   * Shelf sizing: a smaller trace well and no action bar. Voting and liking
   * inside a row that swipes sideways is a mis-tap waiting to happen, and the
   * card is a preview — the route itself is one tap away.
   */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Overrides opening the route, for hosts that must close a sheet first. */
  onPress?: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const navigation = useNavigation<any>();

  const { data: user } = useGetUserByIdQuery(route.user_id, { skip: !route.user_id });
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isMine = !!myId && myId === route.user_id;
  // The pitch for Pro, where making a route needs it. See useCreateRoute.
  const { upsell } = useCreateRoute();
  const { openUser } = useSummary();
  const stats = route.stats;
  // The driver's own photo, if they added one, goes behind the line.
  const photo = routePhotoUrl(route);

  // Likes, the way a post's work — the same heart, faces and count — under
  // the `route` type. The route list doesn't send who liked it, so the faces
  // are asked for, but only once there's someone to show.
  const [likeTouched, setLikeTouched] = useState(false);
  const { data: likeData } = useGetLikeUsersQuery(route.internal_id, {
    skip: !route.internal_id || (!(route.like_count ?? 0) && !likeTouched),
  });
  const like = usePostLike({
    postId: route.internal_id,
    entryType: 'route',
    ownerId: route.user_id,
    initialLiked: route.has_liked ?? false,
    initialCount: likeData?.total ?? route.like_count ?? 0,
    onToggle: () => setLikeTouched(true),
  });
  /** Non-null while the likers panel is open — and the rect it grows from. */
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  const timeAgo = route.created_at
    ? formatDistanceToNow(new Date(route.created_at), { addSuffix: true })
    : '';

  const open = onPress
    ?? (() => navigation.navigate('RouteDetailModal', { routeId: route.internal_id }));

  /**
   * Who can see this drive, when the answer isn't "anyone".
   *
   * A restricted route only ever reaches a list that asked for it — your own
   * profile, or a group's section — so wherever one turns up it needs saying
   * out loud, or a drive you can see reads as a drive everyone can see. Null
   * for a public route, which needs no label.
   */
  const reach = route.private
    ? 'Private'
    : (route.group_ids?.length && !route.also_public) ? 'Groups only'
    : null;

  return (
    <>
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }, style]}
      onPress={open}
      activeOpacity={0.95}
    >
      <View style={styles.header}>
        {/* The byline opens a summary rather than the card's own destination —
            same as every other feed card. Its own touchable, so tapping the
            person doesn't also open the route. */}
        <TouchableOpacity
          style={styles.headerWho}
          onPress={() => user?.user_id && openUser(user.user_id, null, userPreview(user))}
          disabled={!user?.user_id}
          activeOpacity={0.7}
        >
        <Avatar
          user={user}
          size={34}
        />
        <View style={styles.headerText}>
          <Text style={[styles.author, { color: colors.fg }]}>@{user?.username ?? 'Unknown'}</Text>
        </View>
        </TouchableOpacity>
        {/* Takes the byline's right-hand slot in place of the timestamp: in
            that much space a card can say when the drive was or who can see
            it, and "who can see it" is the one that matters. */}
        {reach ? (
          <View style={[styles.reachPill, { borderColor: colors.border }]}>
            <Lock size={10} color={colors.grey} />
            <Text style={[styles.reachPillText, { color: colors.grey }]}>{reach}</Text>
          </View>
        ) : (
          <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
        )}
        {/* The dots, as on a post: Edit and Delete on your own drive, the
            driver's profile on anyone else's. */}
        {isMine ? (
          <RouteOwnerMenu
            routeId={route.internal_id}
            size={18}
            color={colors.muted}
            vertical
            onEdit={() => navigation.navigate('RouteSave', { routeId: route.internal_id })}
          />
        ) : (
          <PostOptionsButton
            postId={route.internal_id}
            author={user}
            size={18}
            color={colors.muted}
            reportable={false}
            label="Route options"
          />
        )}
      </View>

      <View style={styles.traceRow}>
        {/* The trace on its own darker ground, so the line reads as a picture
            of a route rather than as marks floating on the card. */}
        <View style={[styles.traceWell, compact && styles.traceWellCompact]}>
          {/* The driver's photo behind the line, under a dark layer so the
              line still reads over whatever the picture is. */}
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              <View style={[StyleSheet.absoluteFill, styles.traceScrim]} />
            </>
          ) : null}
          <RouteTrace
            polyline={route.polyline}
            speeds={route.speed_profile}
            color={brand}
            style={compact ? styles.traceCompact : styles.trace}
          />
        </View>

        <View style={styles.info}>
          {/* What this is, over what it's called. */}
          <View style={styles.kicker}>
            <RouteIcon size={11} color={brand} />
            <Text style={[styles.kickerText, { color: brand }]}>drove a route</Text>
          </View>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
            {route.title || 'Untitled route'}
          </Text>

          {(route.start_place || route.end_place) && (
            <Text style={[styles.place, { color: colors.grey }]} numberOfLines={1}>
              {[route.start_place, route.end_place].filter(Boolean).join(' → ')}
            </Text>
          )}

          {stats && (
            <View style={styles.metrics}>
              <Metric value={formatDistance(stats.distance_meters)} colors={colors} />
              {/* A plotted route was never timed; it says so where the time would go. */}
              {isPlottedRoute(route)
                ? <Metric value="Plotted" colors={colors} Icon={PenLine} />
                : <Metric value={formatDuration(stats.moving_ms || stats.duration_ms)} colors={colors} />}
            </View>
          )}
        </View>
      </View>

      {/* Comment and like, right-aligned in a row of their own — the same
          footer as a post with no photo (the guess-the-car card). No votes:
          a like says the same thing with one control instead of two. */}
      {!compact && (
        <View style={styles.actions}>
          <PostActionRail
            // The rail reads a post's id and comment count; a route has both.
            post={{ internal_id: route.internal_id, comment_count: route.comment_count ?? 0 } as Post}
            entryType="route"
            like={like}
            likers={likeData?.users ?? []}
            onOpenLikers={(origin) => setLikersOrigin(origin)}
            vertical={false}
            bookmark={false}
          />
        </View>
      )}
    </TouchableOpacity>

      {upsell}

      <LikersSheet
        entryId={route.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />

    </>
  );
}

function Metric({ value, colors, Icon }: { value: string; colors: any; Icon?: any }) {
  return (
    <View style={styles.metric}>
      {Icon && <Icon size={11} color={colors.grey} />}
      <Text style={[styles.metricValue, { color: colors.fg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Rounded like the feed's post cards, and clipped so the action bar's rule
  // stops at the corners.
  card: { marginVertical: 6, paddingBottom: 4, borderRadius: COMMON_RADIUS, overflow: 'hidden' },

  header:     { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8, gap: 10 },
  headerWho:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  author:     { fontSize: 14, fontFamily: FONT_INTER.bold },
  kicker:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kickerText: { fontSize: 11, fontFamily: FONT_INTER.bold, letterSpacing: 0.2 },
  time:       { fontSize: 11, fontStyle: 'italic' },
  reachPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: PILL_RADIUS,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  reachPillText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.3, textTransform: 'uppercase' },

  traceRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 12, alignItems: 'center' },
  // Darker than the card it sits on, and rounded, so the trace is contained.
  traceWell: {
    width: 112, height: 112,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  // Small enough that the words beside it still get a readable column on a
  // shelf card, which is narrower than the feed.
  traceWellCompact: { width: 96, height: 96, borderRadius: 10 },
  // Between the photo and the line.
  traceScrim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  trace:        { width: 104, height: 104 },
  traceCompact: { width: 90, height: 90 },
  info:     { flex: 1, gap: 5 },

  title: { fontSize: 16, fontFamily: FONT_INTER.bold, letterSpacing: -0.2 },
  place: { fontSize: 12 },

  metrics:     { flexDirection: 'row', gap: 14, marginTop: 2 },
  metric:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 13, fontFamily: FONT_INTER.bold },

  // The create button on the left, like and comment on the right — the post
  // cards' footer row, no rule above.
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4,
  },
});
