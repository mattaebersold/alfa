import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { useGetGroupForumQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupForumPost } from '../../types/api';

function ForumRow({ post }: { post: GroupForumPost }) {
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.8}>
      <Avatar
        filename={post.user?.gallery?.[0]?.filename}
        name={post.user?.firstName ?? '?'}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.rowBody} numberOfLines={2}>{post.body?.replace(/<[^>]*>/g, '')}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowTime}>{timeAgo}</Text>
          <View style={styles.votes}>
            <ThumbsUp size={13} color={Colors.grey} />
            <Text style={styles.voteNum}>{post.upvotes ?? 0}</Text>
            <ThumbsDown size={13} color={Colors.grey} />
            <Text style={styles.voteNum}>{post.downvotes ?? 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupForumScreen({ route }: GroupsScreenProps<'GroupForum'>) {
  const { groupId } = route.params;
  const { data, isLoading, refetch } = useGetGroupForumQuery({ groupId });
  const posts = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.internal_id}
        renderItem={({ item }) => <ForumRow post={item} />}
        ListEmptyComponent={<EmptyState title="No forum posts yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  list:        { flexGrow: 1, paddingBottom: 24 },
  row:         {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rowContent:  { flex: 1 },
  rowTitle:    { fontSize: 15, fontWeight: '700', color: Colors.fg, marginBottom: 4 },
  rowBody:     { fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 6 },
  rowMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTime:     { fontSize: 12, color: Colors.grey },
  votes:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteNum:     { fontSize: 12, color: Colors.grey },
});
