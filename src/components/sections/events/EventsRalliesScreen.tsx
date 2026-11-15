import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Text } from '../../../theme/Text';
import RallyCard from '../../rallys/RallyCard';
import RallyDetailSheet from '../../society/RallyDetailSheet';
import EmptyState from '../../ui/EmptyState';
import Spinner from '../../ui/Spinner';
import { useGetRallysQuery } from '../../../api/apiService';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { useColors } from '../../../hooks/useColors';
import { calendarTime } from '../../../utils/calendarDate';
import { FONT_INTER } from '../../../constants/fonts';
import type { Rally } from '../../../types/api';
import type { SectionScreenProps } from '../types';

const PAGE = 12;
/** Past rallys are a reference shelf — one page under the upcoming ones. */
const PAST_LIMIT = 20;

/**
 * Events › Rallies: the landing's rally carousel as a full-width list —
 * upcoming soonest first, paged, then the most recent past ones. A card
 * opens the same RallyDetailSheet the carousel does.
 */
export default function EventsRalliesScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [upcoming, setUpcoming] = useState<Rally[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useGetRallysQuery({ page, limit: PAGE, time_filter: 'upcoming' });
  const { data: pastData, refetch: refetchPast } = useGetRallysQuery({ page: 0, limit: PAST_LIMIT, time_filter: 'past' });

  // Pages accumulate, de-duplicated (RallysScreen's approach).
  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setUpcoming(data.entries);
    else setUpcoming((prev) => {
      const ids = new Set(prev.map((r) => r.internal_id));
      return [...prev, ...data.entries.filter((r) => !ids.has(r.internal_id))];
    });
  }, [data, page]);

  const sortedUpcoming = useMemo(
    () => [...upcoming].sort((a, b) => calendarTime(a.event_date, Infinity) - calendarTime(b.event_date, Infinity)),
    [upcoming],
  );
  const past = useMemo(
    () => [...(pastData?.entries ?? [])].sort((a, b) => calendarTime(b.event_date) - calendarTime(a.event_date)),
    [pastData],
  );

  // One list, upcoming then past, each under its heading.
  type Row = { kind: 'head'; key: string; label: string } | { kind: 'rally'; key: string; rally: Rally };
  const rows = useMemo<Row[]>(() => [
    ...(sortedUpcoming.length ? [{ kind: 'head' as const, key: 'h-up', label: 'Upcoming' }] : []),
    ...sortedUpcoming.map((rally) => ({ kind: 'rally' as const, key: rally.internal_id, rally })),
    ...(past.length ? [{ kind: 'head' as const, key: 'h-past', label: 'Past Rallys' }] : []),
    ...past.map((rally) => ({ kind: 'rally' as const, key: `past-${rally.internal_id}`, rally })),
  ], [sortedUpcoming, past]);

  const refreshControl = useRefreshControl(() => {
    setPage(0);
    return Promise.all([refetch(), refetchPast()]);
  }, headerPad);
  const loadMore = useCallback(() => {
    if (!isFetching && data && upcoming.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, upcoming.length]);

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => item.kind === 'head'
          ? <Text style={[styles.heading, { color: colors.fg }]}>{item.label}</Text>
          : <RallyCard rally={item.rally} onPress={() => setSelectedId(item.rally.internal_id)} />}
        ListEmptyComponent={isLoading ? <Spinner /> : <EmptyState title="No rallys yet" />}
        refreshControl={refreshControl}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: bottomPad }}
      />
      <RallyDetailSheet rallyId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold, paddingHorizontal: 12, paddingTop: 18, paddingBottom: 2 },
});
