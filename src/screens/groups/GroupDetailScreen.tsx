import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, Pressable, FlatList, Alert,
  Animated, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, MessageSquare, MessageCircle, Newspaper, Users, MoreVertical,
  Car, Calendar, ShoppingBag, BookOpen, Settings, Plus, Check, X, UserPlus,
} from 'lucide-react-native';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
  useGetGroupCarsQuery,
  useGetUserGarageQuery,
  useUpdateCarGroupMutation,
} from '../../api/apiService';
import type { GarageCar } from '../../types/api';
import GroupSettingsSheet from '../../components/groups/GroupSettingsSheet';
import FollowButton from '../../components/social/FollowButton';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import SharedButton from '../../components/ui/SharedButton';
import Spinner from '../../components/ui/Spinner';
import { colors, withAlpha } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import CarSummaryModal from '../../components/cars/CarSummaryModal';
import UserSummaryModal from '../../components/members/UserSummaryModal';
import GroupInviteModal from '../../components/groups/GroupInviteModal';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_GAP = 12;
/** Faces shown in the strip before the rest collapse into a "+N" circle. */
const AVATAR_PREVIEW = 9;
/** Rows added each time the roster list reaches its end. */
const MEMBER_PAGE_SIZE = 25;
const TILE_WIDTH = (SCREEN_WIDTH - TILE_GAP * 3) / 2;

const SECTIONS = [
  { key: 'posts',     label: 'Posts',     Icon: MessageSquare, color: '#4A90D9' },
  { key: 'forum',     label: 'Forum',     Icon: MessageCircle, color: '#7B68EE' },
  { key: 'news',      label: 'News',      Icon: Newspaper,     color: '#E67E22' },
  { key: 'members',   label: 'Members',   Icon: Users,         color: '#2ECC71' },
  { key: 'cars',      label: 'Cars',      Icon: Car,           color: '#E74C3C' },
  { key: 'events',    label: 'Events',    Icon: Calendar,      color: '#F39C12' },
  { key: 'market',    label: 'Market',    Icon: ShoppingBag,   color: '#1ABC9C' },
  { key: 'resources', label: 'Resources', Icon: BookOpen,      color: '#95A5A6' },
];

export default function GroupDetailScreen() {
  const route = useRoute<{ key: string; name: string; params: { groupId: string } }>();
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [carModalOpen, setCarModalOpen] = useState(false);
  // A car opens as a summary rather than a page push — see CarSummaryModal.
  const [carSummary, setCarSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  const [rosterOrigin, setRosterOrigin] = useState<SummaryOrigin | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** Invite search revealed inside the roster panel rather than as a sheet. */
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The roster arrives in one response, so paging is done here: render a page
  // at a time and grow as you reach the end, rather than mounting hundreds of
  // rows at once.
  const [memberPage, setMemberPage] = useState(1);

  const headerPad = useHeaderPad();
  const { width: screenW } = useWindowDimensions();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [backPinned, setBackPinned] = useState(false);

  const { data: group, isLoading, refetch: refetchGroup } = useGetGroupQuery(groupId);
  const { data: members = [], refetch: refetchMembers }   = useGetGroupMembersQuery(groupId);
  // Coming back from elsewhere — the notifications list, most often, where a
  // join request gets approved — the roster here has to reflect that decision.
  useRefetchOnFocus(refetchMembers);
  useRefetchOnFocus(refetchGroup);
  const { data: groupCarsData, refetch: refetchCars } = useGetGroupCarsQuery(groupId);
  const refreshControl = useRefreshControl(() =>
    Promise.all([refetchGroup(), refetchMembers(), refetchCars()]));
  const { data: garageData }       = useGetUserGarageQuery(undefined, { skip: !carModalOpen });
  const [join,  { isLoading: joining }]  = useJoinGroupMutation();
  const [leave, { isLoading: leaving }]  = useLeaveGroupMutation();
  const [updateCarGroup] = useUpdateCarGroupMutation();

  const groupCars = groupCarsData?.entries ?? [];
  const myCars = garageData?.entries ?? [];

  // ── Back button that survives the scroll ────────────────────────────────
  // The banner carries the title and the back circle, and both scroll away
  // with it. A second circle fades in where the banner's has gone, under the
  // app header rather than behind its logo button, so there is always a way
  // back without scrolling to the top to find one.
  const bannerH = screenW * 2 / 3;   // matches styles.banner's 3:2
  const pinFrom = bannerH * 0.30;
  const pinTo   = bannerH * 0.55;
  const pinnedOpacity = scrollY.interpolate({
    inputRange: [pinFrom, pinTo], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const pinnedShift = scrollY.interpolate({
    inputRange: [pinFrom, pinTo], outputRange: [-8, 0], extrapolate: 'clamp',
  });
  // Opacity alone still takes taps, so the button has to be told to stand
  // down while it's invisible — hence the state alongside the animation.
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
      listener: (e: any) => {
        const past = e.nativeEvent.contentOffset.y > pinFrom;
        setBackPinned((was) => (was === past ? was : past));
      },
    }),
    [scrollY, pinFrom],
  );

  if (isLoading || !group) return <Spinner fullScreen />;

  const banner   = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  /**
   * Only people who have actually joined.
   *
   * `getGroupMembers` returns every row — active, pending and invited — when no
   * status is passed, so counting the raw list here reported a group as bigger
   * than it is, and disagreed with both the group card (which counts active
   * server-side) and the Members tab (which filters the same way).
   */
  const activeMembers = members.filter((m) => m.status === 'active');
  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  const isPending = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'pending');
  // Active admins only. Without the status check an invited-but-not-joined
  // admin would see Settings before actually being in the group.
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin' && m.status === 'active');
  const canManageCars = isMember || isAdmin;

  const goToSection = (initialTab: string) => {
    (navigation as any).navigate('GroupSection', { groupId, groupTitle: group.title, initialTab });
  };

  const tiles = [
    ...SECTIONS,
    ...(isAdmin ? [{ key: 'settings', label: 'Settings', Icon: Settings, color: '#666' }] : []),
  ];

  // Whoever runs the group, for "Message admin". First active admin — a group
  // can have several and any of them can field a question.
  const groupAdmin = members.find((m) => m.member_type === 'admin' && m.status === 'active');

  // Admins lead the roster; everyone else keeps the order the server sent.
  const roster = [...activeMembers].sort(
    (a, b) => (a.member_type === 'admin' ? 0 : 1) - (b.member_type === 'admin' ? 0 : 1),
  );

  const openGroupMenu = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];

    if (groupAdmin?.user_id && groupAdmin.user_id !== userInfo?.user_id) {
      options.push({
        text: 'Message admin',
        onPress: () => (navigation as any).navigate('ComposeMessage', {
          userId: groupAdmin.user_id,
          username: groupAdmin.user?.username,
        }),
      });
    }

    if (isMember) {
      options.push({
        text: 'Leave group',
        style: 'destructive',
        onPress: () => Alert.alert('Leave this group?', `You'll lose access to ${group.title}.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => leave(groupId) },
        ]),
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(group.title ?? 'Group', undefined, options);
  };

  // Nothing to offer a logged-out visitor who isn't a member and has no admin
  // to write to — hide the button rather than open an empty sheet.
  const hasMenuOptions = isMember || (!!groupAdmin?.user_id && groupAdmin.user_id !== userInfo?.user_id);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={[]}>
      {/* No spacer — the header floats so the banner starts at the very top of
          the viewport, the way the profile screen's cover does. */}
      <AppHeader />
      <Animated.ScrollView
        refreshControl={refreshControl}
        style={{ backgroundColor: c.cream }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >

        {/* Banner */}
        <View style={styles.bannerWrap}>
          {banner
            ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
            : <View style={[styles.banner, { backgroundColor: c.primaryAlt }]} />
          }
          {/* A flat wash over the whole image, so the photo sits back and
              anything laid over it reads regardless of how bright it is. */}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.card, 0.3) }]}
            pointerEvents="none"
          />
          {/* Darkens the top so the floating header reads over the image. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={styles.bannerTopScrim}
            pointerEvents="none"
          />
          {/* Fades the bottom into the page so the banner has no hard edge.
              Lands on `card`, not `cream`: whatever sits directly under the
              banner — the title card or the members strip — is a card surface,
              and fading to the page colour left a visible seam between them.
              Three stops rather than two, since a straight linear ramp reads as
              a band starting mid-image where an eased one doesn't. */}
          <LinearGradient
            colors={[withAlpha(c.card, 0), withAlpha(c.card, 0.72), c.card]}
            locations={[0, 0.55, 1]}
            style={styles.bannerFade}
            pointerEvents="none"
          />
          {/* Title sits on the banner itself, in the faded band at its foot,
              with the back control leading it rather than floating top-left. */}
          <View style={styles.bannerTitleWrap}>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: c.borderDark }]}
              onPress={() => navigation.goBack()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={22} color={c.fg} />
            </TouchableOpacity>
            <Text style={[styles.groupTitle, { color: c.fg }]} numberOfLines={2}>{group.title}</Text>
            {group.subtitle ? (
              <View style={[styles.taglinePill, { backgroundColor: c.secondary, borderColor: c.borderDark }]}>
                <Text style={[styles.taglineText, { color: c.fg }]} numberOfLines={1}>{group.subtitle}</Text>
              </View>
            ) : null}
          </View>

          {hasMenuOptions && (
            <TouchableOpacity
              style={[styles.bannerMenuBtn, { backgroundColor: c.secondary, borderColor: c.borderDark }]}
              onPress={openGroupMenu}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Group options"
            >
              <MoreVertical size={20} color={c.fg} />
            </TouchableOpacity>
          )}
        </View>

        {/* Join / pending. Rendered only when there's something to show — with
            the region gone and Leave moved to the ⋮ menu, a member would
            otherwise get an empty padded card under the banner. */}
        {!isMember && (
          <View style={[styles.titleCard, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }} />
              {isPending ? (
                <View style={styles.pendingWrap}>
                  <Text style={[styles.pendingLabel, { color: c.grey }]}>Waiting for approval</Text>
                  <SharedButton label="Cancel" variant="outline" onPress={() => leave(groupId)} loading={leaving} />
                </View>
              ) : (
                <SharedButton label="Join" onPress={() => join(groupId)} loading={joining} />
              )}
            </View>
          </View>
        )}

        {/* Members strip — opens the full roster */}
        {activeMembers.length > 0 && (
          <SummaryTouchable
            // `borderDark`, not `border` — at #202020 against a #1e1e1e card the
            // rule between this and the description below was invisible.
            style={[styles.membersStrip, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}
            onPress={(origin) => {
              setMemberPage(1);
              setRosterOrigin(origin);
              setMembersOpen(true);
            }}
            activeOpacity={0.75}
            accessibilityLabel={`View all ${activeMembers.length} members`}
          >
            <Text style={[styles.memberCount, { color: c.grey }]}>
              {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
            </Text>
            <View style={styles.stripRow}>
              <View style={styles.avatarRow}>
                {activeMembers.slice(0, AVATAR_PREVIEW).map((m) => (
                  <View key={m.user_id} style={styles.avatarWrap}>
                    <Avatar user={m.user} size={30} />
                  </View>
                ))}
                {activeMembers.length > AVATAR_PREVIEW && (
                  <View style={[styles.avatarWrap, styles.overflowChip, { backgroundColor: c.secondary, borderColor: c.card }]}>
                    <Text style={[styles.overflowChipText, { color: c.fg }]}>
                      +{activeMembers.length - AVATAR_PREVIEW}
                    </Text>
                  </View>
                )}
              </View>

              {/* Anyone in the group can ask someone in — a club grows by its
                  members knowing people, not by its admins doing the asking.
                  It sits on the strip rather than inside the roster panel: the
                  point of the faces is who's here, and the next thought is who
                  else should be. Its own touchable, so the tap that invites
                  doesn't also open the roster underneath it. */}
              {(isMember || isAdmin) && (
                <TouchableOpacity
                  style={[styles.stripInvite, { backgroundColor: c.primaryAlt }]}
                  onPress={() => setInviteOpen(true)}
                  activeOpacity={0.85}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Invite someone to this group"
                >
                  <UserPlus size={14} color="#000000" strokeWidth={2.6} />
                  <Text style={styles.stripInviteText}>Invite</Text>
                </TouchableOpacity>
              )}
            </View>
          </SummaryTouchable>
        )}

        {/* Description */}
        {group.body && (
          <View style={[styles.bodyBlock, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <Text style={[styles.bodyText, { color: c.fg }]}>{stripHtml(group.body)}</Text>
          </View>
        )}

        {/* Members/admins only: everything below the description */}
        {(isMember || isAdmin) && (<>
        {/* Cars in this group */}
        <View style={styles.carsSection}>
          <View style={styles.carsHeaderRow}>
            <Text style={[styles.carsHeading, { color: c.grey }]}>CARS IN THIS GROUP</Text>
            {canManageCars && (
              <TouchableOpacity
                style={[styles.associateBtn, { backgroundColor: c.primaryAlt }]}
                onPress={() => setCarModalOpen(true)}
                activeOpacity={0.85}
              >
                <Plus size={13} color="#000000" strokeWidth={3} />
                <Text style={styles.associateBtnText}>Add car</Text>
              </TouchableOpacity>
            )}
          </View>
          {groupCars.length === 0 ? (
            <Text style={[styles.carsEmpty, { color: c.grey }]}>No cars associated with this group yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carsScroll}>
              {groupCars.map((car) => {
                const img = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
                return (
                  <SummaryTouchable
                    key={car.internal_id}
                    style={[styles.groupCarCard, { backgroundColor: c.card }]}
                    onPress={(origin) => setCarSummary({ carId: car.internal_id, origin })}
                    activeOpacity={0.88}
                  >
                    {img
                      ? <Image source={{ uri: img }} style={styles.groupCarImg} contentFit="cover" />
                      : <View style={[styles.groupCarImg, { backgroundColor: c.segment }]} />}
                    <Text style={[styles.groupCarTitle, { color: c.fg }]} numberOfLines={1}>
                      {[car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Car'}
                    </Text>
                  </SummaryTouchable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Section tiles */}
        <View style={styles.tilesSection}>
          <Text style={[styles.tilesHeading, { color: c.grey }]}>SECTIONS</Text>
          <View style={styles.tilesGrid}>
            {tiles.map(({ key, label, Icon, color }) => (
              <TouchableOpacity
                key={key}
                style={[styles.tile, { backgroundColor: c.card }]}
                onPress={() => key === 'settings'
                  ? setSettingsOpen(true)
                  : goToSection(key)
                }
                activeOpacity={0.75}
              >
                <View style={[styles.tileIconWrap, { backgroundColor: color + '22' }]}>
                  <Icon size={28} color={color} strokeWidth={1.8} />
                </View>
                <Text style={[styles.tileLabel, { color: c.fg }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        </>)}

      </Animated.ScrollView>

      {/* Sits below the app header's row, not in it — the top-left of that row
          is the logo button. */}
      <Animated.View
        style={[styles.backPinned, { top: headerPad + 6, opacity: pinnedOpacity, transform: [{ translateY: pinnedShift }] }]}
        pointerEvents={backPinned ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: c.borderDark }]}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
      </Animated.View>

      {/* Add car modal. Fades rather than slides — the sheet is nearly
          full-height, so a slide reads as a page transition. */}
      <Modal visible={carModalOpen} transparent animationType="fade" onRequestClose={() => setCarModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCarModalOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: c.cream }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.sheetTitle, { color: c.fg }]}>Add car</Text>
              <TouchableOpacity onPress={() => setCarModalOpen(false)} hitSlop={8}>
                <X size={22} color={c.grey} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetHint, { color: c.grey }]}>Tap a car to add or remove it from this group.</Text>
            <FlatList
              data={myCars}
              keyExtractor={(car: GarageCar) => car.internal_id}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => {
                const associated = item.group_id === groupId;
                const img = firstGalleryUrl(item.gallery) ?? (item.profile_image ? imageUrl(item.profile_image) : null);
                return (
                  <TouchableOpacity
                    style={[styles.carPickRow, { borderBottomColor: c.border }]}
                    onPress={() => updateCarGroup({ carId: item.internal_id, groupId: associated ? null : groupId })}
                    activeOpacity={0.7}
                  >
                    {img
                      ? <Image source={{ uri: img }} style={styles.carPickThumb} contentFit="cover" />
                      : <View style={[styles.carPickThumb, { backgroundColor: c.segment }]} />}
                    <Text style={[styles.carPickTitle, { color: c.fg }]} numberOfLines={1}>
                      {[item.year, item.make, item.model].filter(Boolean).join(' ') || item.title || 'Car'}
                    </Text>
                    <View style={[styles.carCheck, { borderColor: associated ? c.primaryAlt : c.border }, associated && { backgroundColor: c.primaryAlt }]}>
                      {associated && <Check size={14} color="#000000" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.carsEmpty, { color: c.grey }]}>You have no cars in your garage yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── Members roster ──
          A summary of the group's people, in the same panel the cars and the
          members themselves use, rather than a slide-up sheet of its own. The
          rows are mapped rather than listed: SummaryModal brings its own
          scroller, and a FlatList inside one is a scroller inside a scroller. */}
      <SummaryModal
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        origin={rosterOrigin}
        actionLabel="View All Members"
        onAction={() => (navigation as any).navigate('GroupMembers', { groupId })}
      >
        {/* Just the count now — inviting moved out to the members strip, where
            the faces already are. */}
        <View style={styles.rosterHead}>
          <Text style={[styles.rosterTitle, { color: c.fg }]}>
            {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {roster.slice(0, memberPage * MEMBER_PAGE_SIZE).map((item) => {
            const isMe = item.user_id === userInfo?.user_id;
            return (
              // The row opens the member's summary; the follow button stays as
              // an inline shortcut. The ⋮ menu it replaces offered "message"
              // and "view profile", both of which the summary carries.
              <SummaryTouchable
                key={item.user_id}
                style={[styles.memberRow, { borderBottomColor: c.borderDark }]}
                onPress={(origin) => {
                  // The roster is itself a modal; a second one over it fights
                  // for the screen, so close this first.
                  setMembersOpen(false);
                  requestAnimationFrame(() => setUserSummary({ userId: item.user_id, origin }));
                }}
              >
                <Avatar
                  user={item.user}
                  size={40}
                />
                <View style={styles.memberNameWrap}>
                  <Text style={[styles.memberName, { color: c.fg }]} numberOfLines={1}>
                    @{item.user?.username ?? 'member'}
                  </Text>
                  {item.member_type === 'admin' && (
                    <View style={[styles.adminPill, { backgroundColor: c.secondary }]}>
                      <Text style={[styles.adminPillText, { color: c.fg }]}>Admin</Text>
                    </View>
                  )}
                </View>
                {/* No point offering to follow yourself. */}
                {!isMe && item.user?.username ? (
                  <FollowButton username={item.user.username} />
                ) : null}

              </SummaryTouchable>
            );
        })}

        {/* A page at a time, on request. Without a list underneath there's
            nothing to reach the end of. */}
        {memberPage * MEMBER_PAGE_SIZE < roster.length && (
          <TouchableOpacity
            style={styles.rosterMore}
            onPress={() => setMemberPage((p) => p + 1)}
            activeOpacity={0.75}
          >
            <Text style={[styles.rosterMoreText, { color: c.primaryAlt }]}>
              Show more
            </Text>
          </TouchableOpacity>
        )}
      </SummaryModal>

      <GroupSettingsSheet
        groupId={groupId}
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        // Every screen in this stack is a view of the group that just stopped
        // existing, so popping one would only land on another of them.
        onDeleted={() => navigation.popToTop()}
      />

      <CarSummaryModal
        carId={carSummary?.carId ?? null}
        origin={carSummary?.origin}
        onClose={() => setCarSummary(null)}
      />

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />

      <GroupInviteModal
        groupId={groupId}
        groupTitle={group.title}
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:       { paddingBottom: 120 },

  rosterHead:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 16, paddingTop: 18, paddingBottom: 10,
    // Clear of the panel's floating close button (38pt, inset 12).
    paddingRight: 62,
  },
  rosterTitle:   { fontSize: 19, fontWeight: '800' },
  rosterMore:    { paddingVertical: 16, alignItems: 'center' },
  rosterMoreText:{ fontSize: 14, fontWeight: '700' },

  bannerWrap:   { position: 'relative' },
  // Short enough to stay a header rather than a hero, while leaving the
  // floating app header and the overlaid title room to sit on the image.
  banner:       { width: '100%', aspectRatio: 3 / 2 },
  bannerTopScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  // Over half the banner: the eased ramp needs the distance, and it's what
  // keeps the fade from reading as a band across the photo.
  bannerFade:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' },
  bannerTitleWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    // Right inset clears the ⋮ button so a long title doesn't run under it.
    paddingLeft: 16, paddingRight: 66, paddingBottom: 14,
    alignItems: 'flex-start', gap: 8,
  },
  taglinePill:  {
    alignSelf: 'flex-start', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  taglineText:  { fontSize: 12, fontWeight: '600' },
  // In flow above the title now, not floating over the top-left of the image.
  backBtn:      {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  backPinned:   {
    position: 'absolute', left: 12,
    // Above the floating app header's own 20, so nothing in the row can paint
    // over it on the frame it fades in.
    zIndex: 25, elevation: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  bannerMenuBtn: {
    position: 'absolute', right: 16, bottom: 14,
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  titleCard:    { padding: 16, borderBottomWidth: 1 },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupTitle:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  groupRegion:  { fontSize: 13 },
  joinBtn:      {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.primaryAlt, alignSelf: 'flex-start', flexShrink: 0,
  },
  joinBtnText:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  pendingWrap:  { alignItems: 'flex-end', gap: 6 },
  pendingLabel: { fontSize: 12, fontWeight: '600', fontStyle: 'italic' },

  membersStrip: { padding: 14, paddingTop: 0, borderBottomWidth: 1 },
  membersHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  memberCount:  { fontSize: 12, marginBottom: 6, fontWeight: '700' },
  // The faces take what they need and the button holds the right edge, so a
  // group of two doesn't leave it floating in the middle of the strip.
  stripRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'nowrap' },
  stripInvite:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  stripInviteText: { fontSize: 12, fontWeight: '800', color: '#000000' },
  avatarWrap:   { marginRight: -6 },
  // Reads as one more face in the stack, so it needs the same 30px circle and
  // a ring in the strip's own colour to keep the overlap legible.
  overflowChip: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  overflowChipText: { fontSize: 11, fontWeight: '800' },

  memberRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The name column absorbs the squeeze so the follow button and menu keep
  // their full width on a long username.
  memberNameWrap: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  memberName:   { fontSize: 15, fontWeight: '600' },
  memberMenuBtn:{ padding: 2 },
  adminPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  adminPillText:{ fontSize: 10, fontWeight: '800' },

  bodyBlock:    { padding: 16, borderBottomWidth: 1 },
  bodyText:     { fontSize: 15, lineHeight: 22 },

  carsSection:   { paddingTop: 18 },
  carsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: TILE_GAP, marginBottom: 10 },
  carsHeading:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  associateBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  associateBtnText: { color: '#000000', fontSize: 12, fontWeight: '700' },
  carsEmpty:     { paddingHorizontal: TILE_GAP, fontSize: 13, paddingVertical: 4 },
  carsScroll:    { paddingHorizontal: TILE_GAP, gap: 10 },
  groupCarCard:  { width: 150, borderRadius: 12, overflow: 'hidden' },
  groupCarImg:   { width: '100%', height: 100 },
  groupCarTitle: { fontSize: 13, fontWeight: '700', padding: 8 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:         { maxHeight: '80%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle:    { fontSize: 17, fontWeight: '800' },
  sheetHint:     { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  carPickRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  carPickThumb:  { width: 54, height: 40, borderRadius: 6 },
  carPickTitle:  { flex: 1, fontSize: 14, fontWeight: '600' },
  carCheck:      { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  tilesSection: { paddingHorizontal: TILE_GAP, paddingTop: 20 },
  tilesHeading: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12 },
  tilesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
  tile:         {
    width: TILE_WIDTH,
    paddingVertical: 20, paddingHorizontal: 16,
    borderRadius: 14, alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  tileIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileLabel:    { fontSize: 15, fontWeight: '700' },
});
