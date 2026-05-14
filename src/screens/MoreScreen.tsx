import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Headphones, BookOpen, Search, ChevronRight,
} from 'lucide-react-native';
import { useColors } from '../hooks/useColors';
import { colors } from '../constants/colors';
import type { AppStackParamList } from '../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const items = [
  { label: 'Podcasts', icon: Headphones, screen: 'Podcasts' as const, description: 'Audio shows from the community' },
  { label: 'Articles', icon: BookOpen, screen: 'Articles' as const, description: 'News, guides & editorials' },
  { label: 'Search', icon: Search, screen: 'Search' as const, description: 'Find members, cars & posts' },
] as const;

export default function MoreScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {items.map(({ label, icon: Icon, screen, description }) => (
          <TouchableOpacity
            key={screen}
            style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
            onPress={() => navigation.navigate(screen)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.cyan + '18' }]}>
              <Icon size={20} color={colors.cyan} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
              <Text style={[styles.description, { color: colors.grey }]}>{description}</Text>
            </View>
            <ChevronRight size={16} color={colors.grey} />
          </TouchableOpacity>
        ))}

        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')}>
              <Text style={[styles.footerLink, { color: colors.grey }]}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={[styles.footerDivider, { color: colors.grey }]}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')}>
              <Text style={[styles.footerLink, { color: colors.grey }]}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.footerCopy, { color: colors.grey }]}>© {new Date().getFullYear()} Open Road Society</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  list:        { paddingVertical: 8 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer:        { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 8, gap: 6 },
  footerLinks:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerLink:    { fontSize: 12, fontWeight: '600' },
  footerDivider: { fontSize: 12 },
  footerCopy:    { fontSize: 11 },
  iconWrap:    {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:     { flex: 1 },
  label:       { fontSize: 15, fontWeight: '600' },
  description: { fontSize: 12, marginTop: 1 },
});
