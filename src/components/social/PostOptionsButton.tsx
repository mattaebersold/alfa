import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MoreVertical } from 'lucide-react-native';
import ActionSheet from '../ui/ActionSheet';
import { useReportContent } from '../ui/ReportButton';

/**
 * The ⋮ on someone else's post: a short menu rather than a straight jump to
 * reporting.
 *
 * It used to go directly to "Report as inappropriate?" — the one thing the
 * dots could do, so the dots were only ever a report button in disguise. Now
 * the first thing offered is the author's profile, and reporting is the
 * second, red, as it is everywhere else. (Your own posts get PostOwnerMenu.)
 */
export default function PostOptionsButton({ postId, author, size = 18, color }: {
  postId: string;
  author?: { user_id?: string; username?: string } | null;
  size?: number;
  color?: string;
}) {
  const navigation = useNavigation<any>();
  const [open, setOpen] = useState(false);
  const report = useReportContent('post', postId);

  const options = [
    ...(author?.user_id
      ? [{
          label: author.username ? `View @${author.username}'s profile` : 'View profile',
          onPress: () => navigation.navigate('UserDetail', { userId: author.user_id, username: author.username }),
        }]
      : []),
    { label: 'Report as inappropriate', destructive: true, onPress: report },
  ];

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Post options"
      >
        {/* Vertical, and dim, like the report button it replaces: a way to do
            something with the post, not part of reading it. */}
        <MoreVertical size={size} color={color ?? 'rgba(255,255,255,0.34)'} />
      </TouchableOpacity>
      <ActionSheet visible={open} onClose={() => setOpen(false)} options={options} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
