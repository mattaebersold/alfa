import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useGetLoggedInUserQuery, useGetUserGarageQuery, useGetPostsQuery } from '../../api/apiService';
import { useFeedPreferences } from '../../hooks/useFeedPreferences';
import { ProfilePhotoSheet, BioSheet } from './ProfileSetupSheets';
import { colors } from '../../constants/colors';
import type { SetupPrompt } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** In the order they're asked: a face, a line about you, your car, then a first post. */
const STEPS: { key: SetupPrompt; title: string; sub: string }[] = [
  { key: 'photo', title: 'Add a profile photo', sub: 'So members know who they’re talking to' },
  { key: 'bio',   title: 'Add a bio',           sub: 'A line or two about you and what you drive' },
  { key: 'car',   title: 'Add a car to your garage', sub: 'The first thing people look at on a profile' },
  { key: 'post',  title: 'Create your first post',   sub: 'Say hello, or show off what you’ve been working on' },
];

/**
 * "Finish setting up your profile" — what's still missing, as a short list.
 *
 * A step shows only while it's both undone and not dismissed. Doing the thing
 * clears it on its own (the checks read the live profile and garage), and the
 * ✕ clears it for good whether or not it was done — some people don't want a
 * photo up, and being asked every time they open the menu is nagging.
 * Dismissals live on the account, so they hold on every device. Once nothing
 * is left, the card is gone.
 *
 * The numbers are red notification bubbles on purpose: each one is a thing
 * waiting on you, the same as a count on the bell.
 */
export default function ProfileSetupCard({ onGo }: {
  /**
   * Take the member elsewhere for the steps that need a whole screen — a car's
   * form has too many fields for a sheet, and a post has its own composer.
   * Photo and bio are finished right here, in sheets over the menu.
   */
  onGo: (step: 'car' | 'post') => void;
}) {
  const [sheet, setSheet] = useState<'photo' | 'bio' | null>(null);
  // The live profile rather than the auth slice's copy, which is written at
  // sign-in and wouldn't see a photo or bio added since.
  const { data: user } = useGetLoggedInUserQuery();
  const { data: garage, isLoading: garageLoading } = useGetUserGarageQuery();
  // One post is all it takes to know. The posts list rather than the profile
  // stats, because publishing invalidates this and not those — the step clears
  // the moment the first post goes up, not on the next stats refresh.
  const { data: myPosts, isLoading: postsLoading } = useGetPostsQuery(
    { user_id: user?.user_id ?? '', limit: 1 },
    { skip: !user?.user_id },
  );
  const { dismissedSetupPrompts, dismissSetupPrompt } = useFeedPreferences();

  // Nothing until every check has an answer, or a step would flash up and
  // vanish as its query landed.
  if (!user || garageLoading || postsLoading) return null;

  const done: Record<SetupPrompt, boolean> = {
    // Either field: an upload writes `gallery`, a Google sign-up `profilePicture`.
    photo: !!user.gallery?.length || !!user.profilePicture,
    bio: !!user.bio?.trim(),
    car: (garage?.entries?.length ?? 0) > 0,
    post: (myPosts?.entries?.length ?? 0) > 0,
  };

  const remaining = STEPS.filter((s) => !done[s.key] && !dismissedSetupPrompts.includes(s.key));

  const sheets = (
    <>
      <ProfilePhotoSheet visible={sheet === 'photo'} onClose={() => setSheet(null)} />
      <BioSheet visible={sheet === 'bio'} onClose={() => setSheet(null)} />
    </>
  );

  // The card goes when the last step does — but a sheet that just finished
  // that step is still animating away, so it outlives the card rather than
  // vanishing mid-slide.
  if (!remaining.length) return sheets;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Finish setting up your profile</Text>

      {remaining.map((step, i) => (
        <View key={step.key} style={[styles.row, i > 0 && styles.rowDivided]}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => (
              step.key === 'photo' || step.key === 'bio' ? setSheet(step.key) : onGo(step.key)
            )}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={step.title}
          >
            {/* Counted over what's left, so the list always reads 1, 2, 3
                rather than skipping the steps already done. */}
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{i + 1}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{step.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{step.sub}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dismiss}
            onPress={() => dismissSetupPrompt(step.key)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss: ${step.title}`}
          >
            <X size={12} color="rgba(255,255,255,0.75)" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      ))}

      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  // The drawer's own tile grey, so it sits with the rest of the menu rather
  // than competing with the gold callout above it.
  card: {
    marginBottom: 10,
    paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4,
    borderRadius: COMMON_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heading: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  bubble: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  rowSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  dismiss: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
});
