import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FeedList from '../../components/feed/FeedList';
import StoriesRow from '../../components/stories/StoriesRow';
import FeedQuickLinks from '../../components/feed/FeedQuickLinks';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetBlockedUsersQuery } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { setBlockedUsers } from '../../store/moderationSlice';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function PostPrompt() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.prompt, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('Create')}
      activeOpacity={0.9}
    >
      <Text style={[styles.promptText, { color: '#ffffff' }]}>What's on your mind...</Text>
    </TouchableOpacity>
  );
}

function FeedHeader() {
  const isPro = useIsPro();
  return (
    <View>
      {/* {isPro && <StoriesRow />} */}
      <PostPrompt />
      <FeedQuickLinks />
    </View>
  );
}

export default function FeedScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const dispatch = useAppDispatch();

  // Keep the client-side blocked-users list in sync so blocked authors'
  // content stays hidden across sessions (Apple UGC requirement).
  const { data: blockedData } = useGetBlockedUsersQuery();
  useEffect(() => {
    if (blockedData?.entries) {
      dispatch(setBlockedUsers(blockedData.entries.map((u) => u.user_id).filter(Boolean)));
    }
  }, [blockedData, dispatch]);

  const handlePostPress = (post: Post) => {
    navigation.navigate('PostDetailModal', { postId: post.internal_id });
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        <FeedList
          onPostPress={handlePostPress}
          excludeTypes={['story']}
          ListHeaderComponent={FeedHeader}
          paddingTop={headerPad}
          onScroll={onScroll}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  prompt: {
    marginHorizontal: 8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },
  promptText: { fontSize: 15 },
});
