import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Wrench, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { useGetUserByIdQuery, useDeleteCarMutation } from '../../api/apiService';
import ReportButton from '../ui/ReportButton';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import type { GarageCar } from '../../types/api';

interface CarCardProps {
  car: GarageCar;
  /** Called before navigating — use to close a parent modal/sheet. */
  onBeforeNavigate?: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
  onEditPress?: () => void;
}

// Murray-style badge colors per car type
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: '#F0D689', text: '#000' },
  'weekend':      { bg: '#35B5FF', text: '#000' },
  'project':      { bg: '#F36943', text: '#000' },
  'garage-queen': { bg: '#FF479C', text: '#000' },
  'part-out':     { bg: '#00FF3F', text: '#000' },
  'other':        { bg: '#F0D689', text: '#000' },
};

const formatLabel = (key?: string) =>
  key ? key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null;

function OwnerRow({ userId, coownerId }: { userId: string; coownerId?: string }) {
  const colors = useColors();
  const { data: owner } = useGetUserByIdQuery(userId, { skip: !userId });
  const { data: coowner } = useGetUserByIdQuery(coownerId ?? '', { skip: !coownerId });

  if (!owner && !coowner) return null;

  return (
    <View style={styles.ownerRow}>
      {owner && (
        <View style={styles.ownerChip}>
          <Avatar filename={owner.gallery?.[0]?.filename} name={owner.username ?? '?'} size={18} />
          <Text style={[styles.ownerName, { color: colors.muted }]} numberOfLines={1}>
            @{owner.username}
          </Text>
        </View>
      )}
      {coowner && (
        <View style={styles.ownerChip}>
          <Avatar filename={coowner.gallery?.[0]?.filename} name={coowner.username ?? '?'} size={18} />
          <Text style={[styles.ownerName, { color: colors.muted }]} numberOfLines={1}>
            @{coowner.username}
          </Text>
          <View style={[styles.coOwnerTag, { backgroundColor: colors.segment }]}>
            <Text style={[styles.coOwnerTagText, { color: colors.grey }]}>co</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function CarCard({ car, onBeforeNavigate, onTasksPress, taskCount = 0, onEditPress }: CarCardProps) {
  const colors = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  if (hiddenIds.includes(car.internal_id)) return null;

  const handlePress = () => {
    onBeforeNavigate?.();
    (nav as any).navigate('CarDetailModal', { carId: car.internal_id });
  };
  const isOwner = userInfo?.user_id === car.user_id;
  const [deleteCar] = useDeleteCarMutation();

  const carTitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
  const displayTitle = car.title || carTitle;
  const displaySubtitle = car.title
    ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')
    : car.trim || undefined;
  const typeBadge = TYPE_COLORS[car.type ?? ''];
  const typeLabel = formatLabel(car.type);
  const categoryLabel = formatLabel(car.category);

  const handleCogPress = () => {
    Alert.alert(carTitle || 'Car', '', [
      { text: 'Edit', onPress: () => onEditPress?.() },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert(
            'Delete Car',
            `Remove ${carTitle} from your garage? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                    await deleteCar({ internal_id: car.internal_id }).unwrap();
                  } catch {
                    Alert.alert('Error', 'Could not delete car. Please try again.');
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const hero =
    firstGalleryUrl(car.gallery) ??
    (car.profile_image ? imageUrl(car.profile_image) : null);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={handlePress}
      activeOpacity={0.92}
    >
      <View style={styles.imageContainer}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={[styles.image, { aspectRatio }]}
          contentFit="cover"
          transition={300}
          onLoad={(e) => {
            const { width, height } = e.source ?? {};
            if (width && height) setAspectRatio(width / height);
          }}
        />

        {/* Top-right: task badge + owner cog OR report button for non-owners */}
        <View style={styles.imageTopRight}>
          {onTasksPress && taskCount > 0 && (
            <TouchableOpacity style={styles.taskBadge} onPress={onTasksPress} hitSlop={4}>
              <Wrench size={10} color="#000" />
              <Text style={styles.taskBadgeText}>Tasks · {taskCount}</Text>
            </TouchableOpacity>
          )}
          {isOwner ? (
            <TouchableOpacity style={styles.imageCogBtn} onPress={handleCogPress} hitSlop={4}>
              <View style={styles.imageCogInner}>
                <Settings size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.imageCogInner}>
              <ReportButton contentType="car" contentId={car.internal_id} size={14} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Type/category badges — bottom-left of image */}
        {(typeLabel || categoryLabel) && (
          <View style={styles.imageBadges}>
            {typeLabel && typeBadge && (
              <View style={[styles.imageBadge, { backgroundColor: typeBadge.bg }]}>
                <Text style={[styles.imageBadgeText, { color: typeBadge.text }]}>{typeLabel}</Text>
              </View>
            )}
            {categoryLabel && (
              <View style={[styles.imageBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                <Text style={[styles.imageBadgeText, { color: '#fff' }]}>{categoryLabel}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.infoMain}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          {displaySubtitle && (
            <Text style={[styles.subtitle, { color: colors.grey }]} numberOfLines={1}>{displaySubtitle}</Text>
          )}
          <OwnerRow userId={car.user_id} coownerId={car.coowner_id} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:            {
    borderRadius: 12, overflow: 'hidden',
    marginHorizontal: 12, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  imageContainer:  { position: 'relative' },
  image:           { width: '100%' },
  imageTopRight: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  imageCogBtn:  {},
  imageCogInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  imageBadges: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
  },
  imageBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  imageBadgeText: { fontSize: 11, fontWeight: '700' },

  taskBadge:       {
    backgroundColor: colors.pro, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, gap: 3,
  },
  taskBadgeText:   { fontSize: 12, fontWeight: '800', color: '#000' },

  info:            { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  infoMain:        { flex: 1 },
  title:           { fontSize: 16, fontWeight: '800' },
  subtitle:        { fontSize: 13, marginTop: 2, fontWeight: '500' },
  trim:            { fontSize: 13, marginTop: 1 },
  ownerRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  ownerChip:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerName:       { fontSize: 12 },
  coOwnerTag:      { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  coOwnerTagText:  { fontSize: 10, fontWeight: '700' },
});
