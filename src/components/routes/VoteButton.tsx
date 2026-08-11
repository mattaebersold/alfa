import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVoteRouteMutation, useUnvoteRouteMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';

/**
 * The vote control for a route.
 *
 * Votes reuse the shared Like collection server-side, but they get their own
 * control because an upvote on a road recommendation reads differently from a
 * heart on a photo — and because routes are ranked by it.
 *
 * The count updates optimistically so a tap feels instant, and rolls back if
 * the request fails rather than leaving a number that disagrees with the server.
 */
interface VoteButtonProps {
  routeId: string;
  initialCount: number;
  initialVoted?: boolean;
  /** Larger presentation for the detail screen. */
  large?: boolean;
}

export default function VoteButton({
  routeId,
  initialCount,
  initialVoted = false,
  large = false,
}: VoteButtonProps) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);

  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [vote] = useVoteRouteMutation();
  const [unvote] = useUnvoteRouteMutation();

  const toggle = async () => {
    const next = !voted;
    setVoted(next);
    setCount((c) => c + (next ? 1 : -1));
    Haptics.selectionAsync().catch(() => {});

    try {
      const result = await (next ? vote(routeId) : unvote(routeId)).unwrap();
      // Trust the server's number over the optimistic one — someone else may
      // have voted between render and tap.
      setCount(result.vote_count);
      setVoted(result.has_voted);
    } catch {
      setVoted(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        large && styles.btnLarge,
        voted ? { backgroundColor: brand, borderColor: brand } : { borderColor: colors.border },
      ]}
      onPress={toggle}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={voted ? 'Remove your vote' : 'Vote for this route'}
    >
      <ChevronUp size={large ? 19 : 16} color={voted ? onBrand : colors.fg} strokeWidth={2.6} />
      <Text
        style={[
          large ? styles.labelLarge : styles.label,
          { color: voted ? onBrand : colors.fg },
        ]}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 11, height: 32,
    borderRadius: 100, borderWidth: 1.5,
  },
  btnLarge:   { paddingHorizontal: 16, height: 42 },
  label:      { fontSize: 14, fontWeight: '800' },
  labelLarge: { fontSize: 16, fontWeight: '800' },
});
