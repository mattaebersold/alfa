import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Mountain, Route as RouteIcon } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import RouteTrace from '../routes/RouteTrace';
import VoteButton from '../routes/VoteButton';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import {
  formatDistance, formatDuration, formatElevation, curvinessLabel,
} from '../../utils/routeGeometry';
import type { DrivingRoute } from '../../types/api';

/**
 * A recorded drive in the feed.
 *
 * The hero is the route's own shape rather than a photo — it's the one thing
 * every route has, and it reads at a glance in a way a map screenshot of an
 * unfamiliar area does not.
 */
export default function RouteCard({ route }: { route: DrivingRoute }) {
  const colors = useColors();
  const brand = useBrandColor();
  const navigation = useNavigation<any>();

  const { data: user } = useGetUserByIdQuery(route.user_id, { skip: !route.user_id });
  const stats = route.stats;

  const timeAgo = route.created_at
    ? formatDistanceToNow(new Date(route.created_at), { addSuffix: true })
    : '';

  const open = () => navigation.navigate('RouteDetailModal', { routeId: route.internal_id });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={open}
      activeOpacity={0.95}
    >
      <View style={styles.header}>
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
        <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
      </View>

      <View style={styles.traceRow}>
        {/* The trace on its own darker ground, so the line reads as a picture
            of a route rather than as marks floating on the card. */}
        <View style={styles.traceWell}>
          <RouteTrace polyline={route.polyline} speeds={route.speed_profile} color={brand} style={styles.trace} />
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

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <VoteButton routeId={route.internal_id} initialCount={route.vote_count ?? 0} />
      </View>
    </TouchableOpacity>
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
  headerText: { flex: 1 },
  author:     { fontSize: 14, fontWeight: '700' },
  kicker:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  kickerText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  time:       { fontSize: 11, fontStyle: 'italic' },

  traceRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 12, alignItems: 'center' },
  // Darker than the card it sits on, and rounded, so the trace is contained.
  traceWell: {
    width: 132, height: 132,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  trace:    { width: 124, height: 124 },
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    marginTop: 10, borderTopWidth: 1,
  },
});
