import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { FileText } from 'lucide-react-native';
import { useGetGroupResourcesQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupResource } from '../../types/api';
import { stripHtml } from '../../utils/text';

function ResourceRow({ resource }: { resource: GroupResource }) {
  const colors = useColors();
  const timeAgo = resource.created_at
    ? formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })
    : '';
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} activeOpacity={0.8}>
      <View style={[styles.iconWrap, { backgroundColor: colors.cream }]}>
        <FileText size={20} color={Colors.brg} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>{resource.title}</Text>
        {resource.body && (
          <Text style={[styles.body, { color: colors.muted }]} numberOfLines={2}>{stripHtml(resource.body)}</Text>
        )}
        <View style={styles.meta}>
          <Avatar
            filename={resource.user?.gallery?.[0]?.filename}
            name={resource.user?.firstName ?? '?'}
            size={16}
          />
          <Text style={[styles.metaText, { color: colors.grey }]}>{timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupResourcesScreen({ route }: GroupsScreenProps<'GroupResources'>) {
  const { groupId } = route.params;
  const colors = useColors();
  const { data, isLoading, refetch } = useGetGroupResourcesQuery({ groupId });
  const resources = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={resources}
        keyExtractor={(r) => r.internal_id}
        renderItem={({ item }) => <ResourceRow resource={item} />}
        ListEmptyComponent={<EmptyState title="No resources yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1 },
  list:     { flexGrow: 1, paddingBottom: 24 },
  row:      {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info:     { flex: 1 },
  title:    { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  body:     { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
});
