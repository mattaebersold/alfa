import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BADGE_COLORS } from '../../constants/colors';

interface BadgeProps {
  variant: string;
  label?: string;
}

const LABELS: Record<string, string> = {
  listing:  'Listing',
  'want-ad':'Want Ad',
  want:     'Want Ad',
  wants:    'Want Ad',
  garage:   'Garage',
  event:    'Event',
  group:    'Group',
  record:   'Record',
  spotted:  'Spotted',
  update:   'Update',
  post:     'Post',
};

export default function Badge({ variant, label }: BadgeProps) {
  const colors = BADGE_COLORS[variant] ?? BADGE_COLORS.default;
  const text = label ?? LABELS[variant] ?? variant;

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
