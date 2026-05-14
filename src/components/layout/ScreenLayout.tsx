import React from 'react';
import { ScrollView, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';

interface ScreenLayoutProps {
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  style?: object;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export default function ScreenLayout({
  children,
  loading = false,
  empty = false,
  emptyTitle,
  emptyMessage,
  scrollable = true,
  onRefresh,
  refreshing = false,
  style,
  edges = ['top'],
}: ScreenLayoutProps) {
  const colors = useColors();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={edges}>
        <Spinner fullScreen />
      </SafeAreaView>
    );
  }

  if (empty) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={edges}>
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </SafeAreaView>
    );
  }

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }, style]} edges={edges}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.cyan}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }, style]} edges={edges}>
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent: { flexGrow: 1 },
  fill:         { flex: 1 },
});
