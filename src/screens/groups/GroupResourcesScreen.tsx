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
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupResource } from '../../types/api';

function ResourceRow({ resource }: { resource: GroupResource }) {
  const timeAgo = resource.created_at
    ? formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })
    : '';
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.8}>
      <View style={styles.iconWrap}>
        <FileText size={20} color={Colors.brg} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{resource.title}</Text>
        {resource.body && (
          <Text style={styles.body} numberOfLines={2}>{resource.body.replace(/<[^>]*>/g, '')}</Text>
        )}
        <View style={styles.meta}>
          <Avatar
            filename={resource.user?.gallery?.[0]?.filename}
            name={resource.user?.firstName ?? '?'}
            size={16}
          />
          <Text style={styles.metaText}>{timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupResourcesScreen({ route }: GroupsScreenProps<'GroupResources'>) {
  const { groupId } = route.params;
  const { data, isLoading, refetch } = useGetGroupResourcesQuery({ groupId });
  const resources = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
  safe:     { flex: 1, backgroundColor: Colors.cream },
  list:     { flexGrow: 1, paddingBottom: 24 },
  row:      {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  iconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.cream, alignItems: 'center', justifyContent: 'center' },
  info:     { flex: 1 },
  title:    { fontSize: 15, fontWeight: '700', color: Colors.fg, marginBottom: 4 },
  body:     { fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 6 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Colors.grey },
});
