import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetStoriesFeedQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { imageUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const BUBBLE_SIZE = 56;

function AddStoryBubble({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.bubbleWrapper} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.bubble, { borderColor: colors.border, borderStyle: 'dashed' }]}>
        <Text style={[styles.plusSign, { color: colors.grey }]}>+</Text>
      </View>
      <Text style={[styles.label, { color: colors.grey }]} numberOfLines={1}>
        Your Story
      </Text>
    </TouchableOpacity>
  );
}

function StoryBubble({
  story, onPress,
}: { story: Post & { seen?: boolean }; onPress: () => void }) {
  const colors = useColors();
  const user = (story.user_objectid ?? story.user) as any;
  const username: string = user?.username ?? '';
  const displayName = username.length > 8 ? username.slice(0, 7) + '…' : username;
  const profileFilename: string | undefined = user?.profile_image ?? user?.gallery?.[0]?.filename;
  const profileUri = profileFilename ? imageUrl(profileFilename) : null;
  const ringColor = story.seen ? colors.border : '#22c55e';

  return (
    <TouchableOpacity style={styles.bubbleWrapper} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.bubble, { borderColor: ringColor }]}>
        {profileUri ? (
          <Image source={{ uri: profileUri }} style={styles.bubbleImage} contentFit="cover" />
        ) : (
          <View style={[styles.bubbleFallback, { backgroundColor: Colors.brg }]}>
            <Text style={styles.bubbleFallbackText}>
              {username.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: colors.grey }]} numberOfLines={1}>
        {displayName}
      </Text>
    </TouchableOpacity>
  );
}

export default function StoriesRow() {
  const navigation = useNavigation<NavProp>();
  const { isLoggedIn } = useAppSelector((s) => s.auth);
  const { data, isLoading } = useGetStoriesFeedQuery(undefined, { skip: !isLoggedIn });

  const stories = data?.stories ?? [];

  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Colors.brg} />
      </View>
    );
  }

  return (
    <FlatList
      horizontal
      data={[null, ...stories]}
      keyExtractor={(item, i) => (item ? (item as Post).internal_id : 'add')}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      renderItem={({ item, index }) => {
        if (item === null) {
          return <AddStoryBubble onPress={() => navigation.navigate('CreateStory')} />;
        }
        const story = item as Post;
        return (
          <StoryBubble
            story={story}
            onPress={() =>
              navigation.navigate('StoryViewer', { stories, startIndex: index - 1 })
            }
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loadingRow:       { height: 90, justifyContent: 'center', alignItems: 'center' },
  row:              { paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  bubbleWrapper:    { alignItems: 'center', width: BUBBLE_SIZE + 8 },
  bubble:           {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleImage:      { width: '100%', height: '100%' },
  bubbleFallback:   { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  bubbleFallbackText: { color: '#fff', fontWeight: '700', fontSize: 20 },
  plusSign:         { fontSize: 28, lineHeight: 32 },
  label:            { fontSize: 10, marginTop: 3, textAlign: 'center', width: BUBBLE_SIZE + 8 },
});
