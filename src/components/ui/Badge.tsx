import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BADGE_COLORS } from '../../constants/colors';

interface BadgeProps {
  variant: string;
  label?: string;
}

export const TYPE_LABELS: Record<string, string> = {
  general:   'Post',
  record:    'Record',
  listing:   'Listing',
  want:      'Want Ad',
  'want-ad': 'Want Ad',
  wants:     'Want Ad',
  spot:      'Spotted',
  spotted:   'Spotted',
  update:    'Update',
  garage:    'Garage',
  event:     'Event',
  group:     'Group',
  post:      'Post',
  story:     'Story',
};

export const CATEGORY_LABELS: Record<string, string> = {
  // general
  show:         'Show',
  misc:         'Misc.',
  // record
  mod:          'Mod',
  restoration:  'Restoration',
  maintenance:  'Maintenance',
  detailing:    'Detailing',
  // listing
  new:          'New Part',
  used:         'Used Part',
  accessories:  'Accessories',
  // want / listing shared
  car:          'Car',
  part:         'Part',
  other:        'Other',
  // spot
  museum:       'Museum',
  wild:         'In the Wild',
  // general catch-all
  general:      'General',
};

export default function Badge({ variant, label }: BadgeProps) {
  const colors = BADGE_COLORS[variant] ?? BADGE_COLORS.default;
  const text = label ?? TYPE_LABELS[variant] ?? variant;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
