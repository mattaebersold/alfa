import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { Camera } from 'lucide-react-native';
import { useRequestCarPhotosMutation, useRequestProfilePhotoMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * "Ask for photos" — on someone else's car with none, or someone else's
 * profile with no photo (`kind="profile"`).
 *
 * Sends the owner a notice and a push (see horacio's
 * carPhotoRequestController). Once asked, it says so and stays pressed: the
 * server only ever sends one per asker per car or member, so a second tap
 * would be a button that does nothing.
 */
export default function AskForPhotosButton({ carId, userId, ownerName, kind = 'car' }: {
  /** The car, for `kind="car"`. */
  carId?: string;
  /** The member, for `kind="profile"`. */
  userId?: string;
  /** For the label — "Ask @matt for photos". */
  ownerName?: string;
  kind?: 'car' | 'profile';
}) {
  const colors = useColors();
  const [requestCar, { isLoading: carLoading }] = useRequestCarPhotosMutation();
  const [requestProfile, { isLoading: profileLoading }] = useRequestProfilePhotoMutation();
  const isLoading = carLoading || profileLoading;
  const [asked, setAsked] = useState(false);
  const who = ownerName ? `@${ownerName}` : kind === 'car' ? 'the owner' : 'them';

  const ask = async () => {
    try {
      if (kind === 'profile') await requestProfile(userId ?? '').unwrap();
      else await requestCar(carId ?? '').unwrap();
      setAsked(true);
    } catch (e: any) {
      Alert.alert("Couldn't ask", e?.data?.error ?? 'Please try again.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.btn, { borderColor: colors.borderDark }, asked && styles.btnDone]}
      onPress={ask}
      disabled={asked || isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={asked ? 'Photo requested' : kind === 'car' ? `Ask ${who} for photos` : `Ask ${who} for a profile photo`}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.fg} />
      ) : (
        <>
          <Camera size={16} color={colors.fg} />
          <Text style={[styles.text, { color: colors.fg }]}>
            {asked
              ? (kind === 'car' ? 'Asked for photos 😉' : 'Asked for a photo 😉')
              : kind === 'car' ? `Ask ${who} for photos 🙏` : `Ask ${who} for a profile photo 🙏`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Dashed, like the empty-state panels: it stands in for the photos that
  // aren't there.
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: COMMON_RADIUS, borderWidth: 1.5, borderStyle: 'dashed',
    minHeight: 46,
  },
  btnDone: { opacity: 0.6 },
  text: { fontSize: 14, fontFamily: FONT_INTER.bold, flexShrink: 1 },
});
