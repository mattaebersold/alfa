import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Wrench, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCarWithUserQuery, useGetCarTasksQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import FeedList from '../../components/feed/FeedList';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import LikeButton from '../../components/social/LikeButton';
import FollowButton from '../../components/social/FollowButton';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import type { CarsScreenProps, AppStackParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'overview' | 'posts' | 'mods' | 'tasks';

export default function CarDetailScreen({ route }: CarsScreenProps<'CarDetail'>) {
  const { carId } = route.params;
  // Use app-level navigation so this screen works from both CarsStack and AppStack (CarDetailModal)
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: car, isLoading } = useGetCarWithUserQuery(carId);
  const { data: tasks = [] } = useGetCarTasksQuery(carId, {
    skip: activeTab !== 'tasks',
  });

  if (isLoading || !car) return <Spinner fullScreen />;

  const gallery = car.gallery ?? [];
  const owner = car.user;
  const displayName = owner
    ? `${owner.firstName} ${owner.lastName}`.trim() || owner.username
    : 'Unknown';
  const isOwner = userInfo?.user_id === car.user_id;

  const specs: { label: string; value: string | undefined }[] = [
    { label: 'Year',       value: car.year },
    { label: 'Make',       value: car.make },
    { label: 'Model',      value: car.model },
    { label: 'Trim',       value: car.trim },
    { label: 'Color',      value: car.color },
    { label: 'Engine',     value: car.engine },
    { label: 'HP',         value: car.horsepower },
    { label: 'Torque',     value: car.torque },
    { label: 'Mileage',    value: car.mileage ? `${Number(car.mileage).toLocaleString()} mi` : undefined },
    { label: 'Condition',  value: car.condition },
    { label: 'Type',       value: car.type },
  ].filter((s) => s.value);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'posts',    label: 'Posts' },
    { key: 'mods',     label: 'Mods' },
    { key: 'tasks',    label: 'Tasks' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>
        {/* Gallery */}
        <View>
          {gallery.length > 0 ? (
            <FlatList
              data={gallery}
              keyExtractor={(item) => item.filename}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: imageUrl(item.filename)! }}
                  style={[styles.galleryImage, { width: SCREEN_WIDTH }]}
                  contentFit="cover"
                />
              )}
            />
          ) : (
            <View style={[styles.galleryImage, styles.galleryPlaceholder]}>
              <Text style={styles.galleryPlaceholderText}>No photos yet</Text>
            </View>
          )}
          {gallery.length > 1 && (
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === galleryIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Car title + owner */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={styles.carTitle}>
                {car.year} {car.make} {car.model}
                {car.trim ? ` ${car.trim}` : ''}
              </Text>
              {car.type && <Text style={styles.carType}>{car.type}</Text>}
            </View>
            {isOwner && (
              <TouchableOpacity
                onPress={() => appNav.navigate('CarTasks', { carId, carTitle: `${car.year} ${car.make} ${car.model}` })}
                style={styles.taskBtn}
              >
                <Wrench size={18} color={Colors.brg} />
                <Text style={styles.taskBtnText}>Tasks</Text>
                {tasks.filter((t) => !t.completed).length > 0 && (
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeText}>
                      {tasks.filter((t) => !t.completed).length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {car.body && (
            <Text style={styles.carDescription}>{car.body}</Text>
          )}

          {/* Owner card */}
          {owner && (
            <TouchableOpacity
              style={styles.ownerCard}
              onPress={() => appNav.navigate('UserDetail', { userId: owner.user_id })}
            >
              <Avatar
                filename={owner.gallery?.[0]?.filename ?? owner.profilePicture}
                name={displayName}
                size={44}
              />
              <View style={styles.ownerInfo}>
                <Text style={styles.ownerName}>{displayName}</Text>
                {owner.username && (
                  <Text style={styles.ownerUsername}>@{owner.username}</Text>
                )}
              </View>
              {!isOwner && owner.username && (
                <FollowButton username={owner.username} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Sticky tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specs</Text>
            {specs.map((s) => (
              <View key={s.label} style={styles.specRow}>
                <Text style={styles.specLabel}>{s.label}</Text>
                <Text style={styles.specValue}>{s.value}</Text>
              </View>
            ))}
            {specs.length === 0 && (
              <Text style={styles.emptyText}>No specs added yet.</Text>
            )}
          </View>
        )}

        {activeTab === 'posts' && (
          <FeedList carId={carId} />
        )}

        {activeTab === 'mods' && (
          <View style={styles.section}>
            <Text style={styles.emptyText}>Mods coming soon.</Text>
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.section}>
            {tasks.length === 0 ? (
              <Text style={styles.emptyText}>No tasks yet.</Text>
            ) : (
              tasks.map((task) => (
                <View key={task.internal_id} style={styles.taskRow}>
                  <View style={[styles.taskDot, task.completed && styles.taskDotDone]} />
                  <Text style={[styles.taskTitle, task.completed && styles.taskDone]}>
                    {task.title}
                  </Text>
                  {task.priority && (
                    <Text style={styles.taskPriority}>{task.priority}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  galleryImage: { height: 280 },
  galleryPlaceholder: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryPlaceholderText: { color: Colors.grey, fontSize: 14 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 10,
    width: '100%',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 18 },

  titleSection: { backgroundColor: '#FFFFFF', padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleLeft: { flex: 1 },
  carTitle: { fontSize: 22, fontWeight: '800', color: Colors.fg, lineHeight: 28 },
  carType: { fontSize: 13, color: Colors.grey, marginTop: 2, textTransform: 'capitalize' },
  carDescription: { fontSize: 14, color: Colors.muted, marginTop: 12, lineHeight: 20 },

  taskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  taskBtnText: { fontSize: 13, fontWeight: '600', color: Colors.brg },
  taskBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.speed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  taskBadgeText: { fontSize: 9, fontWeight: '800', color: '#000' },

  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: Colors.cream,
    padding: 12,
    borderRadius: 10,
  },
  ownerInfo: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '700', color: Colors.fg },
  ownerUsername: { fontSize: 12, color: Colors.grey, marginTop: 1 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.brg,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.grey },
  tabTextActive: { color: Colors.brg },

  section: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.fg, marginBottom: 12 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  specLabel: { fontSize: 13, color: Colors.grey, fontWeight: '500' },
  specValue: { fontSize: 13, color: Colors.fg, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  emptyText: { color: Colors.grey, fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  taskDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brg },
  taskDotDone: { backgroundColor: Colors.green },
  taskTitle: { flex: 1, fontSize: 14, color: Colors.fg, fontWeight: '500' },
  taskDone: { color: Colors.grey, textDecorationLine: 'line-through' },
  taskPriority: { fontSize: 11, color: Colors.grey, textTransform: 'capitalize' },
});
