import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { formatActionCount } from '../../utils/text';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import LikersSheet from './LikersSheet';

interface LikeButtonProps {
  documentId: string;
  entryType: string;
  initialLiked?: boolean;
  initialCount?: number;
  showCount?: boolean;
  size?: number;
  /**
   * The heart and count when *not* liked. Defaults to the muted grey it has
   * always used; a caller placing this inside a filled button passes the same
   * ink as the icons beside it, so the row reads as one set of controls.
   *
   * The liked state is deliberately not configurable — the red is what says
   * "you liked this", and a caller overriding it would be removing the signal.
   */
  color?: string;
  /**
   * Fired when this viewer likes or unlikes, before the request settles.
   *
   * A caller that renders like state from a batched payload rather than from
   * the live query uses this to switch over — the payload was assembled before
   * the tap, and nothing else tells it that.
   */
  onToggle?: (liked: boolean) => void;
  /**
   * Whose content this is.
   *
   * You can't like your own, so for the owner the heart stops being a switch
   * and becomes the way into the list of people who did — the same panel the
   * "liked by" line opens. Without this the button behaves as it always has,
   * so a caller that doesn't know the owner loses nothing.
   */
  ownerId?: string;
}

export default function LikeButton({
  documentId,
  entryType,
  initialLiked = false,
  initialCount = 0,
  showCount = true,
  size = 18,
  color,
  onToggle,
  ownerId,
}: LikeButtonProps) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isMine = !!ownerId && !!myId && ownerId === myId;
  // Non-null while the likers panel is open, and the rect it grows out of.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const btnRef = useRef<View>(null);
  const resting = color ?? colors.grey;
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  // Sync with server-derived state once the live like query resolves (or refetches
  // after a like/unlike elsewhere), so the heart reflects the true "did I like this".
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setCount(initialCount); }, [initialCount]);

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  const handlePress = async () => {
    // Your own content: show who liked it instead of pretending to add one.
    if (isMine) {
      measureOrigin(btnRef.current, setLikersOrigin);
      return;
    }

    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? c - 1 : c + 1));
    onToggle?.(!wasLiked);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (wasLiked) {
        await unlikeEntry({ document_id: documentId, document_entry_type: entryType }).unwrap();
      } else {
        await likeEntry({ document_id: documentId, document_entry_type: entryType }).unwrap();
      }
    } catch {
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        onPress={handlePress}
        style={styles.container}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isMine ? 'See who liked this'
          : liked ? 'Unlike' : 'Like'
        }
      >
        <Heart
          size={size}
          color={liked ? '#FF4060' : resting}
          fill={liked ? '#FF4060' : 'transparent'}
        />
        {showCount && count > 0 && (
          <Text style={[styles.count, liked ? styles.likedCount : { color: resting }]}>
            {formatActionCount(count)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Only mounted for the owner — nobody else's heart opens this. */}
      {isMine && (
        <LikersSheet
          entryId={documentId}
          visible={likersOrigin !== undefined}
          origin={likersOrigin}
          onClose={() => setLikersOrigin(undefined)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container:  { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count:      { fontSize: 13, fontWeight: '500' },
  likedCount: { color: '#FF4060' },
});
