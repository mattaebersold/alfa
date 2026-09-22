import React, { useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Heart, MessageCircle, PenLine } from 'lucide-react-native';
import { useGetRoutesQuery } from '../../api/apiService';
import RouteTrace from '../../components/routes/RouteTrace';
import VoteButton from '../../components/routes/VoteButton';
import RouteFilters, {
  DEFAULT_FILTERS, buildRouteQuery, type RouteFilterState,
} from '../../components/routes/RouteFilters';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import {
  formatDistance, formatDuration, curvinessLabel,
} from '../../utils/routeGeometry';
import type { RoutesStackParamList } from '../../navigation/types';
import { isPlottedRoute, type DrivingRoute } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<RoutesStackParamList>;

function RouteRow({ route, onPress }: { route: DrivingRoute; onPress: () => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  const stats = route.stats;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Same contained treatment as the feed card's. */}
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
          <>
            <View style={styles.metrics}>
              <Metric value={formatDistance(stats.distance_meters)} colors={colors} />
              {/* A plotted route was never timed; it says so where the time
                  would go. */}
              {isPlottedRoute(route)
                ? <Metric value="Plotted" colors={colors} Icon={PenLine} />
                : <Metric value={formatDuration(stats.moving_ms || stats.duration_ms)} colors={colors} />}
            </View>
            <Text style={[styles.technical, { color: colors.grey }]}>
              {curvinessLabel(stats.curviness)} · {stats.curviness}/100
              {route.technical_rating ? ` · driver ${route.technical_rating}/5` : ''}
            </Text>
          </>
        )}

        {/* The vote is live here — it's what ranks the list you're reading.
            Likes and comments are counts only; they open on the route. */}
        <View style={styles.social}>
          <VoteButton routeId={route.internal_id} score={route.vote_count ?? 0} userVote={route.user_vote ?? null} />
          {route.like_count ? (
            <Metric value={String(route.like_count)} colors={colors} Icon={Heart} />
          ) : null}
          {route.comment_count ? (
            <Metric value={String(route.comment_count)} colors={colors} Icon={MessageCircle} />
          ) : null}
        </View>
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

export default function RoutesScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const brand = useBrandColor();

  const headerPad = useHeaderPad();
  const isPro = useIsPro();
  const [filters, setFilters] = useState<RouteFilterState>(DEFAULT_FILTERS);

  const { data, isLoading, isFetching, refetch } = useGetRoutesQuery(buildRouteQuery(filters));
  const routes = data?.entries ?? [];

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={[]}>
      {/* The app header floats over the content, so the section heading below
          starts clear of it via useHeaderPad(). */}
      <AppHeader />

      <View style={[styles.header, { paddingTop: headerPad }]}>
        <ScreenHeading
          title="Routes"
          inline
          // Making routes is pro-only, so the entry point simply isn't there
          // for everyone else — same rule the API enforces. Two ways to make
          // one: record the drive as it happens, or plot one already driven.
          right={isPro ? (
            <HeadingActionButton
              label="New Route"
              onPress={() => Alert.alert('New route', 'Record a drive as you go, or plot one you\'ve already done.', [
                { text: 'Record a drive', onPress: () => (navigation as any).navigate('RouteRecord') },
                { text: 'Plot a past drive', onPress: () => (navigation as any).navigate('RoutePlot') },
                { text: 'Cancel', style: 'cancel' },
              ])}
              accessibilityLabel="Make a new route"
            />
          ) : undefined}
        />
      </View>

      <RouteFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          ref={scrollRef}
          data={routes}
          keyExtractor={(r) => r.internal_id}
          renderItem={({ item }) => (
            <RouteRow
              route={item}
              onPress={() => navigation.navigate('RouteDetail', { routeId: item.internal_id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={brand} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No routes yet"
              message={isPro
                ? 'Record a drive, or plot one you\'ve already done, with New Route.'
                : 'Pro members can record and share the roads they drive.'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ScreenHeading sits at zero; the gutter is here, on the same 12 as the
  // other list screens.
  header: { paddingHorizontal: 12, paddingBottom: 2 },

  list: { padding: 14, paddingBottom: 100, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: COMMON_RADIUS, padding: 12,
  },
  traceWell: {
    width: 104, height: 104,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  trace: { width: 96, height: 96 },
  info:  { flex: 1, gap: 4 },

  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  place: { fontSize: 12 },

  metrics:     { flexDirection: 'row', gap: 12, marginTop: 2 },
  metric:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 13, fontWeight: '700' },
  technical:   { fontSize: 11 },

  social: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
});
