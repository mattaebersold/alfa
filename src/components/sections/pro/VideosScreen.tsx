import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ProVideoStack from '../../videos/ProVideoStack';
import ProVideoFilters, { type VideoPanelFilters } from '../../videos/ProVideoFilters';
import ProVideoUploadBanner from '../../videos/ProVideoUploadBanner';
import ProVideoDetailsSheet from '../../videos/ProVideoDetailsSheet';
import EmptyState from '../../ui/EmptyState';
import {
  useGetProVideoMetaQuery, useGetProVideosInfiniteQuery, useDeleteProVideoMutation,
} from '../../../api/apiService';
import { useDebounced } from '../../../hooks/useDebounced';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import {
  pickProVideo, useProVideoUploads, canRetryProVideo, retryErroredProVideo, cancelProVideo, forgetProVideo,
  type PickedVideo, type ProVideoUpload,
} from '../../../utils/proVideoUpload';
import { COLOR_WHITE, GUTTER } from '../../../constants/config';
import type { ProVideo, ProVideoListParams } from '../../../types/proVideos';
import type { SectionScreenProps } from '../types';

/**
 * PRO › Videos: long-form video from Pro members.
 *
 * Filters at the top (search, and sort/length/make in a panel) with Upload
 * beside them; any uploads going up from this phone in a banner under that;
 * then every video as a cascading stack (videos/ProVideoStack). A ready one
 * opens the player (ProVideoScreen).
 */
export default function VideosScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const navigation = useNavigation<any>();
  const { data: meta } = useGetProVideoMetaQuery();
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 350);
  const [panel, setPanel] = useState<VideoPanelFilters>({ sort: 'newest', length: null, make: '' });
  const [headerHeight, setHeaderHeight] = useState(0);
  const [picked, setPicked] = useState<PickedVideo | null>(null);
  const [deleteVideo] = useDeleteProVideoMutation();

  const params = useMemo<ProVideoListParams>(() => ({
    sort: panel.sort,
    length: panel.length ?? undefined,
    make: panel.make.trim() || undefined,
    q: q.trim() || undefined,
  }), [panel, q]);

  const list = useGetProVideosInfiniteQuery(params, { refetchOnMountOrArgChange: 60 });
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: ProVideo[] = [];
    for (const page of list.data?.pages ?? []) {
      for (const v of page.entries ?? []) {
        if (seen.has(v.internal_id)) continue;
        seen.add(v.internal_id);
        out.push(v);
      }
    }
    return out;
  }, [list.data]);

  // This phone's uploads, by video — the cards of those going up from here show its progress.
  const uploads = useProVideoUploads();
  const uploadsById = useMemo(() => {
    const m = new Map<string, ProVideoUpload>();
    for (const u of uploads) if (u.videoId) m.set(u.videoId, u);
    return m;
  }, [uploads]);

  const refreshControl = useRefreshControl(() => list.refetch(), headerPad);

  const onUpload = useCallback(async () => {
    try {
      const v = await pickProVideo();
      if (v) setPicked(v);
    } catch (err: any) {
      Alert.alert("Couldn't open your videos", err?.message ?? 'Check that the app is allowed to see your library.');
    }
  }, []);

  const onOpen = useCallback((v: ProVideo) => {
    if (v.status !== 'ready') return; // its card carries what can be done with it
    navigation.navigate('ProVideo', { videoId: v.internal_id });
  }, [navigation]);

  const onRetry = useCallback((v: ProVideo) => {
    if (!retryErroredProVideo(v.internal_id)) {
      Alert.alert('Upload it again', "This video's file isn't on this phone any more. Pick it again with Upload.");
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
  const canRetry = useCallback((v: ProVideo) => canRetryProVideo(v.internal_id), []);

  const header = (
    <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <ProVideoFilters
        meta={meta}
        search={search}
        onSearch={setSearch}
        panel={panel}
        onPanel={setPanel}
        onUpload={onUpload}
      />
      <View style={styles.banner}>
        <ProVideoUploadBanner />
      </View>
    </View>
  );

  const empty = list.isLoading ? (
    <ActivityIndicator style={styles.loading} color={COLOR_WHITE} />
  ) : list.isError ? (
    <EmptyState title="Couldn't load videos" message="Pull down to try again." />
  ) : (
    <EmptyState
      title="No videos here yet"
      message="Try another search, or be the first to upload one."
    />
  );

  return (
    <>
      <ProVideoStack
        videos={videos}
        header={header}
        empty={empty}
        footer={list.isFetchingNextPage ? <ActivityIndicator style={styles.more} color={COLOR_WHITE} /> : null}
        headerHeight={headerHeight}
        paddingTop={headerPad + 12}
        paddingBottom={bottomPad}
        onScroll={onScroll}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
        refreshControl={refreshControl}
        onOpen={onOpen}
        uploads={uploadsById}
        canRetry={canRetry}
        onRetry={onRetry}
        onCancel={onCancel}
        onDelete={onDelete}
      />
      <ProVideoDetailsSheet visible={!!picked} picked={picked} onClose={() => setPicked(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: GUTTER + 4 },
  loading: { marginTop: 40 },
  more: { marginVertical: 20 },
});
