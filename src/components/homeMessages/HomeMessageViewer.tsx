import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '../../theme/Text';
import LikeButton from '../social/LikeButton';
import VideoViewer, { viewerActionStyle, viewerCountStyle } from '../videos/VideoViewer';
import {
  apiService,
  useCountHomeMessageViewMutation, useToggleHomeMessageBookmarkMutation, patchHomeMessageCaches,
} from '../../api/apiService';
import { store } from '../../store/store';
import { formatActionCount } from '../../utils/text';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COLOR_WHITE } from '../../constants/config';
import type { HomeMessage } from '../../types/api';

/** The entry type likes and comments on a home message are filed under (horacio's contentRef). */
export const HOME_MESSAGE_ENTRY_TYPE = 'homemessage';


/** "Message from Matt" — the author's first name, or ORS's when there isn't one. */
/**
 * The home banner's line: "Message from Matt" — the sender's username,
 * capitalised, which is the short name they go by (the first name on the
 * account is the full one, "Matthew").
 */
export function bannerFrom(message: Pick<HomeMessage, 'author'>): string {
  const u = message.author?.username;
  const name = u ? u.charAt(0).toUpperCase() + u.slice(1) : message.author?.firstName;
  return name ? `Message from ${name}` : 'Message from ORS';
}

export function messageFrom(message: Pick<HomeMessage, 'author'>): string {
  const name = message.author?.firstName || message.author?.username;
  return name ? `Message from ${name}` : 'Message from ORS';
}

/** The video's own shape, from Mux — width over height. */
function aspectOf(m: HomeMessage): number {
  const r = m.aspect_ratio?.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (r && Number(r[2]) > 0) return Number(r[1]) / Number(r[2]);
  if (m.width && m.height) return m.width / m.height;
  return 16 / 9;
}

/**
 * A home message, full screen, in the same viewer as a Pro video
 * (VideoViewer): the video at the top with our controls, "Message from Matt"
 * over the title, the description, like and save inline, then the comments.
 *
 * Watching doesn't dismiss the banner — only its Dismiss does — so closing
 * this leaves the banner where it was.
 */
export default function HomeMessageViewer({ message, onClose }: {
  message: HomeMessage | null;
  onClose: () => void;
}) {
  if (!message?.playback_id) return null;
  // Keyed, so another message is a fresh player rather than this one retargeted.
  return <Viewer key={message.internal_id} message={message} onClose={onClose} />;
}

function Viewer({ message, onClose }: { message: HomeMessage; onClose: () => void }) {
  const [countView] = useCountHomeMessageViewMutation();
  // Everyone's message, not just Pro's: lit in the member's own brand colour.
  const brand = useBrandColor();
  const [toggleBookmark] = useToggleHomeMessageBookmarkMutation();
  // The live copy, so a like or save made here shows here too.
  const live = useLiveMessage(message);

  return (
    <VideoViewer
      playbackId={message.playback_id!}
      fallbackAspect={aspectOf(message)}
      onClose={onClose}
      onFirstPlay={() => { countView(message.internal_id).catch(() => {}); }}
      eyebrow={bannerFrom(live)}
      title={live.title}
      description={live.description}
      comments={{ documentId: live.internal_id, entryType: HOME_MESSAGE_ENTRY_TYPE }}
      actions={(
        <>
          <LikeButton
            documentId={live.internal_id}
            entryType={HOME_MESSAGE_ENTRY_TYPE}
            initialLiked={live.has_liked}
            initialCount={live.like_count}
            ownerId={live.author?.user_id}
            size={22}
            color={COLOR_WHITE}
            litColor={brand}
            style={viewerActionStyle}
            onToggle={(liked) => patchHomeMessageCaches(store.dispatch, store.getState, live.internal_id, (m) => {
              m.has_liked = liked;
              m.like_count = Math.max(0, (m.like_count ?? 0) + (liked ? 1 : -1));
            })}
          />
          <TouchableOpacity
            style={viewerActionStyle}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleBookmark(live.internal_id); }}
            accessibilityRole="button"
            accessibilityLabel={live.bookmarked ? 'Remove from saved' : 'Save'}
            accessibilityState={{ selected: live.bookmarked }}
          >
            <Bookmark size={20} color={live.bookmarked ? brand : COLOR_WHITE} fill={live.bookmarked ? brand : 'transparent'} />
            {live.bookmark_count > 0 ? <Text style={viewerCountStyle}>{formatActionCount(live.bookmark_count)}</Text> : null}
          </TouchableOpacity>
        </>
      )}
    />
  );
}

/**
 * The message as the caches have it now — the banner's or the list's copy,
 * which a like or a save patches — falling back to the one it was opened with.
 */
function useLiveMessage(message: HomeMessage): HomeMessage {
  // Read-only views of the caches — these never fetch.
  const { data: current } = apiService.endpoints.getCurrentHomeMessage.useQueryState();
  const { data: list } = apiService.endpoints.getHomeMessages.useQueryState();
  const { data: single } = apiService.endpoints.getHomeMessage.useQueryState(message.internal_id);
  if (current?.message?.internal_id === message.internal_id) return current.message;
  return list?.entries.find((m) => m.internal_id === message.internal_id) ?? single ?? message;
}
