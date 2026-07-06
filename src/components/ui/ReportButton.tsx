import React from 'react';
import { TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useCreateReportMutation } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { hideContent } from '../../store/moderationSlice';
import { useColors } from '../../hooks/useColors';

interface ReportButtonProps {
  contentType: 'post' | 'car' | 'comment' | 'user';
  contentId: string;
  size?: number;
  color?: string;
}

export default function ReportButton({ contentType, contentId, size = 20, color }: ReportButtonProps) {
  const colors = useColors();
  const dispatch = useAppDispatch();
  const [createReport] = useCreateReportMutation();

  const handlePress = () => {
    Alert.alert(
      'Report as inappropriate?',
      'This content will be hidden and sent to our moderation team.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            // Hide immediately for the reporter, then send the report.
            dispatch(hideContent(contentId));
            try {
              await createReport({ content_type: contentType, content_id: contentId }).unwrap();
              Alert.alert('Reported', 'Content reported successfully.');
            } catch {
              Alert.alert('Report failed', 'Could not send the report. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={8} style={styles.btn}>
      <MoreHorizontal size={size} color={color ?? colors.grey} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
