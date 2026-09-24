import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import { KeyboardAvoidingView } from '@ors/kit';
import { BlurView } from 'expo-blur';
import { useAppSelector } from '../../store/store';
import { useUpdateUserSettingMutation } from '../../api/apiService';
import Button from '../ui/Button';
import { validateZip, sanitizeZip } from '../../utils/zip';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';

/** An account this young, with no zip, is one Google or Apple just made. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

/**
 * Asks for the zip the registration form would have.
 *
 * Google and Apple sign-ins never pass through that form, so they arrive with
 * no zip — and with no zip there is nothing to measure "near you" from, and the
 * member is filed under no region at all. This fills the gap once, over the app.
 *
 * Driven entirely by the profile's `hasZip`: saving writes the zip, the 'User'
 * tag refetches the profile, and the prompt never renders again. Nothing is
 * remembered on the device, so a member who skips it is asked again next
 * launch, on any device, until there's a zip on file.
 *
 * A brand-new account can't skip — this is the last step of signing up. An
 * older one that simply never had a zip gets "Not now", for this session.
 */
export default function ZipPrompt() {
  const userInfo = useAppSelector((s) => s.auth.userInfo);
  const c = useColors();
  const [updateUserSetting, { isLoading }] = useUpdateUserSettingMutation();
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saved, setSaved] = useState(false);

  // `false`, not falsy: a server that predates the flag sends nothing, and
  // that must not read as "ask everyone".
  if (!userInfo || userInfo.hasZip !== false || saved || dismissed) return null;

  const created = userInfo.created_at ? new Date(userInfo.created_at).getTime() : 0;
  const isNew = Date.now() - created < NEW_ACCOUNT_MS;

  const save = async () => {
    const problem = validateZip(zip);
    if (problem) { setError(problem); return; }
    try {
      await updateUserSetting({ type: 'zip', zip: zip.trim() }).unwrap();
      setSaved(true);
    } catch (e: any) {
      setError(e?.data?.error ?? "Couldn't save your zip code. Try again.");
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !isNew && setDismissed(true)}>
      {/* A short card, centred in the room above the keyboard. */}
      <KeyboardAvoidingView style={styles.backdrop}>
        <BlurView intensity={40} tint="dark" style={styles.card}>
          <Text style={styles.title}>
            {isNew ? 'Add your zip code to finish registering' : 'Add your zip code'}
          </Text>
          <Text style={styles.body}>
            This is used to find members, events, and marketplace items near you.
            Your zip code is never shown to anyone.
          </Text>

          <Text style={styles.label}>Zip Code</Text>
          <TextInput
            style={[ss.input, { borderColor: c.inputBorder, borderWidth: 1.5, color: c.fg, backgroundColor: c.inputBg }]}
            value={zip}
            onChangeText={(v) => { setZip(sanitizeZip(v)); setError(null); }}
            keyboardType="number-pad"
            textContentType="postalCode"
            autoComplete="postal-code"
            maxLength={5}
            returnKeyType="done"
            onSubmitEditing={save}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.gap} />
          <Button
            label={isNew ? 'Finish' : 'Save'}
            onPress={save}
            loading={isLoading}
            disabled={zip.length !== 5}
            size="full"
            variant="dark"
          />

          {!isNew && (
            <TouchableOpacity style={styles.later} onPress={() => setDismissed(true)} activeOpacity={0.7}>
              <Text style={styles.laterLabel}>Not now</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#FFFFFF' },
  error: { fontSize: 11, marginTop: 5, lineHeight: 15, color: '#FFB4A8', fontWeight: '600' },
  gap: { height: 16 },
  later: { alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 16 },
  laterLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});
