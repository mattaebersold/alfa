import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Lock, Mountain, Route as RouteIcon } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import UserSummaryModal from '../members/UserSummaryModal';
import RouteTrace from '../routes/RouteTrace';
import VoteButton from '../routes/VoteButton';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import CommentsSheet from '../social/CommentsSheet';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import {
  formatDistance, formatDuration, formatElevation, curvinessLabel,
} from '../../utils/routeGeometry';
import type { DrivingRoute } from '../../types/api';
import { PILL_RADIUS } from '../../constants/radius';

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
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const stats = route.stats;

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
          onPress={() => user?.user_id && setSummaryUserId(user.user_id)}
          disabled={!user?.user_id}
          activeOpacity={0.7}
        >
        <Avatar
          user={user}
          size={34}
        />
        <View style={styles.headerText}>
          <Text style={[styles.author, { color: colors.fg }]}>@{user?.username ?? 'Unknown'}</Text>
          <View style={styles.kicker}>
            <RouteIcon size={11} color={brand} />
            <Text style={[styles.kickerText, { color: brand }]}>drove a route</Text>
          </View>
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
      </View>

      <View style={styles.traceRow}>
        {/* The trace on its own darker ground, so the line reads as a picture
            of a route rather than as marks floating on the card. */}
        <View style={[styles.traceWell, compact && styles.traceWellCompact]}>
          <RouteTrace
            polyline={route.polyline}
            speeds={route.speed_profile}
            color={brand}
            style={compact ? styles.traceCompact : styles.trace}
          />
        </View>

        <View style={styles.info}>
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
              <Metric value={formatDuration(stats.moving_ms || stats.duration_ms)} colors={colors} />
              {stats.elevation_gain > 0 && (
                <Metric value={formatElevation(stats.elevation_gain)} colors={colors} Icon={Mountain} />
              )}
            </View>
          )}

          {stats && (
            <View style={[styles.technical, { borderColor: colors.border }]}>
              <Text style={[styles.technicalText, { color: colors.fg }]}>
                {curvinessLabel(stats.curviness)}
              </Text>
              <Text style={[styles.technicalIndex, { color: colors.grey }]}>{stats.curviness}/100</Text>
            </View>
          )}
        </View>
      </View>

      {!compact && (
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <VoteButton routeId={route.internal_id} score={route.vote_count ?? 0} userVote={route.user_vote ?? null} />
          {/* Likes and comments under the `route` type — the list endpoint sends
              the counts and whether you liked it, so nothing here fetches. */}
          <LikeButton
            documentId={route.internal_id}
            entryType="route"
            ownerId={route.user_id}
            initialLiked={route.has_liked ?? false}
            initialCount={route.like_count ?? 0}
          />
          <CommentButton count={route.comment_count ?? 0} onPress={() => setCommentsOpen(true)} />
        </View>
      )}
    </TouchableOpacity>

      <CommentsSheet
        postId={route.internal_id}
        entryType="route"
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />

      <UserSummaryModal
        userId={summaryUserId}
        onClose={() => setSummaryUserId(null)}
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
  card: { marginVertical: 6, paddingBottom: 4 },

  header:     { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 8, gap: 10 },
  headerWho:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  author:     { fontSize: 14, fontWeight: '700' },
  kicker:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  kickerText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  time:       { fontSize: 11, fontStyle: 'italic' },
  reachPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: PILL_RADIUS,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  reachPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },

  traceRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 12, alignItems: 'center' },
  // Darker than the card it sits on, and rounded, so the trace is contained.
  traceWell: {
    width: 132, height: 132,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  // Small enough that the words beside it still get a readable column on a
  // shelf card, which is narrower than the feed.
  traceWellCompact: { width: 96, height: 96, borderRadius: 10 },
  trace:        { width: 124, height: 124 },
  traceCompact: { width: 90, height: 90 },
  info:     { flex: 1, gap: 5 },

  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  place: { fontSize: 12 },

  metrics:     { flexDirection: 'row', gap: 14, marginTop: 2 },
  metric:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 13, fontWeight: '700' },

  technical:      {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 4,
    borderWidth: 1, borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  technicalText:  { fontSize: 12, fontWeight: '700' },
  technicalIndex: { fontSize: 11 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 10, borderTopWidth: 1,
  },
});
