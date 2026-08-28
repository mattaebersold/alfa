import React, { useState } from 'react';
import { Alert } from 'react-native';
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
export default function FollowButton({ username, isFollowing: known }: FollowButtonProps) {
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

  // Nothing sensible to offer: we asked and couldn't find out. Shown rather
  // than hidden so the row doesn't change shape, and disabled so it can't
  // send a follow whose result we'd have no way to reflect.
  if (!skip && isError && resolved === undefined) {
    return <Button label="Follow" onPress={() => refetch()} variant="dark" size="sm" disabled />;
  }

  return (
    <Button
      label={isFollowing ? 'Following' : 'Follow'}
      onPress={handlePress}
      variant={isFollowing ? 'secondary' : 'dark'}
      size="sm"
      loading={busy}
    />
  );
}
