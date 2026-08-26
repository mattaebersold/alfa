import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import {
  Wrench, Settings, Users, Star, Plus,
  PenSquare, Trash2, MessageSquarePlus, Images,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { useGetUserByIdQuery, useDeleteCarMutation, useGetCarFollowerCountQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import ActionSheet from '../ui/ActionSheet';
import Avatar from '../ui/Avatar';
import type { GarageCar } from '../../types/api';

interface CarCardProps {
  car: GarageCar;
  /** Called before navigating — use to close a parent modal/sheet. */
  onBeforeNavigate?: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
  onEditPress?: () => void;
  /**
   * Parent-sized variant (grids, carousels): the card drops its own margins,
   * locks a 4:3 image so neighbours line up, and hides the owner chips — the
   * surfaces that use it already say whose cars these are.
   */
  compact?: boolean;
  /** Shows a "Featured" badge over the image. */
  featured?: boolean;
}

// Murray-style badge colors per car type. Exported so the feed's garage-addition
// card badges a car the same way its CarCard does.
export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: '#F0D689', text: '#000' },
  'weekend':      { bg: '#35B5FF', text: '#000' },
  'project':      { bg: '#F36943', text: '#000' },
  'garage-queen': { bg: '#FF479C', text: '#000' },
  'part-out':     { bg: '#00FF3F', text: '#000' },
  'other':        { bg: '#F0D689', text: '#000' },
};

export const formatLabel = (key?: string) =>
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
          <Avatar user={owner} size={18} />
          <Text style={[styles.ownerName, { color: colors.muted }]} numberOfLines={1}>
            @{owner.username}
          </Text>
        </View>
      )}
      {coowner && (
        <View style={styles.ownerChip}>
          <Avatar user={coowner} size={18} />
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

export default function CarCard({ car, onBeforeNavigate, onTasksPress, taskCount = 0, onEditPress, compact = false, featured = false }: CarCardProps) {
  const colors = useColors();
  const nav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const [deleteCar] = useDeleteCarMutation();
  // Two sheets rather than one with every option in it: adding to a car and
  // administering it are different errands, and the + is the one people reach
  // for often.
  const [addSheet, setAddSheet] = useState(false);
  const [manageSheet, setManageSheet] = useState(false);

  // Follower count — prefer a value already on the payload, else fetch a lightweight count.
  const inlineFollowerCount = (car as any).followersCount as number | undefined;
  const { data: fetchedFollowerCount } = useGetCarFollowerCountQuery(car.internal_id, {
    skip: inlineFollowerCount != null || !car.internal_id,
  });
  const followerCount = inlineFollowerCount ?? fetchedFollowerCount ?? 0;

  const handlePress = () => {
    onBeforeNavigate?.();
    (nav as any).navigate('CarDetail', { carId: car.internal_id });
  };
  const isOwner = userInfo?.user_id === car.user_id;

  // Hidden (reported) or from a blocked user — return after all hooks to keep hook order stable.
  if (hiddenIds.includes(car.internal_id) || (car.user_id && blockedUserIds.includes(car.user_id))) return null;

  const carTitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
  const displayTitle = car.title || carTitle;
  const displaySubtitle = car.title
    ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')
    : car.trim || undefined;
  const typeBadge = TYPE_COLORS[car.type ?? ''];
  const typeLabel = formatLabel(car.type);
  const categoryLabel = formatLabel(car.category);

  const displayName = car.title || carTitle || 'this car';

  const confirmDelete = () => {
    Alert.alert(
      'Delete Car',
      `Remove ${displayName} from your garage? This cannot be undone.`,
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
      ],
      { cancelable: true },
    );
  };

  const hero =
    firstGalleryUrl(car.gallery) ??
    (car.profile_image ? imageUrl(car.profile_image) : null);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: colors.card }]}
      onPress={handlePress}
      activeOpacity={0.92}
    >
      <View style={styles.imageContainer}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={[styles.image, { aspectRatio: compact ? 4 / 3 : aspectRatio }]}
          contentFit="cover"
          transition={300}
          onLoad={compact ? undefined : (e) => {
            const { width, height } = e.source ?? {};
            if (width && height) setAspectRatio(width / height);
          }}
        />

        {featured && (
          <View style={styles.featuredBadge}>
            <Star size={10} color="#000" fill="#000" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
        )}

        {/* Top-right: task badge + owner add/cog OR report button for non-owners */}
        <View style={styles.imageTopRight}>
          {onTasksPress && taskCount > 0 && (
            <TouchableOpacity style={styles.taskBadge} onPress={onTasksPress} hitSlop={4}>
              <Wrench size={10} color="#000" />
              <Text style={styles.taskBadgeText}>Tasks · {taskCount}</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <>
              {/* Post about it, mod it, add photos — the three things owners
                  actually do to a car, from wherever the car is shown. */}
              <TouchableOpacity
                onPress={() => setAddSheet(true)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Add to ${displayName}`}
              >
                <View style={styles.imageCogInner}>
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.6} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setManageSheet(true)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Manage ${displayName}`}
              >
                <View style={styles.imageCogInner}>
                  <Settings size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Follower count — bottom-right of image */}
        {followerCount > 0 && (
          <View style={styles.followerBadge}>
            <Users size={11} color="#FFFFFF" />
            <Text style={styles.followerBadgeText}>{followerCount}</Text>
          </View>
        )}

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
          {/* Owner chips are noise in a grid of one person's own cars. */}
          {!compact && <OwnerRow userId={car.user_id} coownerId={car.coowner_id} />}
        </View>
      </View>

      {/* Only the owner can open either of these, and a feed full of other
          people's cars shouldn't carry a menu per card. */}
      {isOwner && (
        <>
      <ActionSheet
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        title={`Add to ${displayName}`}
        options={[
          {
            label: 'New Post',
            Icon: MessageSquarePlus,
            // The car arrives already tagged — a post started from a car is
            // about that car, and making you search for it afterwards was the
            // step everyone forgot.
            onPress: () => {
              onBeforeNavigate?.();
              (nav as any).navigate('Create', { carId: car.internal_id, carTitle: displayName });
            },
          },
          {
            label: 'Add Mod',
            Icon: Wrench,
            onPress: () => {
              onBeforeNavigate?.();
              (nav as any).navigate('ModCreate', { carId: car.internal_id, carTitle: displayName });
            },
          },
          {
            label: 'Add Gallery',
            Icon: Images,
            // The gallery composer lives on the car's own screen, so this opens
            // the car with that sheet already up.
            onPress: () => {
              onBeforeNavigate?.();
              (nav as any).navigate('CarDetail', { carId: car.internal_id, action: 'gallery' });
            },
          },
        ]}
      />

      <ActionSheet
        visible={manageSheet}
        onClose={() => setManageSheet(false)}
        title={displayName}
        options={[
          {
            label: 'Edit Car',
            Icon: PenSquare,
            // Most surfaces hand in their own edit route (closing a sheet on
            // the way); the rest get the plain one.
            onPress: () => {
              if (onEditPress) return onEditPress();
              onBeforeNavigate?.();
              (nav as any).navigate('CarCreate', { carId: car.internal_id });
            },
          },
          { label: 'Delete Car', Icon: Trash2, destructive: true, onPress: confirmDelete },
        ]}
      />
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:            {
    borderRadius: 12, overflow: 'hidden',
    marginHorizontal: 12, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  // Half-width variant — the grid owns the width and the gutters.
  cardCompact:     { marginHorizontal: 0, marginVertical: 0 },
  imageContainer:  { position: 'relative' },
  image:           { width: '100%' },
  imageTopRight: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  imageCogInner: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  imageBadges: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
  },
  followerBadge: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  followerBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  imageBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
  },
  imageBadgeText: { fontSize: 11, fontWeight: '700' },

  featuredBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.pro,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  featuredBadgeText: {
    fontSize: 11, fontWeight: '800', color: '#000',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

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
