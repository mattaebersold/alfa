import React from 'react';
import { View, StyleSheet } from 'react-native';
import Avatar, { type AvatarUser } from './Avatar';
import SteeringWheel from './SteeringWheel';
import { COLOR_BLACK, COLOR_PRO } from '../../constants/config';

/** Whether a member is Pro — admins included, as everywhere else. */
export function isProUser(user?: { accountType?: string | null } | null): boolean {
  return user?.accountType === 'pro' || user?.accountType === 'admin';
}

/**
 * A member's photo, with the Pro ring round it and the steering wheel on its
 * corner when they're Pro — as MemberRow wears them. Not Pro, it's a plain
 * Avatar.
 *
 * The ring takes its width out of the photo, so the whole thing is `size`
 * either way and a row doesn't shift between a Pro member and anyone else.
 */
export default function ProAvatar({ user, size, pro, edge = false }: {
  user?: AvatarUser | null;
  size: number;
  /** Draw the ring and wheel. */
  pro: boolean;
  /** Avatar's 1pt edge, when not Pro — inside the ring it read as a second border. */
  edge?: boolean;
}) {
  if (!pro) return <Avatar user={user} size={size} edge={edge} />;
  const ring = Math.max(2, Math.round(size * 0.06));
  const badge = Math.round(size * (size > 56 ? 0.34 : 0.46));
  return (
    <View style={[styles.ring, { width: size, height: size, borderWidth: ring }]}>
      <Avatar user={user} size={size - ring * 2} edge={false} />
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, bottom: -badge * 0.18, right: -badge * 0.18 }]}>
        <SteeringWheel size={Math.round(badge * 0.78)} color={COLOR_BLACK} strokeWidth={2.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tight to the photo — no dark gap between the ring and the picture.
  ring:  { borderColor: COLOR_PRO, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', backgroundColor: COLOR_PRO, alignItems: 'center', justifyContent: 'center' },
});
