import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Bookmark, Settings, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import VideoViewer, { viewerActionStyle, viewerCountStyle } from './VideoViewer';
import LikeButton from '../social/LikeButton';
import ActionSheet from '../ui/ActionSheet';
import ProVideoDetailsSheet from './ProVideoDetailsSheet';
import { Text } from '../../theme/Text';
import { store, useAppSelector } from '../../store/store';
import { forgetProVideo } from '../../utils/proVideoUpload';
import { formatActionCount } from '../../utils/text';
import { colors } from '../../constants/colors';
import {
  useCountProVideoViewMutation, useGetProVideoQuery, useToggleProVideoBookmarkMutation, useDeleteProVideoMutation, patchProVideoCaches,
} from '../../api/apiService';
import { aspectOf, type ProVideo } from '../../types/proVideos';
import { COLOR_WHITE } from '../../constants/config';

/** The comments' entry type for a Pro video — ProVideoScreen's. */
const ENTRY_TYPE = 'provideo';

/**
 * A Pro video, full screen over everything, in the shared viewer
 * (VideoViewer — the home message plays in the same one). Its title and
 * description; like and save inline under them, and for its owner the cog
 * with Edit and Delete (an admin, just Delete); then its comments.
 */
export default function ProVideoOverlay({ video, onClose }: {
  /** The video to play; null while closed. */
  video: ProVideo | null;
  onClose: () => void;
}) {
  if (!video?.playback_id) return null;
  // Keyed so a different video is a fresh player.
  return <Viewer key={video.internal_id} video={video} onClose={onClose} />;
}

function Viewer({ video: given, onClose }: { video: ProVideo; onClose: () => void }) {
  // The video's own record, kept live — a like or a save shows at once —
  // with the card's copy until it's in.
  const { data: fresh } = useGetProVideoQuery(given.internal_id);
  const video = fresh ?? given;
  const [toggleBookmark] = useToggleProVideoBookmarkMutation();
  const [countView] = useCountProVideoViewMutation();
  const [deleteVideo] = useDeleteProVideoMutation();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isAdmin = useAppSelector((s) => s.auth.userInfo?.accountType === 'admin');
  const mine = video.user_id === myId;
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);

  const onDelete = () => {
    Alert.alert('Delete this video?', "It's gone for good — for you and everyone watching.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            forgetProVideo(video.internal_id);
            await deleteVideo(video.internal_id).unwrap();
            onClose();
          } catch {
            Alert.alert("Couldn't delete it", 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  return (
    <VideoViewer
      playbackId={video.playback_id!}
      fallbackAspect={aspectOf(video)}
      onClose={onClose}
      onFirstPlay={() => { countView(video.internal_id).catch(() => {}); }}
      title={video.title}
      description={video.description}
      comments={{ documentId: video.internal_id, entryType: ENTRY_TYPE }}
      actions={(
        <>
          <LikeButton
            documentId={video.internal_id}
            entryType={ENTRY_TYPE}
            initialLiked={video.has_liked}
            initialCount={video.like_count}
            ownerId={video.user_id}
            size={22}
            color={COLOR_WHITE}
            litColor={colors.pro}
            style={viewerActionStyle}
            onToggle={(liked) => patchProVideoCaches(store.dispatch, store.getState, video.internal_id, (v) => {
              v.has_liked = liked;
              v.like_count = Math.max(0, (v.like_count ?? 0) + (liked ? 1 : -1));
            })}
          />
          <TouchableOpacity
            style={viewerActionStyle}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleBookmark(video.internal_id); }}
            accessibilityRole="button"
            accessibilityLabel={video.bookmarked ? 'Remove from saved' : 'Save'}
            accessibilityState={{ selected: video.bookmarked }}
          >
            <Bookmark size={20} color={video.bookmarked ? colors.pro : COLOR_WHITE} fill={video.bookmarked ? colors.pro : 'transparent'} />
            {video.bookmark_count > 0 ? <Text style={viewerCountStyle}>{formatActionCount(video.bookmark_count)}</Text> : null}
          </TouchableOpacity>
          {mine || isAdmin ? (
            <TouchableOpacity style={[viewerActionStyle, styles.more]} onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Video options">
              <Settings size={19} color={COLOR_WHITE} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    >
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={mine ? 'Your video' : undefined}
        options={[
          ...(mine ? [{ label: 'Edit', Icon: Pencil, onPress: () => setEditing(true) }] : []),
          { label: 'Delete', Icon: Trash2, destructive: true, onPress: onDelete },
        ]}
      />
      <ProVideoDetailsSheet visible={editing} video={video} onClose={() => setEditing(false)} />
    </VideoViewer>
  );
}

const styles = StyleSheet.create({
  more: { marginLeft: 'auto' },
});
