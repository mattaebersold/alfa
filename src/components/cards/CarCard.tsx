import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import type { GarageCar } from '../../types/api';

interface CarCardProps {
  car: GarageCar;
  onPress: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
  showOwner?: boolean;
}

export default function CarCard({ car, onPress, onTasksPress, taskCount = 0 }: CarCardProps) {
  const hero =
    firstGalleryUrl(car.gallery) ??
    (car.profile_image ? imageUrl(car.profile_image) : null);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* Hero image */}
      <View style={styles.imageContainer}>
        {hero ? (
          <Image source={{ uri: hero }} style={styles.image} contentFit="cover" transition={300} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        {/* Tasks badge */}
        {taskCount > 0 && (
          <View style={styles.taskBadge}>
            <Wrench size={10} color="#000" />
            <Text style={styles.taskBadgeText}>{taskCount}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.infoMain}>
          <Text style={styles.title} numberOfLines={1}>
            {[car.year, car.make, car.model].filter(Boolean).join(' ')}
          </Text>
          {car.trim && <Text style={styles.trim} numberOfLines={1}>{car.trim}</Text>}
          <View style={styles.meta}>
            {car.type && <Text style={styles.tag}>{car.type}</Text>}
            {car.color && <Text style={styles.metaText}>{car.color}</Text>}
          </View>
        </View>
        <View style={styles.actions}>
          {onTasksPress && (
            <TouchableOpacity onPress={onTasksPress} style={styles.tasksBtn}>
              <Wrench size={16} color={Colors.brg} />
            </TouchableOpacity>
          )}
          <ChevronRight size={18} color={Colors.grey} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 12,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: { position: 'relative' },
  image: { width: '100%', height: 180 },
  imagePlaceholder: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: Colors.grey, fontSize: 13 },
  taskBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.speed,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  taskBadgeText: { fontSize: 11, fontWeight: '800', color: '#000' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  infoMain: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: Colors.fg },
  trim: { fontSize: 13, color: Colors.grey, marginTop: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brg,
    backgroundColor: Colors.cream,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'capitalize',
  },
  metaText: { fontSize: 12, color: Colors.grey, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tasksBtn: {
    padding: 8,
    backgroundColor: Colors.cream,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
