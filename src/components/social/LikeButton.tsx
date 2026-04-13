import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../../api/apiService';
import { Colors } from '../../constants/colors';

interface LikeButtonProps {
  documentId: string;
  entryType: string;
  initialLiked?: boolean;
  initialCount?: number;
  showCount?: boolean;
}

export default function LikeButton({
  documentId,
  entryType,
  initialLiked = false,
  initialCount = 0,
  showCount = true,
}: LikeButtonProps) {
  // Optimistic state
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  const handlePress = async () => {
    // Optimistic update
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? c - 1 : c + 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (wasLiked) {
        await unlikeEntry({ document_id: documentId, document_entry_type: entryType }).unwrap();
      } else {
        await likeEntry({ document_id: documentId, document_entry_type: entryType }).unwrap();
      }
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container} activeOpacity={0.7}>
      <Heart
        size={18}
        color={liked ? '#FF4060' : Colors.grey}
        fill={liked ? '#FF4060' : 'transparent'}
      />
      {showCount && count > 0 && (
        <Text style={[styles.count, liked && styles.likedCount]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  count: {
    fontSize: 13,
    color: Colors.grey,
    fontWeight: '500',
  },
  likedCount: {
    color: '#FF4060',
  },
});
