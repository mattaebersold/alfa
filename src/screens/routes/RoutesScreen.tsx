import React, { useCallback, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetRoutesQuery } from '../../api/apiService';
import RouteCard from '../../components/cards/RouteCard';
import RouteFilters, {
  DEFAULT_FILTERS, buildRouteQuery, type RouteFilterState,
} from '../../components/routes/RouteFilters';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useCreateRoute } from '../../hooks/useCreateRoute';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import { GUTTER } from '../../constants/config';

export default function RoutesScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const brand = useBrandColor();

  const headerPad = useHeaderPad();
  const isPro = useIsPro();
  // Pro gets the two ways to make one; everyone else, the pitch.
  const { create, upsell } = useCreateRoute();
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
          title="Driving Routes"
          inline
          // Shown to everyone, as on the route cards: Pro gets the two ways to
          // make one (record a drive, or plot one already driven), a basic
          // member the pitch for Pro — the API won't take one from them.
          right={
            <HeadingActionButton
              label="New route"
              onPress={create}
              accessibilityLabel="New route"
            />
          }
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
          // The home feed's card, as-is: like, comment, its menu, and the
          // create button — and it opens the route the same way.
          renderItem={({ item }) => <RouteCard route={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={brand} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No routes yet"
              message={isPro
                ? 'Record a drive, or plot one you\'ve already done, with Create your own.'
                : 'Pro members can record and share the roads they drive.'}
            />
          }
        />
      )}

      {upsell}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ScreenHeading sits at zero; the gutter is here, on the same 12 as the
  // other list screens.
  header: { paddingHorizontal: 12, paddingBottom: 2 },

  // The feed's gutter, so the cards sit exactly as they do there.
  list: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 100 },
});
