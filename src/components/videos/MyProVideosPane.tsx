import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, Alert, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import ProVideoCard from './ProVideoCard';
import EmptyState from '../ui/EmptyState';
import { useGetProVideosInfiniteQuery, useDeleteProVideoMutation } from '../../api/apiService';
import {
  useProVideoUploads, canRetryProVideo, retryErroredProVideo, cancelProVideo, forgetProVideo,
  type ProVideoUpload,
} from '../../utils/proVideoUpload';
import { COLOR_WHITE, GUTTER } from '../../constants/config';
import type { ProVideo } from '../../types/proVideos';

/** How often it looks again while something is still uploading or processing. */
const PENDING_POLL_MS = 15_000;
/** One set of args, so every render asks for the same cached list. */
const MINE = { mine: true, sort: 'newest' } as const;
const CARD_W = Dimensions.get('window').width - (GUTTER + 4) * 2;
const CARD_H = Math.round(CARD_W * 0.75);

/**
 * Your Pro video uploads, in every status — the dashboard's My Videos (what
 * PRO › Videos' "My uploads" was). Uploading from this phone shows its
 * progress; processing updates itself; a failed one has Retry; any can be
 * deleted. A ready one opens the player via `onOpen`.
 */
export default function MyProVideosPane({ onOpen }: { onOpen: (video: ProVideo) => void }) {
  const [poll, setPoll] = useState(false);
  const list = useGetProVideosInfiniteQuery(MINE, {
    refetchOnMountOrArgChange: true,
    pollingInterval: poll ? PENDING_POLL_MS : 0,
  });
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: ProVideo[] = [];
    for (const page of list.data?.pages ?? []) {
      for (const v of page.entries ?? []) {
        if (!seen.has(v.internal_id)) { seen.add(v.internal_id); out.push(v); }
      }
    }
    return out;
  }, [list.data]);
  const pending = videos.some((v) => v.status === 'uploading' || v.status === 'processing');
  if (pending !== poll) setPoll(pending);

  const uploads = useProVideoUploads();
  const uploadsById = useMemo(() => {
    const m = new Map<string, ProVideoUpload>();
    for (const u of uploads) if (u.videoId) m.set(u.videoId, u);
    return m;
  }, [uploads]);

  const [deleteVideo] = useDeleteProVideoMutation();
  const open = useCallback((v: ProVideo) => { if (v.status === 'ready') onOpen(v); }, [onOpen]);
  const onRetry = useCallback((v: ProVideo) => {
    if (!retryErroredProVideo(v.internal_id)) {
      Alert.alert('Upload it again', "This video's file isn't on this phone any more. Pick it again with Upload in PRO › Videos.");
    }
  }, []);
  const onCancel = useCallback((v: ProVideo) => {
    Alert.alert('Stop uploading?', 'What has gone up so far is thrown away.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop upload', style: 'destructive', onPress: () => cancelProVideo(v.internal_id) },
    ]);
  }, []);
  const onDelete = useCallback((v: ProVideo) => {
    Alert.alert('Delete this video?', "It's gone for good — from your uploads and for everyone watching.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          forgetProVideo(v.internal_id);
          try { await deleteVideo(v.internal_id).unwrap(); } catch { Alert.alert("Couldn't delete it", 'Try again in a moment.'); }
        },
      },
    ]);
  }, [deleteVideo]);

  return (
    <FlatList
      data={videos}
      keyExtractor={(v) => v.internal_id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => (
        <ProVideoCard
          video={item}
          height={CARD_H}
          onPress={open}
          upload={uploadsById.get(item.internal_id) ?? null}
          canRetry={canRetryProVideo(item.internal_id)}
          onRetry={onRetry}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      )}
      ListEmptyComponent={list.isLoading
        ? <ActivityIndicator style={styles.loading} color={COLOR_WHITE} />
        : <EmptyState title="No uploads yet" message="Share a drive, a build, a review — upload from PRO › Videos." />}
      onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: GUTTER + 4, paddingBottom: 40 },
  sep: { height: 12 },
  loading: { marginTop: 40 },
});
