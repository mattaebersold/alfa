import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import Avatar from '../ui/Avatar';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useGetUserByIdQuery } from '../../api/apiService';
import { formatActionCount } from '../../utils/text';
import { COLOR_GRAY_42, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const FACE = 22;

/** One liker's face — looked up by id, and shared with the likers panel's rows. */
function Face({ userId, first }: { userId: string; first: boolean }) {
  const { data: user } = useGetUserByIdQuery(userId, { skip: !userId });
  return (
    <View style={[styles.face, !first && styles.overlap]}>
      <Avatar user={user} size={FACE} />
    </View>
  );
}

/**
 * The faces of the last few people to like a post, overlapping — beside the
 * heart on the post's action rail. Tapping them opens the likers panel, a row
 * per person. Past `max` of them, a "+x" circle leads the stack for the rest —
 * it sits on the left because the row reads leftward from the heart.
 */
export default function LikerFaces({ likers, total, max = 3, onOpen, style }: {
  /** user_ids, most recent first. */
  likers: string[];
  /** Everyone who liked it — the "+x" is what's past the faces. */
  total: number;
  max?: number;
  onOpen: (origin: SummaryOrigin | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const faces = likers.slice(0, max);
  if (faces.length === 0) return null;
  const rest = total - faces.length;
  return (
    <SummaryTouchable
      style={[styles.row, style]}
      onPress={onOpen}
      accessibilityLabel="See everyone who liked this"
    >
      {total > max && rest > 0 && (
        <View style={[styles.face, styles.more]}>
          <Text style={styles.moreText}>+{formatActionCount(rest)}</Text>
        </View>
      )}
      {faces.map((id, i) => <Face key={id} userId={id} first={i === 0 && !(total > max && rest > 0)} />)}
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center' },
  // A dark ring so each face stands off the next, and off any photo.
  face:    { borderRadius: FACE / 2 + 2, borderWidth: 2, borderColor: 'rgba(0,0,0,0.55)' },
  overlap: { marginLeft: -8 },
  // A face-sized circle, so it reads as one more in the stack.
  more: {
    minWidth: FACE + 4, height: FACE + 4, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR_GRAY_42,
  },
  moreText: { color: COLOR_WHITE, fontSize: 9.5, fontFamily: FONT_INTER.extrabold },
});
