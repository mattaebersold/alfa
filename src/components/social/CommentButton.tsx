import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';

interface CommentButtonProps {
  count?: number;
  onPress?: () => void;
  /** Ink for the icon and count. Defaults to the muted grey. */
  color?: string;
}

export default function CommentButton({ count = 0, onPress, color }: CommentButtonProps) {
  const colors = useColors();
  // Callers placing this over a photo pass white; everywhere else keeps the
  // muted grey it has always used.
  const ink = color ?? colors.grey;
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
      <MessageCircle size={18} color={ink} />
      {count > 0 && <Text style={[styles.count, { color: ink }]}>{count}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
  count:     { fontSize: 13, fontWeight: '500' },
});
