import React from 'react';
import { StyleSheet } from 'react-native';
import { useFollowUserMutation, useUnfollowUserMutation, useGetFollowStatusQuery } from '../../api/apiService';
import Button from '../ui/Button';

interface FollowButtonProps {
  username: string;
}

export default function FollowButton({ username }: FollowButtonProps) {
  const { data, isLoading } = useGetFollowStatusQuery(username);
  const [follow, { isLoading: following }] = useFollowUserMutation();
  const [unfollow, { isLoading: unfollowing }] = useUnfollowUserMutation();

  const isFollowing = data?.following ?? false;
  const busy = following || unfollowing;

  const handlePress = async () => {
    if (isFollowing) {
      await unfollow(username);
    } else {
      await follow(username);
    }
  };

  if (isLoading) return null;

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

const styles = StyleSheet.create({});
