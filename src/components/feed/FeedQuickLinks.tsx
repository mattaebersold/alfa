import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Warehouse, Users, Calendar, Route, Car } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';

type LucideIcon = React.ComponentType<{ size?: number; color?: string }>;

/**
 * Horizontal row of quick-link pills on the home feed — mirrors Murray's
 * FeedQuickActions (My Garage, My Groups, All Events, ORS Rallys, Member Cars).
 */
export default function FeedQuickLinks() {
  const colors = useColors();
  const navigation = useNavigation<any>();

  const actions: { label: string; Icon: LucideIcon; onPress: () => void }[] = [
    {
      label: 'My Garage',
      Icon: Warehouse,
      onPress: () => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Garage' } }),
    },
    {
      label: 'My Groups',
      Icon: Users,
      onPress: () => navigation.navigate('MainTabs', { screen: 'GroupsTab', params: { screen: 'Groups' } }),
    },
    {
      label: 'All Events',
      Icon: Calendar,
      onPress: () => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Events' } }),
    },
    {
      label: 'ORS Rallys',
      Icon: Route,
      onPress: () => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Rallys' } }),
    },
    {
      label: 'Member Cars',
      Icon: Car,
      onPress: () => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Cars' } }),
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {actions.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <action.Icon size={15} color={colors.primaryAlt} />
          <Text style={[styles.pillText, { color: colors.fg }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row:      { paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
  pill:     {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
});
