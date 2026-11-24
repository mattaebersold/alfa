import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SharedModal from '../ui/SharedModal';
import FeedItemCard from '../cards/FeedItemCard';
import CarPosterCard from '../cards/CarPosterCard';
import PanelEmpty from '../ui/PanelEmpty';
import { useGetProPostsQuery, useGetProCarsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { GarageCar, Post } from '../../types/api';

const PAGE = 12;

/** Pages of a list, joined as they arrive — page 0 starts it again. */
function useAccumulated<T extends { internal_id: string }>(entries: T[] | undefined, page: number): T[] {
  const [all, setAll] = useState<T[]>([]);
  useEffect(() => {
    if (!entries) return;
    setAll((prev) => {
      if (page === 0) return entries;
      const seen = new Set(prev.map((e) => e.internal_id));
      return [...prev, ...entries.filter((e) => !seen.has(e.internal_id))];
    });
  }, [entries, page]);
  return all;
}

/**
 * The Pro screen's View alls, as a pane: every Pro member's posts (`kind="posts"`)
 * drawn with the home feed's post cards, or their cars (`kind="cars"`) with the
 * garage cards — newest first, the next page loading as you near the end.
 *
 * A tap closes the pane first, then opens the post or car: a route pushed
 * under an open pane would land behind it.
 */
export default function ProViewAllPane({ kind, visible, onClose }: {
  kind: 'posts' | 'cars';
  visible: boolean;
  onClose: () => void;
}) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const [page, setPage] = useState(0);
  useEffect(() => { if (visible) setPage(0); }, [visible]);

  const posts = useGetProPostsQuery({ page, limit: PAGE }, { skip: !visible || kind !== 'posts' });
  const cars = useGetProCarsQuery({ page, limit: PAGE }, { skip: !visible || kind !== 'cars' });
  const q = kind === 'posts' ? posts : cars;
  const postList = useAccumulated<Post>(posts.currentData?.entries, page);
  const carList = useAccumulated<GarageCar>(cars.currentData?.entries, page);
  const count = kind === 'posts' ? postList.length : carList.length;
  const total = q.currentData?.total ?? count;
  const hasMore = count < total;

  /** Where to go once the pane has slid away. */
  const after = useRef<(() => void) | null>(null);
  const leaveTo = (go: () => void) => { after.current = go; onClose(); };

  const loadMore = () => { if (hasMore && !q.isFetching) setPage((p) => p + 1); };
  const footer = q.isFetching ? <ActivityIndicator style={styles.loader} color={colors.grey} /> : null;
  const empty = !q.isFetching ? <PanelEmpty>{kind === 'posts' ? 'No posts from Pro members yet' : 'No Pro member cars yet'}</PanelEmpty> : null;

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={() => { const go = after.current; after.current = null; go?.(); }}
      title={kind === 'posts' ? 'Pro Member Updates' : 'Pro Member Cars'}
      fullHeight
    >
      {kind === 'posts' ? (
        <FlatList
          data={postList}
          keyExtractor={(p) => p.internal_id}
          renderItem={({ item }) => (
            <View style={styles.postItem}>
              <FeedItemCard
                post={item}
                isLiked={item.isLiked}
                onPress={() => leaveTo(() => navigation.navigate('PostDetailModal', { postId: item.internal_id }))}
              />
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={footer}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={carList}
          keyExtractor={(c) => c.internal_id}
          renderItem={({ item }) => (
            <CarPosterCard
              car={item}
              showOwner
              onPress={() => leaveTo(() => navigation.navigate('CarDetail', { carId: item.internal_id }))}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={footer}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
        />
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  postItem: { marginBottom: 12 },
  loader: { marginVertical: 20 },
});
