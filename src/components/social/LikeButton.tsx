import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLikeEntryMutation, useUnlikeEntryMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

interface LikeButtonProps {
  documentId: string;
  entryType: string;
  initialLiked?: boolean;
  initialCount?: number;
  showCount?: boolean;
  size?: number;
}

export default function LikeButton({
  documentId,
  entryType,
  initialLiked = false,
  initialCount = 0,
  showCount = true,
  size = 18,
}: LikeButtonProps) {
  const colors = useColors();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);

  // Sync with server-derived state once the live like query resolves (or refetches
  // after a like/unlike elsewhere), so the heart reflects the true "did I like this".
  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);
  useEffect(() => { setCount(initialCount); }, [initialCount]);

  const [likeEntry] = useLikeEntryMutation();
  const [unlikeEntry] = useUnlikeEntryMutation();

  const handlePress = async () => {
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
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container} activeOpacity={0.7}>
      <Heart
        size={size}
        color={liked ? '#FF4060' : colors.grey}
        fill={liked ? '#FF4060' : 'transparent'}
      />
      {showCount && count > 0 && (
        <Text style={[styles.count, liked ? styles.likedCount : { color: colors.grey }]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:  { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
  count:      { fontSize: 13, fontWeight: '500' },
  likedCount: { color: '#FF4060' },
});
