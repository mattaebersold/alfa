import React, { useState, useMemo, useRef } from 'react';
import DeclinedInvitesSheet from '../../components/groups/DeclinedInvitesSheet';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Text, useGetPhotoSpotUsageQuery } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserX, Car, CarFront, FileText, Users, UserPlus, Flag, UserCheck, X, Trash2, LogOut, ShieldAlert, RotateCcw, ExternalLink, MessageSquare, Image as ImageIcon, Bell, Star, Archive, ArrowRightLeft, ShoppingBag, BellRing, ListOrdered, ChevronRight, Settings, Ban } from 'lucide-react-native';
import { Image } from '../../components/ui/AppImage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetUserStatsQuery,
  useGetUserGarageQuery,
  useGetPostsQuery,
  useDeleteAccountMutation,
  useGetBlockedUsersQuery,
  useGetDeclinedInvitesQuery,
  useUnblockUserMutation,
  useGetFollowedCarsQuery,
  useGetArchivedGarageQuery,
  useGetPendingCarTransfersQuery,
  useGetCarTransfersQuery,
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
  useGetListsQuery,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { removeBlockedUser } from '../../store/moderationSlice';
import { useAppSelector } from '../../store/store';
import UserByline from '../../components/members/UserByline';
import DashboardProfileCard from '../../components/profile/DashboardProfileCard';
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
import { firstGalleryUrl, imageUrl, carHeroUrl } from '../../utils/image';
import type { CarTransferEntry, GarageCar } from '../../types/api';
import {
  garageFull, showProGarageFull, GARAGE_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_MUTED_ORANGE,
  COLOR_WHITE,
  PANE_BG,
} from '../../constants/config';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { useViewableIds } from '../../hooks/useViewableIds';
import MemberRow from '../../components/members/MemberRow';
import UsagePanel from '../../components/pro/UsagePanel';
import { ManageListingsPane } from '../../components/marketplace/ManageListingsEntry';
import MarketplaceUnreadBadge, { useMarketplaceUnread } from '../../components/marketplace/MarketplaceUnreadBadge';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<AppStackParamList>;
/** The rule between rows — the profile card's matches it. */
const DIVIDER = 'rgba(255,255,255,0.1)';
type SheetType = 'cars' | 'posts' | 'blocked' | 'flagged' | 'followedCars' | 'archivedCars' | 'homeBanner' | 'featured' | 'marketplace' | 'transfers' | null;
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
      <SafeAreaView style={[{ flex: 1, backgroundColor: PANE_BG }]} edges={['top', 'bottom']}>
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
  const thumb = carHeroUrl(car);
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
            <RotateCcw size={13} color={COLOR_BLACK} />
            <Text style={archivedStyles.btnText}>Restore</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * One handover in Transferred Cars.
 *
 *   offered by you, pending   — Revoke calls it off; the car stays archived with you
 *   offered to you, pending   — Accept or Decline
 *   accepted, either way      — nothing to answer; Message the other owner
 */
function TransferRow({ transfer, colors, onOpenCar, onMessage }: {
  transfer: CarTransferEntry;
  colors: ReturnType<typeof useColors>;
  onOpenCar?: () => void;
  onMessage?: () => void;
}) {
  const [acceptTransfer, { isLoading: accepting }] = useAcceptCarTransferMutation();
  const [declineTransfer, { isLoading: declining }] = useDeclineCarTransferMutation();
  const busy = accepting || declining;

  const { car, other_user: other, status, direction } = transfer;
  const name = (car && ([car.year, car.make, car.model].filter(Boolean).join(' ') || car.title)) || transfer.car_name || 'Car';
  const thumb = carHeroUrl(car);
  const who = other?.username ?? 'a member';
  const when = transfer.resolved_at ?? transfer.requested_at;
  const date = when ? new Date(when).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const line = status === 'pending'
    ? (direction === 'outgoing' ? `Offered to ${who}` : `${who} is offering it to you`)
    : (direction === 'outgoing' ? `Transferred to ${who}` : `Transferred from ${who}`);

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    try { await fn(); } catch (err: any) { Alert.alert('Error', err?.data?.error || failure); }
  };
  const revoke = () => Alert.alert('Revoke this transfer?', `${name} stays archived with you.`, [
    { text: 'Keep it', style: 'cancel' },
    {
      text: 'Revoke', style: 'destructive',
      onPress: () => run(() => declineTransfer({ internal_id: transfer.car_id }).unwrap(), "Couldn't revoke that transfer."),
    },
  ]);

  return (
    <View style={[archivedStyles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity style={archivedStyles.main} onPress={onOpenCar} disabled={!onOpenCar} activeOpacity={0.75}>
        <Image
          source={thumb ? { uri: thumb } : require('../../../assets/car-placeholder.jpg')}
          style={archivedStyles.thumb}
          contentFit="cover"
        />
        <View style={archivedStyles.text}>
          <Text style={[archivedStyles.name, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
          <View style={archivedStyles.pendingRow}>
            <ArrowRightLeft size={11} color={status === 'pending' ? colors.primaryAlt : colors.grey} />
            <Text style={[archivedStyles.pending, { color: status === 'pending' ? colors.primaryAlt : colors.grey }]} numberOfLines={1}>
              {line}{status === 'accepted' && date ? ` · ${date}` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={archivedStyles.actions}>
        {status === 'pending' && direction === 'incoming' ? (
          <>
            <TouchableOpacity
              style={[archivedStyles.btn, { backgroundColor: colors.primaryAlt }]}
              onPress={() => run(() => acceptTransfer({ internal_id: transfer.car_id }).unwrap(), "Couldn't accept that car.")}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={archivedStyles.btnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[archivedStyles.btnGhost, { borderColor: colors.borderDark }]}
              onPress={() => run(() => declineTransfer({ internal_id: transfer.car_id }).unwrap(), "Couldn't decline that car.")}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={[archivedStyles.btnGhostText, { color: colors.grey }]}>Decline</Text>
            </TouchableOpacity>
          </>
        ) : status === 'pending' ? (
          <TouchableOpacity
            style={[archivedStyles.btnGhost, { borderColor: colors.borderDark }]}
            onPress={revoke}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={[archivedStyles.btnGhostText, { color: colors.grey }]}>Revoke</Text>
          </TouchableOpacity>
        ) : onMessage ? (
          <TouchableOpacity
            style={[archivedStyles.btnGhost, { borderColor: colors.borderDark }]}
            onPress={onMessage}
            activeOpacity={0.8}
          >
            <MessageSquare size={13} color={colors.fg} />
            <Text style={[archivedStyles.btnGhostText, { color: colors.fg }]}>
              {direction === 'outgoing' ? 'Message new owner' : 'Message previous owner'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const archivedStyles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 10 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 56, height: 42, borderRadius: 7 },
  text: { flex: 1 },
  name: { fontSize: 14, fontFamily: FONT_INTER.bold },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  pending: { fontSize: 11, fontFamily: FONT_INTER.semibold },
  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: COMMON_RADIUS,
  },
  btnText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  btnGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  btnGhostText: { fontSize: 13, fontFamily: FONT_INTER.bold },
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
          <UserByline
            user={user}
            size={16}
            gap={6}
            fallback="unknown"
            meta={reportCount ? `${reportCount} report${reportCount !== 1 ? 's' : ''}` : null}
            color={colors.muted}
            nameStyle={flaggedStyles.itemMeta}
          />
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
  title: { fontSize: 17, fontFamily: FONT_INTER.bold },
  addCarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 14,
    paddingVertical: 13, borderRadius: COMMON_RADIUS,
  },
  addCarBtnText: { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold },
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
  // Which of the My Posts sheet's cards are on screen, so a video opened from
  // one closes if its card leaves the sheet.
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

  const confirmLogout = () => Alert.alert('Log Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: () => dispatch(logout()) },
  ]);

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
  // From the kit's own endpoint rather than /api/users/usage: pinning and
  // removing a spot go through the kit's API, which refreshes this one.
  const { data: spotUsage } = useGetPhotoSpotUsageQuery(undefined, { skip: isPro });
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
  // The same arguments the profile's Lists pane uses, so this is the same
  // cache entry and the badge can't disagree with the pane the row opens.
  // Lists attached to a car are left out of both — they live on the car's page.
  const { data: myLists } = useGetListsQuery(
    { user_id: userInfo?.user_id ?? '', car_id: 'none', limit: 50 },
    { skip: !userInfo?.user_id },
  );
  const listCount = myLists?.total ?? 0;
  const { data: blockedData } = useGetBlockedUsersQuery();
  const { data: declinedData } = useGetDeclinedInvitesQuery();
  const declinedCount = declinedData?.entries?.length ?? 0;
  const [declinedOpen, setDeclinedOpen] = useState(false);
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

  const cars = garageData?.entries ?? [];
  const atCarLimit = garageFull(isPro, cars.length);
  const [upsell, setUpsell] = useState(false);
  const posts = postsData?.entries ?? [];
  const blockedUsers = blockedData?.entries ?? [];
  const followedCars = followedCarsData?.entries ?? [];
  const archivedCars = archivedData?.entries ?? [];
  const { data: transfersData } = useGetCarTransfersQuery();
  const transfers = transfersData?.entries ?? [];
  /** Offers made to you and still waiting on your answer. */
  const transfersWaiting = transfers.filter((t) => t.status === 'pending' && t.direction === 'incoming').length;
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

  type DashRow = { label: string; Icon: typeof Car; count?: number; badge?: number; danger?: boolean; onPress: () => void };
  /** Your account's settings, then what you've made and where it lives. */
  const contentRows: DashRow[] = [
    { label: 'Account Settings', Icon: Settings, onPress: () => navigation.navigate('Settings') },
    {
      label: 'Posts',
      Icon: FileText,
      count: stats?.postsCount ?? posts.length,
      onPress: () => setSheet('posts'),
    },
    {
      label: 'Events',
      Icon: Flag,
      count: stats?.eventsCount,
      onPress: () => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Feed', params: { tab: 'events', at: Date.now() } } } as any),
    },
    {
      // The profile's own Lists pane rather than a second place to manage
      // them. Basic members too: its "New list" is where they meet the Pro
      // pitch, and a lapsed Pro still has lists there to tend.
      label: 'Lists',
      Icon: ListOrdered,
      count: listCount,
      onPress: () => (navigation as any).navigate('MainTabs', {
        screen: 'FeedTab', params: { screen: 'Profile', params: { initialTab: 'lists' } },
      }),
    },
  ];
  /** Your cars, the ones you follow, the ones put away, and the ones that changed hands. */
  const carRows: DashRow[] = [
    {
      label: 'Cars',
      Icon: Car,
      count: stats?.garageCarsCount ?? cars.length,
      onPress: () => setSheet('cars'),
    },
    {
      label: 'Followed Cars',
      Icon: CarFront,
      count: followedCars.length || undefined,
      onPress: () => setSheet('followedCars'),
    },
    {
      label: 'Archived Cars',
      Icon: Archive,
      count: archivedCars.length || undefined,
      onPress: () => setSheet('archivedCars'),
    },
    {
      label: 'Transferred Cars',
      Icon: ArrowRightLeft,
      count: transfers.length || undefined,
      badge: transfersWaiting,
      onPress: () => setSheet('transfers'),
    },
  ];
  /** Who follows you, who you follow, and who you've blocked. */
  const peopleRows: DashRow[] = [
    {
      label: 'Followers',
      Icon: UserCheck,
      count: stats?.followersCount,
      onPress: () => setListModal('followers'),
    },
    {
      label: 'Following',
      Icon: UserPlus,
      count: stats?.followingCount,
      onPress: () => setListModal('following'),
    },
    {
      label: 'Blocked Users',
      Icon: Ban,
      count: blockedUsers.length || undefined,
      onPress: () => setSheet('blocked'),
    },
  ];
  /** Your groups, and the ones you turned down — each can be lifted, so the group can ask again (DeclinedInvitesSheet). */
  const groupRows: DashRow[] = [
    {
      label: 'Groups',
      Icon: Users,
      count: stats?.groupsCount,
      onPress: () => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Groups' } } as any),
    },
    {
      label: 'Declined Group Invites',
      Icon: UserX,
      count: declinedCount || undefined,
      onPress: () => setDeclinedOpen(true),
    },
  ];
  /**
   * Selling, in the two halves it splits into: the people asking about your
   * things, and the things themselves. Both are the marketplace's own —
   * neither appears in Messages.
   */
  const marketRows: DashRow[] = [
    {
      label: 'Messages',
      Icon: MessageSquare,
      badge: marketplaceUnread,
      onPress: () => navigation.navigate('MarketplaceMessages'),
    },
    {
      label: 'Manage your listings',
      Icon: ShoppingBag,
      count: myListings?.counts.total || undefined,
      onPress: () => setSheet('marketplace'),
    },
  ];
  /** How you're told about things, and what else is worth telling you about. */
  const notifRows: DashRow[] = [
    {
      // Its own row rather than a section inside Account Settings: what
      // reaches your phone is the one people come back to change.
      label: 'Notification Settings',
      Icon: Bell,
      onPress: () => navigation.navigate('NotificationSettings'),
    },
    {
      label: 'Custom Alerts',
      Icon: BellRing,
      count: alertCount,
      onPress: () => navigation.navigate('Alerts'),
    },
  ];
  /** Admins only. */
  const adminRows: DashRow[] = [
    { label: 'Flagged Content', Icon: ShieldAlert, count: totalFlagged || undefined, onPress: () => setSheet('flagged') },
    { label: 'Home Feature Banner', Icon: ImageIcon, onPress: () => setSheet('homeBanner') },
    { label: 'Featured Members & Cars', Icon: Star, onPress: () => setSheet('featured') },
  ];
  const dangerRows: DashRow[] = [
    { label: 'Delete Account', Icon: Trash2, danger: true, onPress: handleDeleteAccount },
  ];

  /**
   * A group of rows: the icon and title, how many, and the way in. `tint`
   * washes the box and its rows in one colour — the admin box's orange.
   */
  const renderRows = (rows: DashRow[], tint?: string) => (
    <View style={[
      styles.actions,
      tint
        ? { backgroundColor: tint + '10', borderColor: tint + '40' }
        : { backgroundColor: colors.card, borderColor: colors.border },
    ]}>
      {rows.map((row, i) => (
        <React.Fragment key={row.label}>
          {i > 0 && <View style={[styles.actionDivider, tint ? { backgroundColor: tint + '30' } : null]} />}
          {renderRow(row, tint)}
        </React.Fragment>
      ))}
    </View>
  );
  function renderRow(row: DashRow, tint?: string) {
    const ink = tint ?? (row.danger ? colors.red : undefined);
    return (
      <TouchableOpacity style={styles.actionRow} onPress={row.onPress} activeOpacity={0.7}>
        <row.Icon size={19} color={ink ?? COLOR_WHITE} />
        <Text style={[styles.actionLabel, { color: ink ?? colors.fg }]}>{row.label}</Text>
        <MarketplaceUnreadBadge count={row.badge ?? 0} variant="inline" />
        {row.count != null && (
          <View style={styles.countPill}>
            <Text style={[styles.countPillText, { color: colors.fg }]}>{row.count}</Text>
          </View>
        )}
        <View style={styles.rowFill} />
        <ChevronRight size={18} color={tint ?? colors.grey} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader spacer />
      <ScrollView ref={scrollRef} refreshControl={refreshControl} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { color: colors.fg }]}>Dashboard & Settings</Text>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={confirmLogout}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <LogOut size={17} color={colors.red} />
          </TouchableOpacity>
        </View>

        {/* You: photo, username and bio, each edited in place. */}
        <DashboardProfileCard user={user} />

        {/* Groups of rows: the title, then how many and the way in. */}
        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>My Content & Settings</Text>
        {renderRows(contentRows)}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Cars</Text>
        {renderRows(carRows)}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Members</Text>
        {renderRows(peopleRows)}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Groups</Text>
        {renderRows(groupRows)}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Marketplace</Text>
        {renderRows(marketRows)}

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
            photoSpots={spotUsage}
          />
        )}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Notifications</Text>
        {renderRows(notifRows)}

        {isAdmin && (
          <>
            <Text style={[styles.bucketTitle, { color: COLOR_MUTED_ORANGE }]}>Admin</Text>
            {renderRows(adminRows, COLOR_MUTED_ORANGE)}
          </>
        )}

        <Text style={[styles.bucketTitle, { color: COLOR_WHITE }]}>Danger Zone</Text>
        {renderRows(dangerRows)}
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
                if (atCarLimit) { if (isPro) showProGarageFull(); else setUpsell(true); }
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
        title={GARAGE_UPSELL.title}
        message={GARAGE_UPSELL.message}
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

      {/* Cars that changed hands, or are offered to change them, either way. */}
      <SheetModal visible={sheet === 'transfers'} title="Transferred Cars" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={transfers}
          keyExtractor={(t) => t.internal_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          renderItem={({ item }) => (
            <TransferRow
              transfer={item}
              colors={colors}
              onOpenCar={item.car ? () => { setSheet(null); navigation.navigate('CarDetail', { carId: item.car_id }); } : undefined}
              onMessage={item.other_user ? () => {
                const other = item.other_user!;
                setSheet(null);
                navigation.navigate('ComposeMessage', { userId: other.user_id, username: other.username });
              } : undefined}
            />
          )}
          ListEmptyComponent={(
            <EmptyState
              title="No transfers"
              message="Cars you hand over to another member, or that are handed to you, show up here."
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </SheetModal>

      <DeclinedInvitesSheet visible={declinedOpen} onClose={() => setDeclinedOpen(false)} />

      {/* Blocked users sheet */}
      <SheetModal visible={sheet === 'blocked'} title="Blocked Users" onClose={() => setSheet(null)} colors={colors}>
        <FlatList
          data={blockedUsers}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <UserByline
              user={item}
              size={40}
              gap={12}
              fill
              nameStyle={blockedStyles.name}
              style={[blockedStyles.row, { borderBottomColor: colors.border }]}
            >
              <TouchableOpacity
                style={[blockedStyles.unblockBtn, { borderColor: colors.border }]}
                onPress={() => handleUnblock(item.user_id, item.username)}
                activeOpacity={0.7}
              >
                <Text style={[blockedStyles.unblockText, { color: colors.primaryAlt }]}>Unblock</Text>
              </TouchableOpacity>
            </UserByline>
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
                    thumb={carHeroUrl(c)}
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
  headingRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading:        { fontSize: 22, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  logoutBtn:      { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Over each group of rows; the screen's gap would hold it too far off its own.
  bucketTitle:    { fontSize: 16, fontFamily: FONT_INTER.medium, marginTop: 6, marginBottom: -6 },



  actions:        { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  actionRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  actionLabel:    { fontSize: 15, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  // Pushes the chevron to the row's end, the count staying by its title.
  rowFill:        { flex: 1 },
  countPill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: PILL_RADIUS, backgroundColor: 'rgba(0,0,0,0.4)' },
  countPillText:  { fontSize: 12, fontFamily: FONT_INTER.bold },
  // Lighter than the card's edge, so the rows read as separate.
  // Across the whole container, not inset with the text.
  actionDivider:  { height: 1, backgroundColor: DIVIDER },
});

const blockedStyles = StyleSheet.create({
  row:         { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  name:        { fontSize: 15, fontFamily: FONT_INTER.semibold },
  unblockBtn:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: COMMON_RADIUS, borderWidth: 1 },
  unblockText: { fontSize: 13, fontFamily: FONT_INTER.bold },
});


const flaggedStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 12, fontFamily: FONT_INTER.bold, letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  item: {
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10,
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb:     { width: 52, height: 52, borderRadius: 8 },
  thumbRound: { borderRadius: 26 },
  body:      { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  itemMeta:  { fontSize: 12, fontFamily: FONT_INTER.regular },
  actions:   { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: COMMON_RADIUS,
  },
  actionBtnText: { fontSize: 12, fontFamily: FONT_INTER.bold },
});
