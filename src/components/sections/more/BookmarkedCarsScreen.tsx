import React from 'react';
import { useGetCarBookmarksQuery, useGetLoggedInUserQuery } from '../../../api/apiService';
import { useAppSelector } from '../../../store/store';
import CarColumns from './CarColumns';
import type { SectionScreenProps } from '../types';

/**
 * Cars › Saved: the cars you've bookmarked, newest first — the bookmarks
 * panel's Cars, as a screen.
 *
 * Read as the panel reads it: the ids on your profile are the truth (the
 * bookmark button updates them on the tap), and the fetched cars are filtered
 * by them, so one un-saved from its summary leaves here at once rather than
 * on the refetch.
 */
export default function BookmarkedCarsScreen(props: SectionScreenProps) {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { data: me, isLoading: meLoading } = useGetLoggedInUserQuery(undefined, { skip: !isLoggedIn });
  const carIds = me?.carBookmarks ?? [];
  const { data, isLoading, refetch } = useGetCarBookmarksQuery(undefined, { skip: carIds.length === 0 });
  const cars = (data?.entries ?? []).filter((c) => carIds.includes(c.internal_id));
  return (
    <CarColumns
      {...props}
      cars={cars}
      isLoading={meLoading || isLoading}
      emptyTitle="No saved cars yet"
      // A skipped query can't be refetched — nothing saved, nothing to read again.
      onRefresh={() => { if (carIds.length) refetch(); }}
    />
  );
}
