import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, Alert, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { MoreHorizontal, Pencil, Trash2, RotateCcw, X, Clapperboard } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import ActionSheet from '../ui/ActionSheet';
import ProVideoDetailsSheet from './ProVideoDetailsSheet';
import { useColors } from '../../hooks/useColors';
import { muxPoster, formatDuration } from '../../types/proVideos';
import { FONT_INTER } from '../../constants/fonts';
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
/** A row's square thumbnail. */
const THUMB = 64;

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

  const colors = useColors();
  /** The video whose … menu is open, and the one being edited. */
  const [menuFor, setMenuFor] = useState<ProVideo | null>(null);
  const [editing, setEditing] = useState<ProVideo | null>(null);
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

  /** A row's second line: where an upload's got to, or the video's length. */
  const statusOf = (v: ProVideo) => {
    const up = uploadsById.get(v.internal_id);
    if (up && v.status === 'uploading') return `Uploading · ${up.total ? Math.floor((up.sent / up.total) * 100) : 0}%`;
    if (v.status === 'uploading') return 'Uploading';
    if (v.status === 'processing') return 'Processing';
    if (v.status === 'errored') return "Couldn't process";
    if (v.status === 'cancelled') return 'Cancelled';
    return formatDuration(v.duration);
  };

  const menuOptions = menuFor ? [
    ...(menuFor.status === 'ready' ? [{ label: 'Edit details', Icon: Pencil, onPress: () => setEditing(menuFor) }] : []),
    ...(menuFor.status === 'errored' && canRetryProVideo(menuFor.internal_id)
      ? [{ label: 'Retry upload', Icon: RotateCcw, onPress: () => onRetry(menuFor) }] : []),
    ...(menuFor.status === 'uploading' ? [{ label: 'Stop upload', Icon: X, onPress: () => onCancel(menuFor) }] : []),
    { label: 'Delete', Icon: Trash2, destructive: true, onPress: () => onDelete(menuFor) },
  ] : [];

  return (
    <>
    <FlatList
      data={videos}
      keyExtractor={(v) => v.internal_id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
      renderItem={({ item }) => {
        const ready = item.status === 'ready' && !!item.playback_id;
        return (
          // A plain row: the square poster, the title and how it's doing, and … for edit or delete.
          <TouchableOpacity style={styles.row} onPress={() => open(item)} activeOpacity={ready ? 0.8 : 1} disabled={!ready}>
            {ready ? (
              <Image source={{ uri: muxPoster(item.playback_id!, 200) }} style={[styles.thumb, { backgroundColor: colors.segment }]} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.segment }]}>
                {item.status === 'uploading' || item.status === 'processing'
                  ? <ActivityIndicator size="small" color={colors.grey} />
                  : <Clapperboard size={20} color={colors.grey} />}
              </View>
            )}
            <View style={styles.text}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{item.title || 'Untitled'}</Text>
              {statusOf(item) ? <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>{statusOf(item)}</Text> : null}
            </View>
            <TouchableOpacity
              style={styles.more}
              onPress={() => setMenuFor(item)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Options for ${item.title || 'this video'}`}
            >
              <MoreHorizontal size={20} color={colors.grey} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={list.isLoading
        ? <ActivityIndicator style={styles.loading} color={COLOR_WHITE} />
        : <EmptyState title="No uploads yet" message="Share a drive, a build, a review — upload from PRO › Videos." />}
      onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
    <ActionSheet
      visible={menuFor !== null}
      onClose={() => setMenuFor(null)}
      title={menuFor?.title || 'Video'}
      options={menuOptions}
    />
    <ProVideoDetailsSheet visible={!!editing} video={editing} onClose={() => setEditing(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER + 4, paddingTop: 8, paddingBottom: 40 },
  sep: { height: StyleSheet.hairlineWidth },
  loading: { marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15, fontFamily: FONT_INTER.semibold },
  sub: { fontSize: 12.5 },
  more: { padding: 6 },
});
