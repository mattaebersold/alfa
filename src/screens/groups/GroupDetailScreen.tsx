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
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { GroupsScreenProps, GroupsStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<GroupsStackParamList>;

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

export default function GroupDetailScreen({ route }: GroupsScreenProps<'GroupDetail'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<NavProp>();
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Banner */}
        {banner
          ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
          : <View style={styles.bannerPlaceholder} />
        }

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{group.title}</Text>
            {group.subtitle && <Text style={styles.subtitle}>{group.subtitle}</Text>}
            {group.region && <Text style={styles.region}>{group.region}</Text>}
          </View>

          {/* Join / Leave */}
          <TouchableOpacity
            style={[styles.joinBtn, isMember && styles.joinBtnActive]}
            onPress={() => isMember ? leave(groupId) : join(groupId)}
            disabled={joining || leaving}
          >
            <Text style={[styles.joinBtnText, isMember && styles.joinBtnTextActive]}>
              {isMember ? 'Leave' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member avatars */}
        {members.length > 0 && (
          <View style={styles.membersStrip}>
            <Text style={styles.memberCount}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
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
          <View style={styles.bodyBlock}>
            <Text style={styles.body}>{group.body.replace(/<[^>]*>/g, '')}</Text>
          </View>
        )}

        {/* Sub-section grid */}
        <View style={styles.sectionGrid}>
          {visibleSubScreens.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={styles.sectionBtn}
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
  safe:              { flex: 1, backgroundColor: Colors.cream },
  scroll:            { paddingBottom: 32 },
  banner:            { width: '100%', aspectRatio: 3 / 1 },
  bannerPlaceholder: { width: '100%', aspectRatio: 3 / 1, backgroundColor: Colors.brg },
  header:            {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerText: { flex: 1, marginRight: 12 },
  title:      { fontSize: 20, fontWeight: '800', color: Colors.fg },
  subtitle:   { fontSize: 14, color: Colors.muted, marginTop: 3 },
  region:     { fontSize: 13, color: Colors.grey, marginTop: 3 },
  joinBtn:    {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.brg, alignSelf: 'flex-start',
  },
  joinBtnActive:    { backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border },
  joinBtnText:      { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  joinBtnTextActive:{ color: Colors.fg },
  membersStrip:  { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberCount:   { fontSize: 13, fontWeight: '700', color: Colors.grey, marginBottom: 8 },
  avatarRow:     { flexDirection: 'row', gap: -8 },
  avatarWrap:    { marginRight: -8 },
  bodyBlock:     { padding: 16, backgroundColor: '#FFFFFF', marginTop: 8 },
  body:          { fontSize: 15, color: Colors.fg, lineHeight: 22 },
  sectionGrid:   {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 8, gap: 8, marginTop: 8,
  },
  sectionBtn:    {
    width: (SCREEN_WIDTH - 40) / 2,
    backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  sectionBtnText: { fontSize: 15, fontWeight: '700', color: Colors.brg },
});
