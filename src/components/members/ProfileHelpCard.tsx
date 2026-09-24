import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import MemberRow from './MemberRow';
import { ProfilePhotoSheet, BioSheet } from './ProfileSetupSheets';
import { CarCreateSheet } from '../../screens/garage/CarCreateScreen';
import { useGetLoggedInUserQuery, useGetUsersQuery, useGetFollowStatusesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { COMMON_RADIUS } from '../../constants/radius';

type Step = 'photo' | 'bio' | 'car' | 'follow';

const STEPS: { key: Step; title: string; sub: string }[] = [
  { key: 'photo',  title: 'Add a profile photo',  sub: 'So members know who they’re talking to' },
  { key: 'bio',    title: 'Add a bio',            sub: 'A line or two about you and what you drive' },
  { key: 'car',    title: 'Add a car to your garage', sub: 'The first thing people look at on a profile' },
  { key: 'follow', title: 'Follow some members',  sub: 'Fill your feed with people and their cars' },
];

/** How many members the follow panel suggests. */
const SUGGESTIONS = 8;

/**
 * "Finish setting up your profile", on the profile itself — the car page's
 * setup card (CarSetupCard), for a member.
 *
 * Shown only on your own profile, and a step only while it's undone: no
 * photo, no bio, an empty garage, following nobody. Each is checked live, so
 * doing one clears it. Photo and bio open the same sheets the menu's
 * checklist uses; a car opens the add-car form in place; following opens a
 * panel of members to follow without leaving the page.
 */
export default function ProfileHelpCard({ carCount, followingCount }: {
  carCount: number;
  followingCount: number;
}) {
  // The live profile rather than the page's copy, so a photo or bio saved in
  // a sheet clears its step the moment the profile refetches.
  const { data: me } = useGetLoggedInUserQuery();
  const [sheet, setSheet] = useState<'photo' | 'bio' | 'car' | null>(null);
  const [follow, setFollow] = useState<{ origin: SummaryOrigin | null } | null>(null);

  if (!me) return null;

  const done: Record<Step, boolean> = {
    photo: !!me.gallery?.length || !!(me as any).profilePicture,
    bio: !!me.bio?.trim(),
    car: carCount > 0,
    follow: followingCount > 0,
  };
  const remaining = STEPS.filter((s) => !done[s.key]);

  const panels = (
    <>
      <ProfilePhotoSheet visible={sheet === 'photo'} onClose={() => setSheet(null)} />
      <BioSheet visible={sheet === 'bio'} onClose={() => setSheet(null)} />
      {/* Mounted to open, like the menu's — it runs its own close. */}
      {sheet === 'car' && <CarCreateSheet onDismissed={() => setSheet(null)} />}
      <SummaryModal visible={!!follow} origin={follow?.origin} onClose={() => setFollow(null)}>
        <FollowSuggestions myId={me.user_id} />
      </SummaryModal>
    </>
  );

  // Whatever finished the last step is still closing — it outlives the card.
  if (!remaining.length) return panels;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Finish setting up your profile</Text>
      {remaining.map((step, i) => (
        <SummaryTouchable
          key={step.key}
          style={[styles.row, i > 0 && styles.rowDivided]}
          onPress={(origin) => (step.key === 'follow' ? setFollow({ origin }) : setSheet(step.key))}
          activeOpacity={0.7}
          accessibilityLabel={step.title}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{i + 1}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{step.title}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>{step.sub}</Text>
          </View>
        </SummaryTouchable>
      ))}
      {panels}
    </View>
  );
}

/**
 * Members to follow, in the panel. The members list's own rows, with their
 * follow buttons, so following is done right here; a row opens that member,
 * and the foot goes to everyone.
 */
function FollowSuggestions({ myId }: { myId: string }) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const { data } = useGetUsersQuery({ page: 0, limit: SUGGESTIONS + 1 });
  const members = (data?.entries ?? []).filter((u) => u.user_id !== myId).slice(0, SUGGESTIONS);
  const usernames = members.map((u) => u.username).filter(Boolean) as string[];
  const { data: followData } = useGetFollowStatusesQuery(usernames, { skip: usernames.length === 0 });

  const go = (name: string, params?: object) => {
    const run = () => nav.navigate(name, params);
    if (panel) panel.closeThen(run); else run();
  };

  return (
    <View style={styles.follow}>
      <View style={styles.followHead}>
        <Text style={[styles.followTitle, { color: colors.fg }]}>Follow some members</Text>
        <Text style={[styles.followHint, { color: colors.grey }]}>
          Their posts and cars show up in your feed.
        </Text>
      </View>
      {members.map((u) => (
        <MemberRow
          key={u.user_id}
          user={u}
          plain
          showStats={false}
          isFollowing={u.username ? followData?.statuses?.[u.username] : undefined}
          onPress={() => go('UserDetail', { userId: u.user_id, username: u.username })}
        />
      ))}
      <TouchableOpacity style={styles.allBtn} onPress={() => go('Members')} activeOpacity={0.8}>
        <Text style={[styles.allText, { color: colors.primaryAlt }]}>See all members</Text>
        <ChevronRight size={15} color={colors.primaryAlt} />
      </TouchableOpacity>
    </View>
  );
}

/** The help prompts' ground — shared look with CarSetupCard. */
const HELP_BG = '#121212';

const styles = StyleSheet.create({
  // CarSetupCard's look, which is the menu checklist's.
  card: {
    marginVertical: 20,
    paddingHorizontal: 13, paddingTop: 12, paddingBottom: 4,
    borderRadius: COMMON_RADIUS,
    backgroundColor: HELP_BG,
  },
  heading: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  bubble: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: palette.red,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  rowSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  follow: { paddingTop: 18, paddingBottom: 8 },
  followHead: { paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  followTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  followHint: { fontSize: 13, lineHeight: 18 },
  allBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 14 },
  allText: { fontSize: 14, fontWeight: '700' },
});
