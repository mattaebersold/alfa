import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Bookmark } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGetLoggedInUserQuery, useTogglePostBookmarkMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useBrandColor } from '../../hooks/useBrandColor';
import { formatActionCount } from '../../utils/text';
import { COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * Save a post to come back to — the posts half of the menu's Bookmarks, as
 * the button on a model's page is the cars half.
 *
 * Whether it's saved is read from your profile (`postBookmarks`), which the
 * toggle updates in the cache on the tap, so every card showing this post
 * agrees at once. The count is the post's own, nudged locally by your tap
 * until the feed next refetches it.
 */
export default function PostBookmarkButton({ postId, count = 0, size = 26, vertical = true }: {
  postId: string;
  count?: number;
  size?: number;
  vertical?: boolean;
}) {
  const brand = useBrandColor();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !isLoggedIn });
  const saved = !!me?.postBookmarks?.includes(postId);
  const [toggle] = useTogglePostBookmarkMutation();
  // Your own tap, until the post's count catches up with it.
  const [delta, setDelta] = useState(0);
  const shown = Math.max(0, count + delta);

  const onPress = async () => {
    if (!isLoggedIn) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const step = saved ? -1 : 1;
    setDelta((d) => d + step);
    try {
      await toggle({ post_id: postId }).unwrap();
    } catch {
      setDelta((d) => d - step);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, vertical ? styles.vertical : styles.horizontal]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark'}
      accessibilityState={{ selected: saved }}
    >
      <Bookmark
        size={size}
        color={saved ? brand : COLOR_WHITE}
        fill={saved ? brand : 'transparent'}
        strokeWidth={1.8}
      />
      {shown > 0 && <Text style={styles.count}>{formatActionCount(shown)}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:        { alignItems: 'center', padding: 4 },
  vertical:   { gap: 3 },
  horizontal: { flexDirection: 'row', gap: 5 },
  count: {
    color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
