import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppScreenProps, AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SUB_SCREENS = [
  { key: 'GroupForum',      label: 'Forum' },
  { key: 'GroupNews',       label: 'News' },
  { key: 'GroupCars',       label: 'Cars' },
  { key: 'GroupMembers',    label: 'Members' },
  { key: 'GroupEvents',     label: 'Events' },
  { key: 'GroupMarketplace',label: 'Market' },
  { key: 'GroupResources',  label: 'Resources' },
  { key: 'GroupSettings',   label: 'Settings' },
] as const;

export default function GroupDetailScreen({ route }: AppScreenProps<'GroupDetailModal'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: group, isLoading } = useGetGroupQuery(groupId);
  const { data: members = [] } = useGetGroupMembersQuery(groupId);
  const [join, { isLoading: joining }] = useJoinGroupMutation();
  const [leave, { isLoading: leaving }] = useLeaveGroupMutation();

  if (isLoading || !group) return <Spinner fullScreen />;

  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin');

  const visibleSubScreens = isAdmin
    ? SUB_SCREENS
    : SUB_SCREENS.filter((s) => s.key !== 'GroupSettings');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner */}
        {banner
          ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
          : <View style={styles.bannerPlaceholder} />
        }

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.fg }]}>{group.title}</Text>
            {group.subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{group.subtitle}</Text>}
            {group.region && <Text style={[styles.region, { color: colors.grey }]}>{group.region}</Text>}
          </View>

          {/* Join / Leave */}
          <TouchableOpacity
            style={[styles.joinBtn, isMember && { backgroundColor: colors.cream, borderWidth: 1.5, borderColor: colors.border }]}
            onPress={() => isMember ? leave(groupId) : join(groupId)}
            disabled={joining || leaving}
          >
            <Text style={[styles.joinBtnText, isMember && { color: colors.fg }]}>
              {isMember ? 'Leave' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member avatars */}
        {members.length > 0 && (
          <View style={[styles.membersStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.memberCount, { color: colors.grey }]}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            <View style={styles.avatarRow}>
              {members.slice(0, 8).map((m) => (
                <View key={m.user_id} style={styles.avatarWrap}>
                  <Avatar
                    filename={m.user?.gallery?.[0]?.filename}
                    name={m.user?.firstName ?? '?'}
                    size={32}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {group.body && (
          <View style={[styles.bodyBlock, { backgroundColor: colors.card }]}>
            <Text style={[styles.body, { color: colors.fg }]}>{stripHtml(group.body)}</Text>
          </View>
        )}

        {/* Sub-section grid */}
        <View style={styles.sectionGrid}>
          {visibleSubScreens.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sectionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate(s.key as any, { groupId })}
              activeOpacity={0.8}
            >
              <Text style={styles.sectionBtnText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1 },
  scroll:            { paddingBottom: 32 },
  banner:            { width: '100%', aspectRatio: 3 / 1 },
  bannerPlaceholder: { width: '100%', aspectRatio: 3 / 1, backgroundColor: Colors.brg },
  header:            {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1, marginRight: 12 },
  title:      { fontSize: 20, fontWeight: '800' },
  subtitle:   { fontSize: 14, marginTop: 3 },
  region:     { fontSize: 13, marginTop: 3 },
  joinBtn:    {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.brg, alignSelf: 'flex-start',
  },
  joinBtnText:      { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  membersStrip:  { padding: 16, borderBottomWidth: 1 },
  memberCount:   { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  avatarRow:     { flexDirection: 'row', gap: -8 },
  avatarWrap:    { marginRight: -8 },
  bodyBlock:     { padding: 16, marginTop: 8 },
  body:          { fontSize: 15, lineHeight: 22 },
  sectionGrid:   {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 8, gap: 8, marginTop: 8,
  },
  sectionBtn:    {
    width: (SCREEN_WIDTH - 40) / 2,
    borderRadius: 10, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  sectionBtnText: { fontSize: 15, fontWeight: '700', color: Colors.brg },
});
