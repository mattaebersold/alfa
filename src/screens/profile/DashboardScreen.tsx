import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, CarFront, FileText, Users, UserPlus, Flag, UserCheck, X, Trash2, LogOut, ShieldAlert, RotateCcw, ExternalLink, MessageSquare, Image as ImageIcon, Bell, Star, Archive, ArrowRightLeft, ShoppingBag, BellRing } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetUserStatsQuery,
  useGetUserGarageQuery,
  useGetPostsQuery,
  useDeleteAccountMutation,
  useGetBlockedUsersQuery,
  useUnblockUserMutation,
  useGetFollowedCarsQuery,
  useGetArchivedGarageQuery,
  useGetPendingCarTransfersQuery,
  useRestoreCarMutation,
  useAcceptCarTransferMutation,
  useDeclineCarTransferMutation,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useGetFlaggedContentQuery,
  useRemoveContentMutation,
  useRestoreContentMutation,
  useGetUsageQuery,
  useGetMyListingsQuery,
  useGetAlertsQuery,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { removeBlockedUser } from '../../store/moderationSlice';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import FeedItemCard from '../../components/cards/FeedItemCard';
import HomeBannerManager from '../../components/feed/HomeBannerManager';
import FeaturedManager from '../../components/admin/FeaturedManager';
import CarPosterCard from '../../components/cards/CarPosterCard';
import SharedButton from '../../components/ui/SharedButton';
import SharedModal from '../../components/ui/SharedModal';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { CAR_LIMIT_BASIC } from '../../constants/limits';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { useViewableIds } from '../../hooks/useViewableIds';
import MemberRow from '../../components/members/MemberRow';
import UsagePanel from '../../components/pro/UsagePanel';
import { ManageListingsPane } from '../../components/marketplace/ManageListingsEntry';
import MarketplaceUnreadBadge, { useMarketplaceUnread } from '../../components/marketplace/MarketplaceUnreadBadge';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type SheetType = 'cars' | 'posts' | 'blocked' | 'flagged' | 'followedCars' | 'archivedCars' | 'homeBanner' | 'featured' | 'marketplace' | null;
type FlaggedContentType = 'post' | 'car' | 'comment' | 'user';

function SheetModal({
  visible,
  title,
  onClose,
  children,
  colors,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[{ flex: 1, backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
        <View style={[sheetStyles.header, { borderBottomColor: colors.border }]}>
          <Text style={[sheetStyles.title, { color: colors.fg }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={colors.fg} /></TouchableOpacity>
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

/**
 * One car in the archived list.
 *
 * Three states share this row, and they want different buttons:
 *   archived        — Restore puts it back on the profile
 *   offered by you  — nothing to restore until the offer is answered; Cancel
 *   offered to you  — Accept takes it, Decline sends it back
 */
function ArchivedCarRow({ car, incoming, colors, onOpen }: {
  car: GarageCar;
  /** This car was offered *to* the viewer, rather than put away by them. */
  incoming: boolean;
  colors: ReturnType<typeof useColors>;
  onOpen: () => void;
}) {
  const [restoreCar, { isLoading: restoring }] = useRestoreCarMutation();
  const [acceptTransfer, { isLoading: accepting }] = useAcceptCarTransferMutation();
  const [declineTransfer, { isLoading: declining }] = useDeclineCarTransferMutation();
  const busy = restoring || accepting || declining;

  const name = [car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Car';
  const thumb = firstGalleryUrl(car.gallery)
    ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  const pending = !!car.transfer_to_id;

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    try { await fn(); } catch (err: any) { Alert.alert('Error', err?.data?.error || failure); }
  };

  return (
    <View style={[archivedStyles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity style={archivedStyles.main} onPress={onOpen} activeOpacity={0.75}>
        <Image
          source={thumb ? { uri: thumb } : require('../../../assets/car-placeholder.jpg')}
          style={archivedStyles.thumb}
          contentFit="cover"
        />
        <View style={archivedStyles.text}>
          <Text style={[archivedStyles.name, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
          {pending && (
            <View style={archivedStyles.pendingRow}>
              <ArrowRightLeft size={11} color={colors.primaryAlt} />
              <Text style={[archivedStyles.pending, { color: colors.primaryAlt }]} numberOfLines={1}>
                {incoming ? 'Offered to you' : 'Pending transfer'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={archivedStyles.actions}>
        {incoming ? (
          <>
            <TouchableOpacity
              style={[archivedStyles.btn, { backgroundColor: colors.primaryAlt }]}
              onPress={() => run(() => acceptTransfer({ internal_id: car.internal_id }).unwrap(),
                "Couldn't accept that car.")}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={archivedStyles.btnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[archivedStyles.btnGhost, { borderColor: colors.borderDark }]}
              onPress={() => run(() => declineTransfer({ internal_id: car.internal_id }).unwrap(),
                "Couldn't decline that car.")}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={[archivedStyles.btnGhostText, { color: colors.grey }]}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : pending ? (
          // Restoring underneath a live offer would put the car in two places,
          // so the only move here is to call the offer off.
          <TouchableOpacity
            style={[archivedStyles.btnGhost, { borderColor: colors.borderDark }]}
            onPress={() => run(() => declineTransfer({ internal_id: car.internal_id }).unwrap(),
              "Couldn't cancel that transfer.")}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={[archivedStyles.btnGhostText, { color: colors.grey }]}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[archivedStyles.btn, { backgroundColor: colors.primaryAlt }]}
            onPress={() => run(() => restoreCar({ internal_id: car.internal_id }).unwrap(),
              "Couldn't restore that car.")}
            disabled={busy}
            activeOpacity={0.8}
          >
            <RotateCcw size={13} color="#000000" />
            <Text style={archivedStyles.btnText}>Restore</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const archivedStyles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 10 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 56, height: 42, borderRadius: 7 },
  text: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  pending: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: COMMON_RADIUS,
  },
  btnText: { fontSize: 13, fontWeight: '800', color: '#000000' },
  btnGhost: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  btnGhostText: { fontSize: 13, fontWeight: '700' },
});

function FlaggedRow({
  colors, thumb, thumbRound, title, titleLines = 1, user, reportCount,
  onView, onMessage, onRestore, onRemove, restoreLabel = 'Restore', removeLabel = 'Remove',
}: {
  colors: ReturnType<typeof useColors>;
  thumb: string | null;
  thumbRound?: boolean;
  title: string;
  titleLines?: number;
  user?: { username?: string; gallery?: any[] } | null;
  reportCount?: number;
  onView?: () => void;
  onRestore: () => void;
  onRemove?: () => void;
  onMessage?: () => void;
  restoreLabel?: string;
  removeLabel?: string;
}) {
  return (
    <View style={[flaggedStyles.item, { borderBottomColor: colors.border }]}>
      <View style={flaggedStyles.topRow}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={[flaggedStyles.thumb, thumbRound && flaggedStyles.thumbRound]} contentFit="cover" />
        ) : (
          <View style={[flaggedStyles.thumb, thumbRound && flaggedStyles.thumbRound, { backgroundColor: colors.segment, alignItems: 'center', justifyContent: 'center' }]}>
            <FileText size={18} color={colors.grey} />
          </View>
        )}
        <View style={flaggedStyles.body}>
          <Text style={[flaggedStyles.itemTitle, { color: colors.fg }]} numberOfLines={titleLines}>{title}</Text>
          <View style={flaggedStyles.userRow}>
            {user && <Avatar user={user} size={16} />}
            <Text style={[flaggedStyles.itemMeta, { color: colors.muted }]} numberOfLines={1}>
              @{user?.username ?? 'unknown'}{reportCount ? ` · ${reportCount} report${reportCount !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
        </View>
      </View>
      <View style={flaggedStyles.actions}>
        {onView && (
          <TouchableOpacity style={[flaggedStyles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={onView}>
            <ExternalLink size={14} color={colors.fg} />
            <Text style={[flaggedStyles.actionBtnText, { color: colors.fg }]}>View</Text>
          </TouchableOpacity>
        )}
        {onMessage && (
          <TouchableOpacity style={[flaggedStyles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={onMessage}>
            <MessageSquare size={14} color={colors.fg} />
            <Text style={[flaggedStyles.actionBtnText, { color: colors.fg }]}>Message</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[flaggedStyles.actionBtn, { backgroundColor: colors.primaryAlt + '20' }]} onPress={onRestore}>
          <RotateCcw size={14} color={colors.primaryAlt} />
          <Text style={[flaggedStyles.actionBtnText, { color: colors.primaryAlt }]}>{restoreLabel}</Text>
        </TouchableOpacity>
        {onRemove && (
          <TouchableOpacity style={[flaggedStyles.actionBtn, { backgroundColor: colors.red + '20' }]} onPress={onRemove}>
            <Trash2 size={14} color={colors.red} />
            <Text style={[flaggedStyles.actionBtnText, { color: colors.red }]}>{removeLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingBottom: 16, paddingTop: 20,
  },
  title: { fontSize: 17, fontWeight: '700' },
  addCarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 14,
    paddingVertical: 13, borderRadius: COMMON_RADIUS,
  },
  addCarBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default function DashboardScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<ScrollView>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [sheet, setSheet] = useState<SheetType>(null);
  // The My Posts sheet's cards play video inline; this stops one that's
  // scrolled out of the sheet.
  const { listProps: postViewability, isVisible: isPostVisible } =
    useViewableIds<{ internal_id: string }>((p) => p.internal_id);
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [deleteAccount] = useDeleteAccountMutation();
  const { data: followersData } = useGetUserFollowersQuery(
    { userId: userInfo?.user_id ?? '', limit: 100 },
    { skip: !userInfo?.user_id },
  );
  const { data: followingData } = useGetUserFollowingQuery(
    { userId: userInfo?.user_id ?? '', limit: 100 },
    { skip: !userInfo?.user_id },
  );
  const listUsers = (listModal === 'followers' ? followersData?.entries : followingData?.entries) ?? [];

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all content you created. This cannot be undone.\n\nContent created by others that references you (like tags in someone else\'s post) will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Type DELETE to confirm — this is irreversible.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteAccount().unwrap();
                      dispatch(logout());
                    } catch {
                      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const { data: user, isLoading, refetch: refetchUser } = useGetLoggedInUserQuery();
  const { data: stats, refetch: refetchStats } = useGetUserStatsQuery();
  const isPro = useIsPro();
  // Only the basic card reads this, so Pro doesn't pay for the count queries.
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const { data: garageData, refetch: refetchGarage } = useGetUserGarageQuery();
  const { data: postsData } = useGetPostsQuery(
    { user_id: userInfo?.user_id ?? '', limit: 30 },
    { skip: !userInfo?.user_id },
  );
  /**
   * How many alerts are standing — the badge on the row.
   *
   * Cheap and already cached by the alerts screen itself, so the badge is a
   * read rather than a request most of the time. A failure draws no badge
   * rather than a zero: "0" and "didn't load" look identical and mean
   * opposite things.
   */
  const { data: alertsData } = useGetAlertsQuery();
  const alertCount = alertsData?.entries.length ?? 0;
  const { data: blockedData } = useGetBlockedUsersQuery();
  const { data: followedCarsData } = useGetFollowedCarsQuery();
  // Cars put away rather than deleted, plus any offered to this member.
  const { data: archivedData } = useGetArchivedGarageQuery();
  const { data: pendingData } = useGetPendingCarTransfersQuery();
  /**
   * The marketplace, which the dashboard is the signed-in home for.
   *
   * Two separate things on purpose: what you have listed (the tile's count)
   * and what's waiting for you about it (the badge). The badge is the
   * marketplace's own unread count and never the inbox's — they're counted off
   * different collections and neither can move the other.
   */
  const { data: myListings } = useGetMyListingsQuery();
  const { count: marketplaceUnread } = useMarketplaceUnread();
  const [unblockUser] = useUnblockUserMutation();
  // The stat grid is the page — the sheets behind it read the same cache.
  const refreshControl = useRefreshControl(() =>
    Promise.all([refetchUser(), refetchStats(), refetchGarage()]));
  const isAdmin = userInfo?.accountType === 'admin';
  const { data: flaggedData } = useGetFlaggedContentQuery(undefined, { skip: !isAdmin });
  const [removeContent] = useRemoveContentMutation();
  const [restoreContent] = useRestoreContentMutation();

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return null;

  const displayName = user.username;
  const cars = garageData?.entries ?? [];
  const atCarLimit = !isPro && cars.length >= CAR_LIMIT_BASIC;
  const [upsell, setUpsell] = useState(false);
  const posts = postsData?.entries ?? [];
  const blockedUsers = blockedData?.entries ?? [];
  const followedCars = followedCarsData?.entries ?? [];
  const archivedCars = archivedData?.entries ?? [];
  /**
   * The archived list, with cars other people have offered you at the top.
   *
   * An incoming offer isn't in your archive — the car still belongs to the
   * sender — so it's merged in here rather than fetched as part of it, and
   * de-duped in case a car is somehow in both.
   */
  const archivedRows = useMemo(() => {
    const incoming = pendingData?.entries ?? [];
    const seen = new Set(incoming.map((c) => c.internal_id));
    return [...incoming, ...archivedCars.filter((c) => !seen.has(c.internal_id))];
  }, [pendingData, archivedCars]);
  const flaggedPosts = flaggedData?.posts ?? [];
  const flaggedCars = flaggedData?.cars ?? [];
  const flaggedComments = flaggedData?.comments ?? [];
  const flaggedUsers = flaggedData?.users ?? [];
  const totalFlagged = flaggedPosts.length + flaggedCars.length + flaggedComments.length + flaggedUsers.length;

  const handleUnblock = (blockedId: string, username: string) => {
    Alert.alert(
      'Unblock user',
      `Unblock @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser({ blocked_id: blockedId }).unwrap();
              dispatch(removeBlockedUser(blockedId));
            } catch {
              Alert.alert('Error', 'Could not unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRemoveContent = (contentType: FlaggedContentType, contentId: string) => {
    Alert.alert(
      'Remove content',
      'This will permanently delete this content and clear all reports. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContent({ content_type: contentType, content_id: contentId }).unwrap();
            } catch {
              Alert.alert('Error', 'Could not remove content. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRestoreContent = (contentType: FlaggedContentType, contentId: string) => {
    Alert.alert(
      'Restore content',
      'This will clear all reports and make this content visible again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            try {
              await restoreContent({ content_type: contentType, content_id: contentId }).unwrap();
            } catch {
              Alert.alert('Error', 'Could not restore content. Please try again.');
            }
          },
        },
      ]
    );
  };

  const statCards = [
    {
      label: 'Cars',
      count: stats?.garageCarsCount ?? cars.length,
      Icon: Car,
      bg: colors.primaryAlt + '22',
      color: colors.primaryAlt,
      onPress: () => setSheet('cars'),
    },
    {
      label: 'Posts',
      count: stats?.postsCount ?? posts.length,
      Icon: FileText,
      bg: '#e07b3922',
      color: '#e07b39',
      onPress: () => setSheet('posts'),
    },
    {
      label: 'Listings',
      count: myListings?.counts.total,
      Icon: ShoppingBag,
      bg: '#3a8a5c22',
      color: '#3a8a5c',
      badge: marketplaceUnread,
      onPress: () => setSheet('marketplace'),
    },
    {
      label: 'Followers',
      count: stats?.followersCount,
      Icon: Users,
      bg: '#5b7fa622',
      color: '#5b7fa6',
      onPress: () => setListModal('followers'),
    },
    {
      label: 'Following',
      count: stats?.followingCount,
      Icon: UserPlus,
      bg: '#7a6abf22',
      color: '#7a6abf',
      onPress: () => setListModal('following'),
    },
    {
      label: 'Events',
      count: stats?.eventsCount,
      Icon: Flag,
      bg: '#c25f5f22',
      color: '#c25f5f',
      onPress: () => navigation.navigate('MainTabs', { screen: 'SocietyTab' }),
    },
    {
      label: 'Groups',
      count: stats?.groupsCount,
      Icon: UserCheck,
      bg: '#3a8a5c22',
      color: '#3a8a5c',
      onPress: () => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Groups' } } as any),
    },
  ];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader spacer />
      <ScrollView ref={scrollRef} refreshControl={refreshControl} style={{ backgroundColor: colors.cream }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })}
          activeOpacity={0.8}
        >
          <Avatar user={user} size={56} />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.fg }]}>@{displayName}</Text>
            {user.bio ? (
              <Text style={[styles.profileBio, { color: colors.muted }]} numberOfLines={2}>{user.bio}</Text>
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                <Text style={[styles.profileBioAdd, { color: colors.primaryAlt }]}>+ Add a bio</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Stat grid */}
        <View style={styles.grid}>
          {statCards.map((card) => (
            <TouchableOpacity
              key={card.label}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={card.onPress}
              activeOpacity={0.75}
            >
              <View style={[styles.statIcon, { backgroundColor: card.bg }]}>
                <card.Icon size={18} color={card.color} />
                {/* Only the marketplace tile carries one today — a count of
                    things waiting, over a count of things you have. */}
                <MarketplaceUnreadBadge count={(card as { badge?: number }).badge ?? 0} />
              </View>
              <Text style={[styles.statCount, { color: colors.fg }]}>
                {card.count ?? '–'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.grey }]}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* What the membership allows and how much is spent — full width, in
            the member's own colour. Basic accounts only: Pro has no limits, so
            the card was a list of counts with nothing to measure them against. */}
        {!isPro && usage && (
          <UsagePanel
            cars={usage.cars}
            posts={usage.posts}
            events={usage.events}
            listings={usage.listings}
            alerts={usage.alerts}
          />
        )}

        {/* Quick actions */}
        <View style={[styles.actions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <UserCheck size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Account Settings</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          {/* Its own row rather than a section inside Account Settings. What
              reaches your phone is a different question from your password and
              your handle, and it's the one people come back to change. */}
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('NotificationSettings')} activeOpacity={0.7}>
            <Bell size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Notification Settings</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          {/* Next to Notification Settings on purpose: that row decides how
              you're told about things that already involve you, and this one
              decides what else is worth telling you about. Same question, two
              halves. */}
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Alerts')} activeOpacity={0.7}>
            <BellRing size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Custom Alerts</Text>
            {!!alertCount && (
              <View style={[styles.countBadge, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countBadgeText, { color: colors.grey }]}>{alertCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          {/* Selling, in the two halves it actually splits into: the things
              you've listed, and the people asking about them. Both are the
              marketplace's own — neither appears in Messages. */}
          <TouchableOpacity style={styles.actionRow} onPress={() => setSheet('marketplace')} activeOpacity={0.7}>
            <ShoppingBag size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Manage your listings</Text>
            {!!myListings?.counts.total && (
              <View style={[styles.countBadge, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countBadgeText, { color: colors.grey }]}>{myListings.counts.total}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => navigation.navigate('MarketplaceMessages')}
            activeOpacity={0.7}
          >
            <MessageSquare size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Marketplace messages</Text>
            {/* Inline rather than floating: there's a line to sit at the end
                of here, and the row has no icon corner to hang off. */}
            <MarketplaceUnreadBadge count={marketplaceUnread} variant="inline" />
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => setSheet('followedCars')} activeOpacity={0.7}>
            <Car size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Followed Cars</Text>
            {followedCars.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countBadgeText, { color: colors.grey }]}>{followedCars.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => setSheet('archivedCars')} activeOpacity={0.7}>
            <Archive size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Archived Cars</Text>
            {archivedCars.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countBadgeText, { color: colors.grey }]}>{archivedCars.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => setSheet('blocked')} activeOpacity={0.7}>
            <Users size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Blocked Users</Text>
            {blockedUsers.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countBadgeText, { color: colors.grey }]}>{blockedUsers.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => dispatch(logout())} activeOpacity={0.7}>
            <LogOut size={16} color={colors.red} />
            <Text style={[styles.actionLabel, { color: colors.red }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Admin */}
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[styles.flaggedRow, { borderColor: '#e07b3940', backgroundColor: '#e07b3910' }]}
              onPress={() => setSheet('flagged')}
              activeOpacity={0.75}
            >
              <ShieldAlert size={15} color="#e07b39" />
              <Text style={[styles.flaggedLabel, { color: '#e07b39' }]}>
                ADMIN: View Flagged Content
                {totalFlagged > 0 ? ` (${totalFlagged})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.flaggedRow, { borderColor: '#e07b3940', backgroundColor: '#e07b3910' }]}
              onPress={() => setSheet('homeBanner')}
              activeOpacity={0.75}
            >
              <ImageIcon size={15} color="#e07b39" />
              <Text style={[styles.flaggedLabel, { color: '#e07b39' }]}>
                ADMIN: Home Feature Banner
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.flaggedRow, { borderColor: '#e07b3940', backgroundColor: '#e07b3910' }]}
              onPress={() => setSheet('featured')}
              activeOpacity={0.75}
            >
              <Star size={15} color="#e07b39" />
              <Text style={[styles.flaggedLabel, { color: '#e07b39' }]}>
                ADMIN: Featured Members & Cars
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Danger zone */}
        <TouchableOpacity
          style={[styles.deleteRow, { borderColor: colors.red + '40', backgroundColor: colors.red + '10' }]}
          onPress={handleDeleteAccount}
          activeOpacity={0.75}
        >
          <Trash2 size={15} color={colors.red} />
          <Text style={[styles.deleteLabel, { color: colors.red }]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cars sheet */}
      <SheetModal visible={sheet === 'cars'} title="My Cars" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={cars}
          keyExtractor={(c) => c.internal_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <SharedButton
              label="Add New Car"
              Icon={Car}
              // At the basic limit this can't open the form — the server would
              // refuse the save anyway. The garage screen's button has always
              // worked this way; this one navigated straight through.
              onPress={() => {
                setSheet(null);
                if (atCarLimit) setUpsell(true);
                else navigation.navigate('CarCreate', {});
              }}
              style={{ marginHorizontal: 16, marginVertical: 14 }}
            />
          }
          renderItem={({ item }) => (
            <CarPosterCard
              car={item}
              onBeforeNavigate={() => setSheet(null)}
              onEditPress={() => { setSheet(null); navigation.navigate('CarCreate', { carId: item.internal_id }); }}
            />
          )}
          ListEmptyComponent={<EmptyState title="No cars yet" message="Your garage is empty. Add your first car above." />}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      {/* Posts sheet */}
      <SheetModal visible={sheet === 'posts'} title="My Posts" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.internal_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          {...postViewability}
          renderItem={({ item }) => (
            <FeedItemCard
              post={item}
              onPress={() => { setSheet(null); navigation.navigate('PostDetailModal', { postId: item.internal_id }); }}
              visible={isPostVisible(item.internal_id)}
            />
          )}
          ListEmptyComponent={<EmptyState title="No posts yet" />}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      {/* Your listings: what's up, what you're after, what's gone — with the
          quick actions a seller reaches for. The pane is shared with the
          marketplace's own entry point, so the two can't drift. */}
      <SheetModal visible={sheet === 'marketplace'} title="Your listings" onClose={() => setSheet(null)} colors={colors}>
        <ManageListingsPane navigate={(go) => { setSheet(null); go(); }} />
      </SheetModal>

      {/* Followed cars sheet */}

      <SheetModal visible={sheet === 'followedCars'} title="Followed Cars" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={followedCars}
          keyExtractor={(c) => c.internal_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <CarPosterCard car={item} showOwner onBeforeNavigate={() => setSheet(null)} />
          )}
          ListEmptyComponent={<EmptyState title="No followed cars" message="Cars you follow will appear here." />}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title="Unlimited garage with Pro"
        message={`A basic membership holds ${CAR_LIMIT_BASIC} cars. Pro removes the limit — every car you've owned, kept in one place.`}
      />

      {/* Archived cars sheet — where a car goes instead of being deleted, and
          where one offered to you waits to be accepted. */}
      <SheetModal visible={sheet === 'archivedCars'} title="Archived Cars" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={archivedRows}
          keyExtractor={(c) => c.internal_id}
          contentContainerStyle={{ paddingBottom: 40, gap: 10 }}
          renderItem={({ item }) => (
            <ArchivedCarRow
              car={item}
              incoming={item.transfer_to_id === userInfo?.user_id}
              colors={colors}
              onOpen={() => { setSheet(null); navigation.navigate('CarDetail', { carId: item.internal_id }); }}
            />
          )}
          ListEmptyComponent={(
            <EmptyState
              title="Nothing archived"
              message="Cars you archive instead of deleting show up here, and you can restore them any time."
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      {/* Blocked users sheet */}
      <SheetModal visible={sheet === 'blocked'} title="Blocked Users" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={blockedUsers}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[blockedStyles.row, { borderBottomColor: colors.border }]}>
              <Avatar user={item} size={40} />
              <Text style={[blockedStyles.name, { color: colors.fg, flex: 1 }]}>@{item.username}</Text>
              <TouchableOpacity
                style={[blockedStyles.unblockBtn, { borderColor: colors.border }]}
                onPress={() => handleUnblock(item.user_id, item.username)}
                activeOpacity={0.7}
              >
                <Text style={[blockedStyles.unblockText, { color: colors.primaryAlt }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No blocked users" message="Users you block will appear here." />}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      {/* Admin: home feature banner sheet */}
      {isAdmin && (
        <SheetModal visible={sheet === 'homeBanner'} title="Home Feature Banner" onClose={() => setSheet(null)} colors={colors}>
          <HomeBannerManager />
        </SheetModal>
      )}

      {/* Admin: featured members & cars sheet */}
      {isAdmin && (
        <SheetModal visible={sheet === 'featured'} title="Featured Members & Cars" onClose={() => setSheet(null)} colors={colors}>
          <FeaturedManager />
        </SheetModal>
      )}

      {/* Admin: flagged content sheet */}
      {isAdmin && (
        <SheetModal visible={sheet === 'flagged'} title="Content Moderation" onClose={() => setSheet(null)} colors={colors}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {flaggedPosts.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Posts ({flaggedPosts.length})
                </Text>
                {flaggedPosts.map((p) => (
                  <FlaggedRow
                    key={p.internal_id}
                    colors={colors}
                    thumb={firstGalleryUrl(p.gallery)}
                    title={p.title || (p.body ? p.body.slice(0, 60) : 'Untitled post')}
                    user={p.user}
                    reportCount={p.report_count}
                    onView={() => { setSheet(null); (navigation as any).navigate('PostDetailModal', { postId: p.internal_id }); }}
                    onRestore={() => handleRestoreContent('post', p.internal_id)}
                    onRemove={() => handleRemoveContent('post', p.internal_id)}
                  />
                ))}
              </>
            )}
            {flaggedCars.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Cars ({flaggedCars.length})
                </Text>
                {flaggedCars.map((c) => (
                  <FlaggedRow
                    key={c.internal_id}
                    colors={colors}
                    thumb={firstGalleryUrl(c.gallery) ?? (c.profile_image ? imageUrl(c.profile_image) : null)}
                    title={[c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled car'}
                    user={c.user}
                    reportCount={c.report_count}
                    onView={() => { setSheet(null); (navigation as any).navigate('CarDetail', { carId: c.internal_id }); }}
                    onRestore={() => handleRestoreContent('car', c.internal_id)}
                    onRemove={() => handleRemoveContent('car', c.internal_id)}
                  />
                ))}
              </>
            )}
            {flaggedComments.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Comments ({flaggedComments.length})
                </Text>
                {flaggedComments.map((c) => {
                  const parentPostId = c.post_id ?? c.entity_id;
                  return (
                    <FlaggedRow
                      key={c.internal_id ?? c._id}
                      colors={colors}
                      thumb={null}
                      title={c.body || 'No text'}
                      titleLines={2}
                      user={c.user}
                      reportCount={c.report_count}
                      onView={parentPostId ? () => { setSheet(null); (navigation as any).navigate('PostDetailModal', { postId: parentPostId }); } : undefined}
                      onRestore={() => handleRestoreContent('comment', c.internal_id ?? c._id)}
                      onRemove={() => handleRemoveContent('comment', c.internal_id ?? c._id)}
                    />
                  );
                })}
              </>
            )}
            {flaggedUsers.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Users ({flaggedUsers.length})
                </Text>
                {flaggedUsers.map((u) => {
                  const uid = u.user_id ?? u.internal_id;
                  const banned = u._banned;
                  return (
                    <FlaggedRow
                      key={uid}
                      colors={colors}
                      thumb={u.gallery?.[0]?.filename ? imageUrl(u.gallery[0].filename) : null}
                      thumbRound
                      title={`@${u.username || 'Unknown user'}${banned ? '  ·  BANNED' : ''}`}
                      user={u}
                      reportCount={u.report_count}
                      onView={() => { setSheet(null); (navigation as any).navigate('UserDetail', { userId: uid }); }}
                      onMessage={() => { setSheet(null); (navigation as any).navigate('ComposeMessage', { userId: uid, username: u.username }); }}
                      onRestore={() => handleRestoreContent('user', uid)}
                      onRemove={banned ? undefined : () => handleRemoveContent('user', uid)}
                      restoreLabel={banned ? 'Unban' : 'Dismiss'}
                      removeLabel="Ban"
                    />
                  );
                })}
              </>
            )}
            {totalFlagged === 0 && (
              <EmptyState title="No flagged content" message="Content reported by users will appear here." />
            )}
          </ScrollView>
        </SheetModal>
      )}

      {/* Followers / Following — shared modal */}
      <SharedModal
        visible={listModal !== null}
        onClose={() => setListModal(null)}
        title={listModal === 'followers' ? 'Followers' : 'Following'}
      >
        <FlatList
          data={listUsers}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            /* The same row the members list uses. It was an avatar and a handle
               before — no pro marking, and no way to follow someone back from
               the one screen that exists to show you who followed you. */
            <MemberRow
              user={item}
              onPress={() => {
                setListModal(null);
                (navigation as any).navigate('UserDetail', { userId: item.user_id, username: item.username });
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState title={listModal === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />
          }
          showsVerticalScrollIndicator={false}
        />
      </SharedModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:        { padding: 16, gap: 14, paddingBottom: 160 },

  profileCard:    {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 16, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  profileText:    { flex: 1 },
  profileName:    { fontSize: 18, fontWeight: '800' },
  profileUsername: { fontSize: 14, marginTop: 2 },
  profileBio:     { fontSize: 13, marginTop: 6, lineHeight: 18 },
  profileBioAdd:  { fontSize: 13, marginTop: 6 },

  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:       {
    width: '48%', padding: 16, borderRadius: COMMON_RADIUS, borderWidth: 1, gap: 8,
    flexGrow: 0,
  },
  statIcon:       {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  statCount:      { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  statLabel:      { fontSize: 14, fontWeight: '700' },

  actions:        { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  actionRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  actionLabel:    { fontSize: 15, fontWeight: '600', flex: 1 },
  actionDivider:  { height: 1, marginHorizontal: 16 },
  deleteRow:      {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  deleteLabel:    { fontSize: 14, fontWeight: '600' },
  flaggedRow:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  flaggedLabel:   { fontSize: 14, fontWeight: '600' },
  countBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: PILL_RADIUS },
  countBadgeText: { fontSize: 12, fontWeight: '700' },
});

const blockedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  name:        { fontSize: 15, fontWeight: '600' },
  unblockBtn:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: COMMON_RADIUS, borderWidth: 1 },
  unblockText: { fontSize: 13, fontWeight: '700' },
});


const flaggedStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  item: {
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb:     { width: 52, height: 52, borderRadius: 8 },
  thumbRound: { borderRadius: 26 },
  body:      { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  userRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemMeta:  { fontSize: 12, flex: 1 },
  actions:   { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: COMMON_RADIUS,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
