import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { useGetUserByIdQuery } from '../../api/apiService';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import type { GarageCar } from '../../types/api';

interface CarCardProps {
  car: GarageCar;
  onPress: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
}

function OwnerRow({ userId, coownerId }: { userId: string; coownerId?: string }) {
  const colors = useColors();
  const { data: owner } = useGetUserByIdQuery(userId, { skip: !userId });
  const { data: coowner } = useGetUserByIdQuery(coownerId ?? '', { skip: !coownerId });

  if (!owner && !coowner) return null;

  return (
    <View style={styles.ownerRow}>
      {owner && (
        <View style={styles.ownerChip}>
          <Avatar filename={owner.gallery?.[0]?.filename} name={owner.firstName} size={18} />
          <Text style={[styles.ownerName, { color: colors.muted }]} numberOfLines={1}>
            {owner.firstName} {owner.lastName}
          </Text>
        </View>
      )}
      {coowner && (
        <View style={styles.ownerChip}>
          <Avatar filename={coowner.gallery?.[0]?.filename} name={coowner.firstName} size={18} />
          <Text style={[styles.ownerName, { color: colors.muted }]} numberOfLines={1}>
            {coowner.firstName}
          </Text>
          <View style={[styles.coOwnerTag, { backgroundColor: colors.segment }]}>
            <Text style={[styles.coOwnerTagText, { color: colors.grey }]}>co</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function CarCard({ car, onPress, onTasksPress, taskCount = 0 }: CarCardProps) {
  const colors = useColors();
  const hero =
    firstGalleryUrl(car.gallery) ??
    (car.profile_image ? imageUrl(car.profile_image) : null);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <View style={styles.imageContainer}>
        {hero ? (
          <Image source={{ uri: hero }} style={styles.image} contentFit="cover" transition={300} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.placeholderText, { color: colors.grey }]}>No photo</Text>
          </View>
        )}
        {taskCount > 0 && (
          <View style={styles.taskBadge}>
            <Wrench size={10} color="#000" />
            <Text style={styles.taskBadgeText}>{taskCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.infoMain}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
            {[car.year, car.make, car.model].filter(Boolean).join(' ')}
          </Text>
          {car.trim && (
            <Text style={[styles.trim, { color: colors.grey }]} numberOfLines={1}>{car.trim}</Text>
          )}
          <View style={styles.meta}>
            {car.type && (
              <Text style={[styles.tag, { color: Colors.brg, backgroundColor: colors.cream }]}>
                {car.type}
              </Text>
            )}
            {car.color && (
              <Text style={[styles.metaText, { color: colors.grey }]}>{car.color}</Text>
            )}
          </View>
          <OwnerRow userId={car.user_id} coownerId={car.coowner_id} />
        </View>
        <View style={styles.actions}>
          {onTasksPress && (
            <TouchableOpacity
              onPress={onTasksPress}
              style={[styles.tasksBtn, { backgroundColor: colors.cream, borderColor: colors.border }]}
            >
              <Wrench size={13} color={Colors.brg} />
              <Text style={[styles.tasksBtnText, { color: Colors.brg }]}>Tasks</Text>
            </TouchableOpacity>
          )}
          <ChevronRight size={18} color={colors.grey} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:            {
    borderRadius: 12, overflow: 'hidden',
    marginHorizontal: 12, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  imageContainer:  { position: 'relative' },
  image:           { width: '100%', height: 180 },
  imagePlaceholder:{ alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 13 },
  taskBadge:       {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: Colors.cyan, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, gap: 3,
    borderWidth: 1.5, borderColor: '#000',
  },
  taskBadgeText:   { fontSize: 12, fontWeight: '800', color: '#000' },
  info:            { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  infoMain:        { flex: 1 },
  title:           { fontSize: 16, fontWeight: '800' },
  trim:            { fontSize: 13, marginTop: 1 },
  meta:            { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  tag:             {
    fontSize: 11, fontWeight: '700',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 4, textTransform: 'capitalize',
  },
  metaText:        { fontSize: 12, textTransform: 'capitalize' },
  actions:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tasksBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tasksBtnText:    { fontSize: 12, fontWeight: '700' },

  ownerRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  ownerChip:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ownerName:       { fontSize: 12 },
  coOwnerTag:      { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  coOwnerTagText:  { fontSize: 10, fontWeight: '700' },
});
