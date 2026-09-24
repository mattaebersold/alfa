import React, { useState } from 'react';
import { Alert, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { UserPlus, UserMinus, MoreHorizontal } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';
import { useFollowUserMutation, useUnfollowUserMutation, useGetFollowStatusQuery } from '../../api/apiService';
import Button from '../ui/Button';

interface FollowButtonProps {
  username: string;
  /**
   * Follow state the caller already knows — from a list that asked for the
   * whole page at once. Given this, the button skips its own request entirely.
   *
   * `undefined` means "I don't know, go and find out"; a boolean is trusted.
   */
  isFollowing?: boolean;
  /**
   * Force one appearance for both states, instead of the brand fill for
   * "Follow" and a grey for "Following".
   *
   * For places where this sits beside another button and the pair should read
   * as a set — a summary panel's Follow and Message, say. The label still
   * carries the state, which is the part that has to be legible.
   */
  variant?: 'dark' | 'secondary';
  /** Passed through — see Button. The profile squares this off to match Message. */
  radius?: number;
  /** The "Following" fill, where the default grey is too bright for its surroundings. */
  followingBackground?: string;
  /** Passed through — see Button. Holds one width across both labels. */
  minWidth?: number;
  /**
   * A square icon button instead of a labelled one: a person with a plus to
   * follow; once followed, a ⋯ whose menu holds the unfollow. For dense lists
   * where the word "Following" was the widest thing in every row — and where
   * an unfollow one stray tap away was too easy to hit.
   */
  iconOnly?: boolean;
}

/**
 * Follow / unfollow one person.
 *
 * Two things this deliberately does not do:
 *
 * It doesn't say "Follow" when it doesn't know. A failed status lookup used to
 * be indistinguishable from a negative one — `data?.isFollowing ?? false` — so
 * a request that fell over rendered a confident Follow button for somebody you
 * already followed. Pressing it then called follow, the server answered
 * "already following" with a 200, nothing changed, and the button sat there
 * looking broken. Now an errored lookup disables the button rather than
 * guessing at the answer.
 *
 * It doesn't swallow failures. The press used to be a bare await with no catch,
 * so a rejected follow looked exactly like a successful one.
 */
export default function FollowButton({ username, isFollowing: known, variant, radius, followingBackground, minWidth, iconOnly }: FollowButtonProps) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  // A caller that already has the answer doesn't need us to ask again.
  const skip = known !== undefined;
  const { data, isLoading, isError, refetch } = useGetFollowStatusQuery(username, { skip });

  const [follow, { isLoading: following }] = useFollowUserMutation();
  const [unfollow, { isLoading: unfollowing }] = useUnfollowUserMutation();

  /**
   * What the button shows while a press is in flight.
   *
   * The mutation invalidates the status tag, so the truth arrives a moment
   * later — this covers the gap so the label flips on touch rather than after
   * a round trip.
   */
  const [pending, setPending] = useState<boolean | null>(null);
  /** The ⋯ menu, in icon mode once followed. */
  const [menuOpen, setMenuOpen] = useState(false);

  const resolved = known ?? data?.isFollowing;
  const isFollowing = pending ?? resolved ?? false;
  const busy = following || unfollowing;

  const handlePress = async () => {
    if (busy) return;
    const next = !isFollowing;
    setPending(next);
    try {
      await (next ? follow(username) : unfollow(username)).unwrap();
    } catch (err: any) {
      setPending(null);
      if (!skip) refetch();
      Alert.alert(
        next ? "Couldn't follow" : "Couldn't unfollow",
        err?.data?.message ?? err?.message ?? 'Please try again.',
      );
      return;
    }
    // Cleared once the invalidated query has had a chance to land, so the
    // button hands back to the server's answer rather than holding its own.
    setPending(null);
  };

  if (!skip && isLoading) return null;

  if (iconOnly) {
    const unknown = !skip && isError && resolved === undefined;

    // Followed: a quiet ⋯, and the unfollow inside it — undoing a follow is
    // rarer than making one, and shouldn't sit under a thumb in a list.
    if (isFollowing) {
      return (
        <>
          <TouchableOpacity
            style={[iconStyles.btn, iconStyles.more]}
            onPress={() => setMenuOpen(true)}
            disabled={busy}
            activeOpacity={0.8}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Options for @${username}`}
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MoreHorizontal size={20} color="#FFFFFF" />}
          </TouchableOpacity>
          <ActionSheet
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            title={`@${username}`}
            options={[{ label: 'Unfollow', Icon: UserMinus, destructive: true, onPress: handlePress }]}
          />
        </>
      );
    }

    return (
      <TouchableOpacity
        style={[iconStyles.btn, { backgroundColor: brand }, unknown && iconStyles.disabled]}
        onPress={unknown ? () => refetch() : handlePress}
        disabled={busy || unknown}
        activeOpacity={0.8}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Follow @${username}`}
      >
        {busy ? <ActivityIndicator size="small" color={brandText} /> : <UserPlus size={17} color={brandText} strokeWidth={2.4} />}
      </TouchableOpacity>
    );
  }

  // Nothing sensible to offer: we asked and couldn't find out. Shown rather
  // than hidden so the row doesn't change shape, and disabled so it can't
  // send a follow whose result we'd have no way to reflect.
  if (!skip && isError && resolved === undefined) {
    return <Button label="Follow" onPress={() => refetch()} variant="dark" size="sm" radius={radius} minWidth={minWidth} disabled />;
  }

  return (
    <Button
      label={isFollowing ? 'Following' : 'Follow'}
      onPress={handlePress}
      variant={variant ?? (isFollowing ? 'secondary' : 'dark')}
      size="sm"
      radius={radius}
      background={isFollowing ? followingBackground : undefined}
      minWidth={minWidth}
      loading={busy}
    />
  );
}

const iconStyles = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  // Just the dots — the menu is housekeeping, not an invitation. Keeps the
  // button's footprint, so the row's edge lines up whether followed or not.
  more:     { backgroundColor: 'transparent' },
});
