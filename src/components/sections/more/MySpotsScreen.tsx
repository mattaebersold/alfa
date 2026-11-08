import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetPhotoSpotsQuery } from '@ors/kit';
import { PhotoSpotRow, PhotoSpotSummaryModal } from '@ors/kit/src/photography';
import SpotActions from '../../photography/SpotActions';
import { useAppSelector } from '../../../store/store';
import { useColors } from '../../../hooks/useColors';
import EmptyState from '../../ui/EmptyState';
import { SkeletonPeople } from '../../ui/Skeleton';
import { GUTTER, MAIN_SCREEN_TOP_GAP } from '../../../constants/config';
import type { SectionScreenProps } from '../types';

/** The server's cap — the profile's spots shelf asks for the same. */
const LIMIT = 300;

/**
 * Photography › My Spots: the places you've pinned, as the map's list view's
 * rows — the profile's spots shelf, as a screen of its own.
 *
 * A row opens the same summary a pin on the map does, with the map's like and
 * comments under its photos, and Edit (yours, so always offered) to the form.
 */
export default function MySpotsScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const userId = userInfo?.user_id;
  const { data, isLoading, refetch } = useGetPhotoSpotsQuery({ user_id: userId, limit: LIMIT }, { skip: !userId });
  const [spotId, setSpotId] = useState<string | null>(null);
  const renderContext = useCallback((id: string) => <SpotActions spotId={id} />, []);

  return (
    <>
      <FlatList
        data={data?.entries ?? []}
        keyExtractor={(s) => s.internal_id}
        renderItem={({ item }) => <PhotoSpotRow spot={item} onPress={(s) => setSpotId(s.internal_id)} />}
        ListEmptyComponent={
          isLoading ? <SkeletonPeople count={6} style={{ paddingHorizontal: GUTTER }} /> : (
            <EmptyState title="You haven't pinned any spots yet" />
          )
        }
        contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: bottomPad }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => { if (userId) refetch(); }} tintColor={colors.primaryAlt} />
        }
      />
      <PhotoSpotSummaryModal
        spotId={spotId}
        onClose={() => setSpotId(null)}
        onEdit={(id) => navigation.navigate('PhotoSpotCreate', { spotId: id })}
        renderContext={renderContext}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
});
