import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, Pressable, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, MessageSquare, MessageCircle, Newspaper, Users,
  Car, Calendar, ShoppingBag, BookOpen, Settings, Plus, Check, X,
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
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_GAP = 12;
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

  const { data: group, isLoading } = useGetGroupQuery(groupId);
  const { data: members = [] }     = useGetGroupMembersQuery(groupId);
  const { data: groupCarsData }    = useGetGroupCarsQuery(groupId);
  const { data: garageData }       = useGetUserGarageQuery(undefined, { skip: !carModalOpen });
  const [join,  { isLoading: joining }]  = useJoinGroupMutation();
  const [leave, { isLoading: leaving }]  = useLeaveGroupMutation();
  const [updateCarGroup] = useUpdateCarGroupMutation();

  const groupCars = groupCarsData?.entries ?? [];
  const myCars = garageData?.entries ?? [];

  if (isLoading || !group) return <Spinner fullScreen />;

  const banner   = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin');
  const canManageCars = isMember || isAdmin;

  const goToSection = (initialTab: string) => {
    (navigation as any).navigate('GroupSection', { groupId, groupTitle: group.title, initialTab });
  };

  const tiles = [
    ...SECTIONS,
    ...(isAdmin ? [{ key: 'settings', label: 'Settings', Icon: Settings, color: '#666' }] : []),
  ];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <ScrollView style={{ backgroundColor: c.cream }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={styles.bannerWrap}>
          {banner
            ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
            : <View style={[styles.banner, { backgroundColor: c.primaryAlt }]} />
          }
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Title card */}
        <View style={[styles.titleCard, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupTitle, { color: c.fg }]}>{group.title}</Text>
              {group.subtitle && <Text style={[styles.groupSub, { color: c.muted }]}>{group.subtitle}</Text>}
              {group.region  && <Text style={[styles.groupRegion, { color: c.grey }]}>{group.region}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.joinBtn, isMember && { backgroundColor: c.cream, borderWidth: 1.5, borderColor: c.border }]}
              onPress={() => isMember ? leave(groupId) : join(groupId)}
              disabled={joining || leaving}
            >
              <Text style={[styles.joinBtnText, isMember && { color: c.fg }]}>
                {isMember ? 'Leave' : 'Join'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members strip */}
        {members.length > 0 && (
          <View style={[styles.membersStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <Text style={[styles.memberCount, { color: c.grey }]}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
            <View style={styles.avatarRow}>
              {members.slice(0, 10).map((m) => (
                <View key={m.user_id} style={styles.avatarWrap}>
                  <Avatar filename={m.user?.gallery?.[0]?.filename} name={m.user?.username ?? '?'} size={30} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {group.body && (
          <View style={[styles.bodyBlock, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <Text style={[styles.bodyText, { color: c.fg }]}>{stripHtml(group.body)}</Text>
          </View>
        )}

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
                <Plus size={13} color="#FFFFFF" />
                <Text style={styles.associateBtnText}>Associate cars</Text>
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
                  <TouchableOpacity
                    key={car.internal_id}
                    style={[styles.groupCarCard, { backgroundColor: c.card }]}
                    onPress={() => (navigation as any).navigate('CarDetail', { carId: car.internal_id })}
                    activeOpacity={0.88}
                  >
                    {img
                      ? <Image source={{ uri: img }} style={styles.groupCarImg} contentFit="cover" />
                      : <View style={[styles.groupCarImg, { backgroundColor: c.segment }]} />}
                    <Text style={[styles.groupCarTitle, { color: c.fg }]} numberOfLines={1}>
                      {[car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Car'}
                    </Text>
                  </TouchableOpacity>
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
                  ? (navigation as any).navigate('GroupSettings', { groupId })
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

      </ScrollView>

      {/* Associate cars modal */}
      <Modal visible={carModalOpen} transparent animationType="slide" onRequestClose={() => setCarModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCarModalOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: c.cream }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.sheetTitle, { color: c.fg }]}>Associate cars</Text>
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
                      {associated && <Check size={14} color="#FFFFFF" />}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:       { paddingBottom: 40 },

  bannerWrap:   { position: 'relative' },
  banner:       { width: '100%', aspectRatio: 3 / 1 },
  backBtn:      {
    position: 'absolute', top: 12, left: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  titleCard:    { padding: 16, borderBottomWidth: 1 },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupTitle:   { fontSize: 20, fontWeight: '800' },
  groupSub:     { fontSize: 14, marginTop: 3 },
  groupRegion:  { fontSize: 13, marginTop: 3 },
  joinBtn:      {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.primaryAlt, alignSelf: 'flex-start', flexShrink: 0,
  },
  joinBtnText:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  membersStrip: { padding: 14, borderBottomWidth: 1 },
  memberCount:  { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  avatarRow:    { flexDirection: 'row' },
  avatarWrap:   { marginRight: -6 },

  bodyBlock:    { padding: 16, borderBottomWidth: 1 },
  bodyText:     { fontSize: 15, lineHeight: 22 },

  carsSection:   { paddingTop: 18 },
  carsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: TILE_GAP, marginBottom: 10 },
  carsHeading:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  associateBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  associateBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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
