import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../ui/Avatar';
import ImageLightbox from '../ui/ImageLightbox';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { GalleryItem, User } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * One message in a conversation — a direct message or a marketplace one.
 *
 * The two threads had grown the same bubble separately, and when photos came
 * to direct messages the marketplace's bubble already knew how to draw one.
 * This is that bubble, shared, so a picture looks the same whichever inbox it
 * was sent from.
 *
 * The photo sits above the words in its own rounded block rather than inside
 * the bubble: "is this the wheel you mean?" is usually a picture with a line
 * under it, and a picture boxed in a chat bubble's padding reads as an
 * attachment to something. Several photos tile smaller, so four don't stack
 * into a column taller than the screen.
 */
export default function ThreadBubble({ body, gallery, createdAt, isMe, sender, showTime }: {
  body?: string;
  gallery?: GalleryItem[] | null;
  createdAt?: string;
  isMe: boolean;
  /** Who wrote it — drawn beside their bubbles, never beside your own. */
  sender?: User;
  /** Only the newest message from each side is stamped — see the threads' `stampedIds`. */
  showTime: boolean;
}) {
  const c = useColors();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = (gallery ?? [])
    .map((g) => imageUrl(g.filename))
    .filter((u): u is string => !!u);
  const timeAgo = createdAt ? formatDistanceToNow(new Date(createdAt), { addSuffix: true }) : '';
  const side = isMe ? styles.sideMe : styles.sideThem;

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && <Avatar user={sender} size={28} />}
      <View style={styles.bubbleBody}>
        {photos.length > 0 && (
          <View style={[styles.photoGrid, side]}>
            {photos.map((uri, i) => (
              <TouchableOpacity
                key={`${uri}_${i}`}
                onPress={() => setLightboxIndex(i)}
                activeOpacity={0.85}
                accessibilityRole="imagebutton"
                accessibilityLabel="View photo"
              >
                <Image
                  source={{ uri }}
                  style={[styles.photo, photos.length > 1 && styles.photoSmall]}
                  contentFit="cover"
                  transition={150}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {!!body && (
          <View style={[
            styles.bubbleContent,
            isMe
              ? styles.bubbleContentMe
              : { backgroundColor: c.card, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
          ]}>
            <Text style={[styles.bubbleText, { color: c.fg }, isMe && styles.bubbleTextMe]}>
              {body}
            </Text>
          </View>
        )}
        {showTime && timeAgo ? (
          <Text style={[styles.bubbleTime, { color: c.grey }, isMe && { textAlign: 'right' }]}>
            {timeAgo}
          </Text>
        ) : null}
      </View>

      <ImageLightbox
        images={photos}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble:     { flexDirection: 'row', marginBottom: 12, gap: 8 },
  bubbleMe:   { flexDirection: 'row-reverse' },
  bubbleThem: {},
  bubbleBody: { flex: 1 },
  sideMe:     { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  sideThem:   { alignSelf: 'flex-start', justifyContent: 'flex-start' },
  bubbleContent: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%',
  },
  bubbleContentMe: { backgroundColor: colors.primaryAlt, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText:      { fontSize: 15, lineHeight: 21 },
  bubbleTextMe:    { color: '#FFFFFF' },
  bubbleTime:      { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
  photoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: '85%', marginBottom: 4 },
  photo:      { width: 200, height: 200, borderRadius: COMMON_RADIUS },
  // Two to a row once there's more than one.
  photoSmall: { width: 120, height: 120 },
});
