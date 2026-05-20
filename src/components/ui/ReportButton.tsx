import React from 'react';
import { TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { useCreateReportMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

interface ReportButtonProps {
  contentType: 'post' | 'car' | 'comment';
  contentId: string;
  size?: number;
}

export default function ReportButton({ contentType, contentId, size = 20 }: ReportButtonProps) {
  const colors = useColors();
  const [createReport] = useCreateReportMutation();

  const handlePress = () => {
    Alert.alert(
      'Options',
      undefined,
      [
        {
          text: 'Report as inappropriate',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Report',
              'Are you sure you want to report this as inappropriate?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await createReport({ content_type: contentType, content_id: contentId }).unwrap();
                      Alert.alert('Reported', 'Thank you for your report. We\'ll review it shortly.');
                    } catch (err: any) {
                      if (err?.status === 409) {
                        Alert.alert('Already reported', 'You\'ve already reported this.');
                      } else {
                        Alert.alert('Error', 'Failed to submit report. Please try again.');
                      }
                    }
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={8} style={styles.btn}>
      <MoreHorizontal size={size} color={colors.grey} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
