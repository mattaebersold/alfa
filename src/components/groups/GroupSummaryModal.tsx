import React, { useEffect, useState , useRef} from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import { Users, Lock, MapPin, ChevronUp, Plus } from 'lucide-react-native';
import SummaryModal, { useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import AvatarStack, { AVATAR_STACK_MAX } from '../ui/AvatarStack';
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
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

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

  // The id goes null the moment the close begins, but the panel is still
  // fading for 180ms: keep the last one so the content doesn't flip to a
  // spinner on its way out.
  const lastGroupId = useRef<string | null>(null);
  if (groupId) lastGroupId.current = groupId;
  const shownGroupId = groupId ?? lastGroupId.current;
  const { data: group, isLoading } = useGetGroupQuery(shownGroupId ?? '', { skip: !shownGroupId });
  const { data: members } = useGetGroupMembersQuery(shownGroupId ?? '', { skip: !shownGroupId });
  const [join, { isLoading: joining }] = useJoinGroupMutation();

  // The member list folds open in place; each open starts folded.
  const [membersExpanded, setMembersExpanded] = useState(false);
  /** The row the faces sit in — they're sized so a full one spans it. */
  const [membersW, setMembersW] = useState(0);
  /** The banner's and the members toggle's heights — what's above the open list. */
  const [bannerH, setBannerH] = useState(0);
  const [toggleH, setToggleH] = useState(0);
  const [bannerRatio, setBannerRatio] = useState(16 / 9);
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
      // A pill, as the listing's and the group activity panel's are.
      actionPill
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
          {/* At the picture's own shape (measured as it loads; wide until
              then), capped at square so a tall one can't take the panel.
              Rounded at the foot, so it sits in the panel rather than
              capping it. */}
          <View style={styles.bannerWrap} onLayout={(e) => setBannerH(e.nativeEvent.layout.height)}>
            {banner ? (
              <Image
                source={{ uri: banner }}
                style={[styles.banner, { aspectRatio: bannerRatio }]}
                contentFit="cover"
                onLoad={(e) => {
                  const { width, height } = e.source;
                  if (width && height) setBannerRatio(Math.max(1, width / height));
                }}
              />
            ) : (
              <View style={[styles.banner, styles.blank, { aspectRatio: 16 / 9, backgroundColor: colors.segment }]}>
                <Users size={26} color={colors.grey} />
              </View>
            )}
          </View>

          <View style={styles.body}>
            {/* Folded away while the member list is open, so the list has the
                room; back when it closes. */}
            {!membersExpanded && (
            <>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{group.title}</Text>
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

            {/* The ways in and the way to ask, on one row: Join (or
                Requested) first, then someone to write to — most of all
                before you're in, when the group's page is closed to you.
                Not offered to the admin it would write to. */}
            <View style={styles.actionsRow}>
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
                      <ActivityIndicator size="small" color={COLOR_BLACK} />
                    ) : (
                      <>
                        <Plus size={14} color={COLOR_BLACK} strokeWidth={2.8} />
                        <Text style={[styles.joinText, styles.onBrand]}>Join</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )
              )}
              {groupAdmin && groupAdmin.user_id !== myId ? (
                <SummaryMessageButton
                  userId={groupAdmin.user_id}
                  username={groupAdmin.user?.username}
                  label="Message admin"
                  // The same height as Join beside it.
                  style={styles.messageBtn}
                />
              ) : null}
            </View>
            </>
            )}

            {/* Who's in it — the faces first, and the names when you ask. */}
            {roster.length > 0 && (
              <View style={styles.membersBlock}>
                <TouchableOpacity
                  onLayout={(e) => { setMembersW(e.nativeEvent.layout.width); setToggleH(e.nativeEvent.layout.height); }}
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
                    // Larger faces, with no ring or edge around them.
                    <AvatarStack users={roster.map((m) => m.user)} size={faceSize(membersW)} overlap={FACE_OVERLAP} edge={false} moreColor={COLOR_WHITE} moreTextColor={COLOR_BLACK} />
                  )}
                </TouchableOpacity>

                {/* A bounded scroller of its own inside the panel's. Unbounded,
                    a big group's roster pushed everything else out of a panel
                    that tops out at 90% of the screen, and the panel's own
                    scroll had to travel the whole roster to get back up.
                    `nestedScrollEnabled` is what lets it scroll at all inside
                    another scroller on Android; iOS nests without it. */}
                {membersExpanded && (
                  <MemberListBox above={bannerH + BODY_PAD_TOP + toggleH + LIST_GAP} below={LIST_FOOT}>
                    {roster.map((m) => (
                      <SummaryUserRow
                        key={m.user_id}
                        userId={m.user_id}
                        user={m.user}
                        onOpen={openUser}
                        avatarSize={44}
                        // The row itself opens them; no View button.
                        viewButton={false}
                        style={styles.memberRow}
                        badge={m.member_type === 'admin' ? (
                          // White, like the "+N" — bright enough to spot in the list.
                          <View style={[styles.adminPill, { backgroundColor: COLOR_WHITE }]}>
                            <Text style={[styles.adminPillText, { color: COLOR_BLACK }]}>Admin</Text>
                          </View>
                        ) : null}
                      />
                    ))}
                  </MemberListBox>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

/** The body's top padding, the list's gap under the toggle, and what's left under it. */
const BODY_PAD_TOP = 14;
const LIST_GAP = 6;
// The body's 16 of foot padding, less the members block's pull of 10.
const LIST_FOOT = 6;
/** The open list's tallest, room allowing. */
const LIST_MAX = 420;
/** And its shortest, so a cramped panel still shows a few people. */
const LIST_MIN = 160;

/**
 * The open member list: a grey, rounded box with a scroller of its own.
 *
 * Sized to the room the panel has left under what's above it (`above`) — a
 * fixed height ran past the panel's foot under a tall banner, and the panel's
 * own scroller cut the box off flat there, its rounded foot out of sight.
 * Inside the panel, so it can ask the panel how much room there is.
 */
function MemberListBox({ above, below, children }: { above: number; below: number; children: React.ReactNode }) {
  const panel = useSummaryPanel();
  const fit = panel ? panel.room - above - below : LIST_MAX;
  const maxHeight = Math.max(LIST_MIN, Math.min(LIST_MAX, fit));
  return (
    // `nestedScrollEnabled` is what lets it scroll at all inside the panel's
    // scroller on Android; iOS nests without it.
    <ScrollView
      style={[styles.memberList, { maxHeight, backgroundColor: SURFACE_MID }]}
      contentContainerStyle={styles.memberListContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** How much of each member's face the next covers. */
const FACE_OVERLAP = 0.22;
/** Before the row has measured. */
const FACE_FALLBACK = 38;
/**
 * Each face's size, so a full row — the most faces, then the "+N" circle —
 * runs the row's whole width. A smaller group's row is the same size, shorter.
 */
function faceSize(rowW: number): number {
  if (!rowW) return FACE_FALLBACK;
  const n = AVATAR_STACK_MAX + 1;
  // n faces, each but the last losing FACE_OVERLAP of itself to the next.
  return Math.floor(rowW / (n - (n - 1) * FACE_OVERLAP));
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  bannerWrap: { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  banner:  { width: '100%' },
  blank:   { alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 14, paddingBottom: 16, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title:    { flex: 1, fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3 },
  joinBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 76, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: COMMON_RADIUS,
  },
  joinText: { fontSize: 13, fontFamily: FONT_INTER.extrabold },
  onBrand:  { color: COLOR_BLACK },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: -2 },
  badges:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  about:     { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageBtn: { paddingVertical: 8 },

  // Straight under the actions: no rule, no extra room.
  // Pulled into the body's foot padding, so less room under the faces.
  membersBlock:  { marginTop: 0, marginBottom: -10 },
  membersToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 2, paddingBottom: 0, minHeight: 40,
  },
  membersLabel:  { fontSize: 14, fontFamily: FONT_INTER.bold },
  // A ceiling, like the panel's: a short roster gets a short list.
  // A grey box of its own, so where the scroll window ends is plain.
  memberList:    { borderRadius: COMMON_RADIUS, overflow: 'hidden', marginTop: LIST_GAP },
  memberListContent: { paddingHorizontal: 12, paddingVertical: 6 },
  // No rule between people; a little closer together than the row's own 9.
  memberRow:     { paddingVertical: 6 },
  adminPill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS },
  adminPillText: { fontSize: 10, fontFamily: FONT_INTER.extrabold },
});
