import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, FileText, Users, UserPlus, Flag, UserCheck, X, Trash2, LogOut, ShieldAlert, RotateCcw } from 'lucide-react-native';
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
  useGetFlaggedContentQuery,
  useRemoveContentMutation,
  useRestoreContentMutation,
} from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader from '../../components/ui/AppHeader';
import FeedItemCard from '../../components/cards/FeedItemCard';
import CarCard from '../../components/cards/CarCard';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type SheetType = 'cars' | 'posts' | 'blocked' | 'flagged' | null;
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

const sheetStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700' },
  addCarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 14,
    paddingVertical: 13, borderRadius: 12,
  },
  addCarBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default function DashboardScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const dispatch = useAppDispatch();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [sheet, setSheet] = useState<SheetType>(null);
  const [deleteAccount] = useDeleteAccountMutation();

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

  const { data: user, isLoading } = useGetLoggedInUserQuery();
  const { data: stats } = useGetUserStatsQuery();
  const { data: garageData } = useGetUserGarageQuery();
  const { data: postsData } = useGetPostsQuery(
    { user_id: userInfo?.user_id ?? '', limit: 30 },
    { skip: !userInfo?.user_id },
  );
  const { data: blockedData } = useGetBlockedUsersQuery();
  const [unblockUser] = useUnblockUserMutation();
  const isAdmin = userInfo?.accountType === 'admin';
  const { data: flaggedData } = useGetFlaggedContentQuery(undefined, { skip: !isAdmin });
  const [removeContent] = useRemoveContentMutation();
  const [restoreContent] = useRestoreContentMutation();

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return null;

  const displayName = user.username;
  const cars = garageData?.entries ?? [];
  const posts = postsData?.entries ?? [];
  const blockedUsers = blockedData?.entries ?? [];
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
      label: 'Followers',
      count: stats?.followersCount,
      Icon: Users,
      bg: '#5b7fa622',
      color: '#5b7fa6',
      onPress: () => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile', params: { initialTab: 'followers' } } }),
    },
    {
      label: 'Following',
      count: stats?.followingCount,
      Icon: UserPlus,
      bg: '#7a6abf22',
      color: '#7a6abf',
      onPress: () => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile', params: { initialTab: 'following' } } }),
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <ScrollView style={{ backgroundColor: colors.cream }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })}
          activeOpacity={0.8}
        >
          <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={56} />
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
              </View>
              <Text style={[styles.statCount, { color: colors.fg }]}>
                {card.count ?? '–'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.grey }]}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick actions */}
        <View style={[styles.actions, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Garage' } } as any)} activeOpacity={0.7}>
            <Car size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>My Garage</Text>
          </TouchableOpacity>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <UserCheck size={16} color={colors.primaryAlt} />
            <Text style={[styles.actionLabel, { color: colors.fg }]}>Account Settings</Text>
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

        {/* Admin: flagged content */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.flaggedRow, { borderColor: '#e07b3940', backgroundColor: '#e07b3910' }]}
            onPress={() => setSheet('flagged')}
            activeOpacity={0.75}
          >
            <ShieldAlert size={15} color="#e07b39" />
            <Text style={[styles.flaggedLabel, { color: '#e07b39' }]}>
              View Flagged Content
              {totalFlagged > 0 ? ` (${totalFlagged})` : ''}
            </Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              style={[sheetStyles.addCarBtn, { backgroundColor: colors.primaryAlt }]}
              onPress={() => { setSheet(null); navigation.navigate('CarCreate', {}); }}
              activeOpacity={0.85}
            >
              <Car size={16} color="#FFFFFF" />
              <Text style={sheetStyles.addCarBtnText}>Add New Car</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <CarCard
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
          renderItem={({ item }) => (
            <FeedItemCard
              post={item}
              onPress={() => { setSheet(null); navigation.navigate('PostDetailModal', { postId: item.internal_id }); }}
            />
          )}
          ListEmptyComponent={<EmptyState title="No posts yet" />}
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
              <Avatar filename={item.gallery?.[0]?.filename} name={item.username ?? '?'} size={40} />
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
                  <View key={p.internal_id} style={[flaggedStyles.item, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[flaggedStyles.itemTitle, { color: colors.fg }]} numberOfLines={1}>
                        {p.title || p.body?.slice(0, 60) || 'Untitled post'}
                      </Text>
                      <Text style={[flaggedStyles.itemMeta, { color: colors.muted }]}>
                        @{p.username || p.user_id}{p.report_count ? ` · ${p.report_count} report${p.report_count !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={flaggedStyles.actions}>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.primaryAlt + '20' }]}
                        onPress={() => handleRestoreContent('post', p.internal_id)}
                      >
                        <RotateCcw size={14} color={colors.primaryAlt} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.primaryAlt }]}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.red + '20' }]}
                        onPress={() => handleRemoveContent('post', p.internal_id)}
                      >
                        <Trash2 size={14} color={colors.red} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.red }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {flaggedCars.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Cars ({flaggedCars.length})
                </Text>
                {flaggedCars.map((c) => (
                  <View key={c.internal_id} style={[flaggedStyles.item, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[flaggedStyles.itemTitle, { color: colors.fg }]} numberOfLines={1}>
                        {[c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled car'}
                      </Text>
                      <Text style={[flaggedStyles.itemMeta, { color: colors.muted }]}>
                        @{c.username || c.user_id}{c.report_count ? ` · ${c.report_count} report${c.report_count !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={flaggedStyles.actions}>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.primaryAlt + '20' }]}
                        onPress={() => handleRestoreContent('car', c.internal_id)}
                      >
                        <RotateCcw size={14} color={colors.primaryAlt} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.primaryAlt }]}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.red + '20' }]}
                        onPress={() => handleRemoveContent('car', c.internal_id)}
                      >
                        <Trash2 size={14} color={colors.red} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.red }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {flaggedComments.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Comments ({flaggedComments.length})
                </Text>
                {flaggedComments.map((c) => (
                  <View key={c.internal_id ?? c._id} style={[flaggedStyles.item, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[flaggedStyles.itemTitle, { color: colors.fg }]} numberOfLines={2}>
                        {c.body || 'No text'}
                      </Text>
                      <Text style={[flaggedStyles.itemMeta, { color: colors.muted }]}>
                        @{c.username || c.user_id}{c.report_count ? ` · ${c.report_count} report${c.report_count !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={flaggedStyles.actions}>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.primaryAlt + '20' }]}
                        onPress={() => handleRestoreContent('comment', c.internal_id ?? c._id)}
                      >
                        <RotateCcw size={14} color={colors.primaryAlt} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.primaryAlt }]}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.red + '20' }]}
                        onPress={() => handleRemoveContent('comment', c.internal_id ?? c._id)}
                      >
                        <Trash2 size={14} color={colors.red} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.red }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {flaggedUsers.length > 0 && (
              <>
                <Text style={[flaggedStyles.sectionHeader, { color: colors.grey, backgroundColor: colors.secondary }]}>
                  Users ({flaggedUsers.length})
                </Text>
                {flaggedUsers.map((u) => (
                  <View key={u.user_id ?? u.internal_id} style={[flaggedStyles.item, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[flaggedStyles.itemTitle, { color: colors.fg }]} numberOfLines={1}>
                        @{u.username || 'Unknown user'}
                      </Text>
                      <Text style={[flaggedStyles.itemMeta, { color: colors.muted }]}>
                        {u.email || u.user_id}{u.report_count ? ` · ${u.report_count} report${u.report_count !== 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                    <View style={flaggedStyles.actions}>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.primaryAlt + '20' }]}
                        onPress={() => handleRestoreContent('user', u.user_id ?? u.internal_id)}
                      >
                        <RotateCcw size={14} color={colors.primaryAlt} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.primaryAlt }]}>Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[flaggedStyles.actionBtn, { backgroundColor: colors.red + '20' }]}
                        onPress={() => handleRemoveContent('user', u.user_id ?? u.internal_id)}
                      >
                        <Trash2 size={14} color={colors.red} />
                        <Text style={[flaggedStyles.actionBtnText, { color: colors.red }]}>Ban</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {totalFlagged === 0 && (
              <EmptyState title="No flagged content" message="Content reported by users will appear here." />
            )}
          </ScrollView>
        </SheetModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:        { padding: 16, gap: 14, paddingBottom: 40 },

  profileCard:    {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1,
  },
  profileText:    { flex: 1 },
  profileName:    { fontSize: 18, fontWeight: '800' },
  profileUsername: { fontSize: 14, marginTop: 2 },
  profileBio:     { fontSize: 13, marginTop: 6, lineHeight: 18 },
  profileBioAdd:  { fontSize: 13, marginTop: 6 },

  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:       {
    width: '48%', padding: 16, borderRadius: 16, borderWidth: 1, gap: 8,
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
  countBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: '700' },
});

const blockedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  name:        { fontSize: 15, fontWeight: '600' },
  unblockBtn:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  unblockText: { fontSize: 13, fontWeight: '700' },
});

const flaggedStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemMeta:  { fontSize: 12, marginTop: 2 },
  actions:   { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
