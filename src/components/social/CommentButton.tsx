import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';

interface CommentButtonProps {
  count?: number;
  onPress?: () => void;
}

export default function CommentButton({ count = 0, onPress }: CommentButtonProps) {
  const colors = useColors();
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <MessageCircle size={18} color={colors.grey} />
      {count > 0 && <Text style={[styles.count, { color: colors.grey }]}>{count}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  count:     { fontSize: 13, fontWeight: '500' },
});
