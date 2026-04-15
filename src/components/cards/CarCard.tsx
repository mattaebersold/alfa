import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Wrench } from 'lucide-react-native';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GarageCar } from '../../types/api';

interface CarCardProps {
  car: GarageCar;
  onPress: () => void;
  onTasksPress?: () => void;
  taskCount?: number;
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
        </View>
        <View style={styles.actions}>
          {onTasksPress && (
            <TouchableOpacity
              onPress={onTasksPress}
              style={[styles.tasksBtn, { backgroundColor: colors.cream, borderColor: colors.border }]}
            >
              <Wrench size={16} color={Colors.brg} />
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
    backgroundColor: Colors.speed, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 3, gap: 3,
  },
  taskBadgeText:   { fontSize: 11, fontWeight: '800', color: '#000' },
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
  tasksBtn:        { padding: 8, borderRadius: 8, borderWidth: 1 },
});
