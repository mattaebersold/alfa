import React from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Text } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { useGetGroupDiscussionQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import GroupItemActions from '../../components/groups/GroupItemActions';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GroupDiscussionPost } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts'

function DiscussionRow({ post }: { post: GroupDiscussionPost }) {
  const colors = useColors();
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    <TouchableOpacity style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} activeOpacity={0.8}>
      <Avatar
        user={post.user}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={2}>{post.title}</Text>
        <Text style={[styles.rowBody, { color: colors.muted }]} numberOfLines={2}>{stripHtml(post.body ?? '')}</Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowTime, { color: colors.grey }]}>{timeAgo}</Text>
          <GroupItemActions kind="discussion" item={post} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupDiscussionScreen({ route }: GroupsScreenProps<'GroupDiscussion'>) {
  const { groupId } = route.params;
  const colors = useColors();
  const { data, isLoading, refetch } = useGetGroupDiscussionQuery({ groupId });
  const posts = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.internal_id}
        renderItem={({ item }) => <DiscussionRow post={item} />}
        ListEmptyComponent={<EmptyState title="No discussion posts yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:        { flexGrow: 1, paddingBottom: 24 },
  rowContent:  { flex: 1 },
  rowTitle:    { fontSize: 15, fontFamily: FONT_INTER.bold, marginBottom: 4 },
  rowBody:     { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  rowMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTime:     { fontSize: 12 },
  votes:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
