import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { likeStates, useLikeState } from '../../hooks/useLikeState';
import { useColors } from '../../hooks/useColors';
import { formatActionCount } from '../../utils/text';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import LikersSheet from './LikersSheet';
import AnimatedHeart from './AnimatedHeart';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_LIKE } from '../../constants/config';

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
  /**
   * Yours, said outright — for content with more than one owner (a car's
   * co-owner), which `ownerId` alone can't. Either makes the heart the likers
   * panel rather than a switch.
   */
  isOwn?: boolean;
  /**
   * The owner's heart hands its "who liked this" to the host — a panel of the
   * host's own (the car page's tabbed reactions) — instead of opening its own.
   */
  onShowLikers?: (origin: SummaryOrigin | null) => void;
  /** The count's colour, liked or not — for a host that keeps it white and lets the heart carry the red. */
  countColor?: string;
  /**
   * Stacked — the heart over its count, bigger and with a shadow — for the
   * action rail over a post's photo (PostActionRail).
   */
  vertical?: boolean;
  /** Onto the touchable itself — an outline, a fill — for a heart drawn as a button. */
  style?: StyleProp<ViewStyle>;
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
  isOwn = false,
  onShowLikers,
  countColor,
  vertical = false,
  style,
}: LikeButtonProps) {
  const colors = useColors();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const isMine = isOwn || (!!ownerId && !!myId && ownerId === myId);
  // Non-null while the likers panel is open, and the rect it grows out of.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const btnRef = useRef<View>(null);
  const resting = color ?? colors.grey;
  // What this session knows — a like made here, settled from the server's
  // liker list — over the snapshot this button was handed. See useLikeState.
  const known = useLikeState(documentId);
  const liked = known?.liked ?? initialLiked;
  const count = known?.count ?? initialCount;

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  const handlePress = async () => {
    // Your own content: show who liked it instead of pretending to add one.
    if (isMine) {
      measureOrigin(btnRef.current, onShowLikers ?? setLikersOrigin);
      return;
    }

    const was = { liked, count, users: known?.users };
    const now = !was.liked;
    likeStates.set(documentId, {
      liked: now,
      count: Math.max(0, was.count + (now ? 1 : -1)),
      users: was.users && myId
        ? (now ? [...was.users.filter((u) => u !== myId), myId] : was.users.filter((u) => u !== myId))
        : undefined,
    });
    onToggle?.(now);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const body = { document_id: documentId, document_entry_type: entryType };
      const record: any = now ? await likeEntry(body).unwrap() : await unlikeEntry(body).unwrap();
      // The server's liker list: the count, exactly.
      if (Array.isArray(record?.users)) likeStates.fromRecord(documentId, record.users, myId);
    } catch (err: any) {
      // Nothing to unlike: not liked, as the tap already says.
      if (!now && err?.status === 404) return;
      likeStates.set(documentId, was);
    }
  };

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        onPress={handlePress}
        style={[vertical ? styles.vertical : styles.container, style]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isMine ? 'See who liked this'
          : liked ? 'Unlike' : 'Like'
        }
      >
        <AnimatedHeart
          liked={liked}
          size={size}
          color={liked ? COLOR_LIKE : resting}
          fill={liked ? COLOR_LIKE : 'transparent'}
          strokeWidth={vertical ? 1.8 : 2}
        />
        {showCount && count > 0 && (
          <Text style={[vertical ? styles.railCount : styles.count, countColor ? { color: countColor } : liked ? styles.likedCount : { color: resting }]}>
            {formatActionCount(count)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Only mounted for the owner — nobody else's heart opens this. */}
      {isMine && !onShowLikers && (
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
  count:      { fontSize: 13, fontFamily: FONT_INTER.medium },
  likedCount: { color: COLOR_LIKE },
  vertical:   { alignItems: 'center', gap: 3, padding: 4 },
  // Over a photo: white-ish on anything, so a shadow under the digits.
  railCount:  {
    fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
