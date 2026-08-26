import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ThumbsUp, Navigation, CornerUpLeft, CornerUpRight, ArrowUp, MapPin, Maximize2 } from 'lucide-react-native';
import RouteMap from '../../components/routes/RouteMap';
import RouteMapFullScreen from '../../components/routes/RouteMapFullScreen';
import Spinner from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import LikersSheet from '../../components/social/LikersSheet';
import { useGetRouteQuery, useVoteRouteMutation, useUnvoteRouteMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import {
  decodePolyline, formatDistance, formatDuration, formatSpeed, curvinessLabel,
} from '../../utils/routeGeometry';
import { openInMaps } from '../../utils/routeDirections';
import type { RoutesStackParamList } from '../../navigation/types';
import { useRefreshControl } from '../../hooks/useRefreshControl';

type DetailRoute = RouteProp<RoutesStackParamList, 'RouteDetail'>;

/**
 * A single route: its shape on a map, the numbers behind it, and the vote.
 */
export default function RouteDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const { data, isLoading, refetch } = useGetRouteQuery(params.routeId);
  const refreshControl = useRefreshControl(refetch);
  const [vote] = useVoteRouteMutation();
  const [unvote] = useUnvoteRouteMutation();
  // Above the loading guard: a hook after an early return runs on some renders
  // and not others, which is the one thing hooks can't survive.
  const [fullMap, setFullMap] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);

  if (isLoading || !data) return <Spinner />;

  const { entry, user, vote_count, has_voted } = data;
  const stats = entry.stats;
  const path = entry.polyline ? decodePolyline(entry.polyline) : [];

  const toggleVote = () => {
    (has_voted ? unvote : vote)(entry.internal_id);
  };

  return (
    <ScrollView refreshControl={refreshControl} style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      {path.length >= 2 && (
        // The inline map is a thumbnail of the drive — too small to read a
        // corner on. Tapping it opens the same route full screen, where the
        // gestures are the map's own rather than the page's.
        <TouchableOpacity
          style={styles.mapWrap}
          onPress={() => setFullMap(true)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Open the route map full screen"
        >
          {/* The map is a native view and swallows touches, so the wrapper —
              not the map — is what refuses them. The whole thumbnail is one
              button; panning happens full screen. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <RouteMap
              path={path}
              speeds={entry.speed_profile}
              markers={entry.pit_stops}
              color={brand}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.expandBadge}>
            <Maximize2 size={15} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      <LikersSheet
        entryId={entry.internal_id}
        visible={votersOpen}
        onClose={() => setVotersOpen(false)}
        title="Voted by"
        emptyText="No votes yet. Be the first!"
      />

      <RouteMapFullScreen
        visible={fullMap}
        onClose={() => setFullMap(false)}
        path={path}
        speeds={entry.speed_profile}
        markers={entry.pit_stops}
        color={brand}
        title={entry.title}
      />

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.fg }]}>{entry.title || 'Untitled route'}</Text>

        {(entry.start_place || entry.end_place) && (
          <Text style={[styles.place, { color: colors.grey }]}>
            {[entry.start_place, entry.end_place].filter(Boolean).join(' → ')}
          </Text>
        )}

        {user && (
          <View style={styles.author}>
            <Avatar
              user={user}
              size={30}
            />
            <Text style={[styles.authorName, { color: colors.fg }]}>@{user.username}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
        {/* One pill, two jobs. The thumb is the vote; the count is the list of
            who else cast one. Splitting them is what lets a tally you can read
            also be a tally you can open — as one target, seeing the voters
            would have meant voting for the route first. */}
        <View style={[
          styles.votePill,
          has_voted
            ? { backgroundColor: brand, borderColor: brand }
            : { borderColor: colors.border },
        ]}>
          <TouchableOpacity
            style={styles.voteToggle}
            onPress={toggleVote}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={has_voted ? 'Remove your vote' : 'Vote for this route'}
          >
            <ThumbsUp size={18} color={has_voted ? onBrand : colors.fg} strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={[
            styles.voteDivider,
            { backgroundColor: has_voted ? onBrand : colors.border },
          ]} />
          <TouchableOpacity
            style={styles.voteCount}
            onPress={() => setVotersOpen(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`See who voted — ${vote_count} ${vote_count === 1 ? 'vote' : 'votes'}`}
          >
            <Text style={[styles.voteLabel, { color: has_voted ? onBrand : colors.fg }]}>
              {vote_count} {vote_count === 1 ? 'vote' : 'votes'}
            </Text>
          </TouchableOpacity>
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

        {stats && (
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
        )}

        {entry.technical_rating ? (
          <Text style={[styles.meta, { color: colors.grey }]}>
            Driver rated it {entry.technical_rating}/5
            {entry.surface ? ` · ${entry.surface}` : ''}
          </Text>
        ) : null}

        {entry.body ? (
          <Text style={[styles.description, { color: colors.fg }]}>{entry.body}</Text>
        ) : null}

        {entry.pit_stops?.length ? (
          <View style={styles.directions}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Pit stops</Text>
            {entry.pit_stops.map((stop, i) => (
              <View key={i} style={[styles.step, { borderBottomColor: colors.border }]}>
                <MapPin size={16} color={brand} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepRoad, { color: colors.fg, fontWeight: '700' }]}>
                    {stop.label || 'Pit stop'}
                  </Text>
                  {stop.note ? (
                    <Text style={[styles.stepDistance, { color: colors.grey }]}>{stop.note}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

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
      </View>
    </ScrollView>
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

const styles = StyleSheet.create({
  // Deep enough that the last section clears the tab bar and the home
  // indicator with room to spare, rather than ending flush against them.
  content: { paddingBottom: 140 },
  // Bottom-right of the thumbnail, out of the way of the trace itself.
  expandBadge: {
    position: 'absolute', right: 12, bottom: 12,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapWrap: { height: 280, width: '100%' },
  body:    { padding: 16, gap: 12 },

  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  place: { fontSize: 14 },

  author:     { flexDirection: 'row', alignItems: 'center', gap: 9 },
  authorName: { fontSize: 14, fontWeight: '700' },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  votePill: {
    flexDirection: 'row', alignItems: 'center',
    height: 42, borderRadius: 100, borderWidth: 1.5,
    // The two halves supply their own padding, so the pill supplies none —
    // otherwise the divider ends up inset from the tap targets either side.
    overflow: 'hidden',
  },
  voteToggle: {
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 15, paddingRight: 12, height: '100%',
  },
  // Hairline rather than a full rule: it separates two halves of one control,
  // not two controls.
  voteDivider: { width: StyleSheet.hairlineWidth, height: 18, opacity: 0.5 },
  voteCount: {
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 12, paddingRight: 15, height: '100%',
  },
  voteLabel: { fontSize: 15, fontWeight: '800' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, height: 42, borderRadius: 100,
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
  directions:   { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  step:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  stepRoad:     { fontSize: 14, lineHeight: 19 },
  stepDistance: { fontSize: 12, marginTop: 1 },
  description: { fontSize: 15, lineHeight: 22, marginTop: 4 },
});
