import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Users, Lock, MapPin, ChevronUp, Plus } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import AvatarStack from '../ui/AvatarStack';
import SummaryUserRow from '../members/SummaryUserRow';
import SummaryMessageButton from '../members/SummaryMessageButton';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useGetGroupQuery, useGetGroupMembersQuery, useJoinGroupMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { regionLabel } from '../../constants/regions';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/**
 * A group, answered in place.
 *
 * The questions a group's name raises from somewhere else in the app — what is
 * this, who's in it, is it the kind of thing I'd join — all used to cost a
 * screen push and a scroll back. This answers them over whatever you were
 * reading.
 *
 * Only a member is offered the way into the group. Everyone else gets a Join
 * button beside the title, which settles on "Requested" for as long as the
 * request is pending. That state is the server's pending membership, so it
 * survives closing the panel and relaunching the app.
 *
 * The panel, its animation and that button are SummaryModal's; this only
 * supplies what a group's summary is.
 */
export default function GroupSummaryModal({
  groupId,
  origin,
  onClose,
}: {
  /** The group to summarise. `null` closes the panel. */
  groupId: string | null;
  /** The tile that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const myId = useAppSelector((st) => st.auth.userInfo?.user_id);

  const { data: group, isLoading } = useGetGroupQuery(groupId ?? '', { skip: !groupId });
  const { data: members } = useGetGroupMembersQuery(groupId ?? '', { skip: !groupId });
  const [join, { isLoading: joining }] = useJoinGroupMutation();

  // The member list folds open in place; each open starts folded.
  const [membersExpanded, setMembersExpanded] = useState(false);
  useEffect(() => { if (groupId) setMembersExpanded(false); }, [groupId]);

  // A member's summary opens over this one rather than replacing it, so you
  // can look at a few people and still be in the group you were deciding about.
  const { openUser, stacked } = useStackedUserSummary(!!groupId);

  const active = (members ?? []).filter((m) => m.status === 'active');
  // Admins first, the way the group's own roster orders them.
  const roster = [...active].sort(
    (a, b) => (a.member_type === 'admin' ? 0 : 1) - (b.member_type === 'admin' ? 0 : 1),
  );
  const memberCount = active.length;
  // Whoever runs the group, for "Message admin" — the same rule as the group's
  // own page: the first active admin, since any of them can field a question.
  const groupAdmin = active.find((m) => m.member_type === 'admin');
  const mine = myId ? members?.find((m) => m.user_id === myId) : undefined;
  const isMember = mine?.status === 'active';
  const isPending = mine?.status === 'pending';
  // An invitation is already a yes from the group — joining takes you straight in.
  const isInvited = mine?.status === 'invited';

  const requestToJoin = async () => {
    if (!groupId) return;
    try {
      await join(groupId).unwrap();
    } catch (err: any) {
      Alert.alert("Couldn't send your request", err?.data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  // Nothing to offer until the roster says where you stand.
  const rosterKnown = !!groupId && !!members;
  const banner = firstGalleryUrl(group?.banners) ?? firstGalleryUrl(group?.gallery);
  const body = group?.body ? stripHtml(group.body) : '';
  const region = regionLabel(group?.region);

  return (
    <SummaryModal
      visible={!!groupId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Group"
      onAction={rosterKnown && isMember ? () => nav.navigate('GroupDetail', { groupId }) : undefined}
      stacked={stacked}
    >
      {isLoading || !group ? (
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View>
          {/* The banner leads, because a group's picture is most of what tells
              you what kind of group it is. */}
          {banner ? (
            <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.blank, { backgroundColor: colors.segment }]}>
              <Users size={26} color={colors.grey} />
            </View>
          )}

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{group.title}</Text>
              {rosterKnown && !isMember && (
                isPending ? (
                  <View style={[styles.joinBtn, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.joinText, { color: colors.grey }]}>Requested</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.joinBtn, { backgroundColor: brand }]}
                    onPress={requestToJoin}
                    disabled={joining}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    // An invitation's join is an acceptance — say so to a
                    // screen reader, where there's no invite context on screen.
                    accessibilityLabel={isInvited ? 'Accept invitation and join' : 'Request to join'}
                  >
                    {joining ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <>
                        <Plus size={14} color="#000000" strokeWidth={2.8} />
                        <Text style={[styles.joinText, styles.onBrand]}>Join</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )
              )}
            </View>
            {group.subtitle ? (
              <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
                {group.subtitle}
              </Text>
            ) : null}

            {/* Counts and qualifiers, not sentences — the icons say what each
                one is. */}
            <View style={styles.badges}>
              {region ? (
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <MapPin size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>{region}</Text>
                </View>
              ) : null}
              {group.private ? (
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <Lock size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>Private</Text>
                </View>
              ) : null}
            </View>

            {body ? (
              <Text style={[styles.about, { color: colors.muted }]} numberOfLines={6}>{body}</Text>
            ) : null}

            {/* Someone to ask — most of all before you're in, when the group's
                page is closed to you. Not offered to the admin it would write
                to, which would be a thread with yourself. */}
            {groupAdmin && groupAdmin.user_id !== myId ? (
              <View style={styles.messageRow}>
                <SummaryMessageButton
                  userId={groupAdmin.user_id}
                  username={groupAdmin.user?.username}
                  label="Message admin"
                />
              </View>
            ) : null}

            {/* Who's in it — the faces first, and the names when you ask. */}
            {roster.length > 0 && (
              <View style={[styles.membersBlock, { borderTopColor: colors.borderDark }]}>
                <TouchableOpacity
                  style={styles.membersToggle}
                  onPress={() => setMembersExpanded((v) => !v)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: membersExpanded }}
                  accessibilityLabel={membersExpanded ? 'Hide members' : `Show all ${memberCount} members`}
                >
                  {membersExpanded ? (
                    <>
                      <Text style={[styles.membersLabel, { color: colors.fg }]}>
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </Text>
                      <ChevronUp size={16} color={colors.grey} />
                    </>
                  ) : (
                    // Ringed in the panel's own black — see SummaryModal.
                    <AvatarStack users={roster.map((m) => m.user)} ringColor="#000000" />
                  )}
                </TouchableOpacity>

                {/* A bounded scroller of its own inside the panel's. Unbounded,
                    a big group's roster pushed everything else out of a panel
                    that tops out at 90% of the screen, and the panel's own
                    scroll had to travel the whole roster to get back up.
                    `nestedScrollEnabled` is what lets it scroll at all inside
                    another scroller on Android; iOS nests without it. */}
                {membersExpanded && (
                  <ScrollView
                    style={styles.memberList}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                  >
                    {roster.map((m) => (
                      <SummaryUserRow
                        key={m.user_id}
                        userId={m.user_id}
                        user={m.user}
                        onOpen={openUser}
                        style={[styles.memberRow, { borderTopColor: colors.borderDark }]}
                        badge={m.member_type === 'admin' ? (
                          <View style={[styles.adminPill, { backgroundColor: colors.segment }]}>
                            <Text style={[styles.adminPillText, { color: colors.fg }]}>Admin</Text>
                          </View>
                        ) : null}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  banner:  { width: '100%', height: 130 },
  blank:   { alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 18, paddingBottom: 22, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title:    { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  joinBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 76, paddingHorizontal: 12, paddingVertical: 7, marginTop: 1,
    borderRadius: COMMON_RADIUS,
  },
  joinText: { fontSize: 13, fontWeight: '800' },
  onBrand:  { color: '#000000' },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: -2 },
  badges:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  about:     { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  messageRow: { flexDirection: 'row', marginTop: 6 },

  membersBlock:  { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  membersToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingBottom: 4, minHeight: 46,
  },
  membersLabel:  { fontSize: 14, fontWeight: '700' },
  // A ceiling, like the panel's: a short roster gets a short list.
  memberList:    { maxHeight: 300 },
  memberRow:     { borderTopWidth: StyleSheet.hairlineWidth },
  adminPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS },
  adminPillText: { fontSize: 10, fontWeight: '800' },
});
