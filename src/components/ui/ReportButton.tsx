import React from 'react';
import { TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { MoreVertical } from 'lucide-react-native';
import { useCreateReportMutation } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { hideContent } from '../../store/moderationSlice';
import type { ReportableType } from '../../types/api';

interface ReportButtonProps {
  contentType: ReportableType;
  contentId: string;
  size?: number;
  color?: string;
}

/**
 * Report something: confirm, hide it for you straight away, then tell the
 * moderators. The whole flow, for anywhere that offers "Report" — this
 * button, and menus that list it among other options (PostOptionsButton).
 */
export function useReportContent(contentType: ReportableType, contentId: string) {
  const dispatch = useAppDispatch();
  const [createReport] = useCreateReportMutation();

  return () => {
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
}

export default function ReportButton({ contentType, contentId, size = 20, color }: ReportButtonProps) {
  const handlePress = useReportContent(contentType, contentId);

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={8} style={styles.btn}>
      {/* Vertical, and dim: it's a way out of trouble rather than something to
          reach for, so it shouldn't compete with the words beside it. */}
      <MoreVertical size={size} color={color ?? 'rgba(255,255,255,0.34)'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
