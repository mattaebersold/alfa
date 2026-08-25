import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { useGetRoutesQuery } from '../../api/apiService';
import RouteTrace from '../../components/routes/RouteTrace';
import VoteButton from '../../components/routes/VoteButton';
import RouteFilters, {
  DEFAULT_FILTERS, buildRouteQuery, type RouteFilterState,
} from '../../components/routes/RouteFilters';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText, useIsPro } from '../../hooks/useBrandColor';
import {
  formatDistance, formatDuration, curvinessLabel,
} from '../../utils/routeGeometry';
import type { RoutesStackParamList } from '../../navigation/types';
import type { DrivingRoute } from '../../types/api';

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
      <RouteTrace polyline={route.polyline} speeds={route.speed_profile} color={brand} style={styles.trace} />

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
              <Metric value={formatDuration(stats.moving_ms || stats.duration_ms)} colors={colors} />
            </View>
            <Text style={[styles.technical, { color: colors.grey }]}>
              {curvinessLabel(stats.curviness)} · {stats.curviness}/100
              {route.technical_rating ? ` · driver ${route.technical_rating}/5` : ''}
            </Text>
          </>
        )}
      </View>

      <View style={styles.voteCol}>
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

export default function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

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
        <Text style={[styles.heading, { color: colors.fg }]}>Routes</Text>
        {/* Recording is pro-only, so the entry point simply isn't there for
            everyone else — same rule the API enforces. */}
        {isPro && (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: brand }]}
            onPress={() => (navigation as any).navigate('RouteRecord')}
            activeOpacity={0.85}
          >
            <Plus size={16} color={onBrand} strokeWidth={2.8} />
            <Text style={[styles.newLabel, { color: onBrand }]}>New Route</Text>
          </TouchableOpacity>
        )}
      </View>

      <RouteFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
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
                ? 'Record your first drive with New Route.'
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, height: 36, borderRadius: 100,
  },
  newLabel: { fontSize: 13, fontWeight: '800' },

  list: { padding: 14, paddingBottom: 100, gap: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 12,
  },
  trace: { width: 76, height: 76 },
  info:  { flex: 1, gap: 4 },

  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  place: { fontSize: 12 },

  metrics:     { flexDirection: 'row', gap: 12, marginTop: 2 },
  metric:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricValue: { fontSize: 13, fontWeight: '700' },
  technical:   { fontSize: 11 },

  voteCol: { justifyContent: 'center' },
});
