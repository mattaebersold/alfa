import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { imageUrl } from '../../utils/image';
import { avatarColorFor, initialsFor } from '../../utils/avatarColor';

/**
 * Only the fields an avatar reads.
 *
 * Deliberately not `Partial<User>`: the app has several narrower user-shaped
 * types (a group member's `user`, a mention result, a message's sender) and a
 * structural subset accepts all of them without each caller having to widen.
 */
export interface AvatarUser {
  user_id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  gallery?: { filename?: string }[] | null;
  profilePicture?: string | null;
  avatarColor?: string | null;
}

/**
 * A member's photo, or their initials on a colour that's theirs.
 *
 * Pass `user` wherever the record is on hand: it supplies the photo, the first
 * and last initial, and the colour in one go. The loose `filename`/`name` props
 * are still here for the few callers that hold a picture and a label but no
 * user — and they override `user` when both are given.
 *
 * The colour is the member's own `avatarColor` when the server has sent one,
 * and otherwise is derived from their user_id by the same function the server
 * uses, so an account that predates the field still gets a stable colour rather
 * than falling back to a shared default.
 */
interface AvatarProps {
  /** The member this stands for. Supplies photo, initials and colour. */
  user?: AvatarUser | null;
  /** Photo override — wins over `user`'s own. */
  filename?: string | null;
  /** Label override, used for initials when there's no first/last name. */
  name?: string;
  size?: number;
  /** Corner radius. Defaults to a circle; pass a smaller value for a squircle. */
  radius?: number;
}

export default function Avatar({ user, filename, name, size = 40, radius }: AvatarProps) {
  const source = filename ?? user?.gallery?.[0]?.filename ?? user?.profilePicture;
  const uri = imageUrl(source);
  const corner = radius ?? size / 2;
  const [failed, setFailed] = useState(false);

  // Reset the error state if the source changes.
  useEffect(() => { setFailed(false); }, [uri]);

  const initials = initialsFor({
    firstName: user?.firstName,
    lastName: user?.lastName,
    username: user?.username,
    name,
  });

  // user_id first: it's the seed the server stamps from, and it doesn't change
  // when someone renames themselves. A handle is the fallback for the callers
  // that only pass a name.
  const background = user?.avatarColor || avatarColorFor(user?.user_id ?? user?.username ?? name);

  const showImage = uri && !failed;

  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: corner, backgroundColor: background },
    ]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: corner }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={[styles.initials, { fontSize: size * (initials.length > 1 ? 0.38 : 0.46) }]}
          numberOfLines={1}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    // The palette is built to clear 4.5:1 against white, but an avatar can land
    // on a photo or a pale card, so the letters carry their own edge.
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
