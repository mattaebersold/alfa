import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { MailCheck, UserPlus } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import { useInviteFriendMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { colors as palette } from '../../constants/colors';
import { ss } from '../../styles/shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Invite a friend" — an email address in, a signup link out.
 *
 * The server records the invite against you, and when the friend registers it
 * connects their account to yours — you're the first member their home feed
 * suggests, and your cars the first cars. The copy says so, because that's the
 * part that makes it worth doing rather than just telling them the app's name.
 *
 * A summary panel rather than a screen: it's one field, and it grows out of the
 * menu row you tapped, like every other summary in the app.
 */
export default function InviteFriendModal({
  visible,
  origin,
  onClose,
}: {
  visible: boolean;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const [invite, { isLoading }] = useInviteFriendMutation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Each opening starts on an empty form rather than on the last send.
  useEffect(() => {
    if (!visible) return;
    setEmail('');
    setError(null);
    setSentTo(null);
  }, [visible]);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const send = async () => {
    const address = email.replace(/\s/g, '').toLowerCase();
    if (!EMAIL_RE.test(address)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    try {
      await invite({ email: address }).unwrap();
      Keyboard.dismiss();
      setSentTo(address);
      setEmail('');
    } catch (err: any) {
      setError(err?.data?.error ?? "We couldn't send that invite. Please try again.");
    }
  };

  const canSend = email.trim().length > 0 && !isLoading;

  return (
    <SummaryModal visible={visible} onClose={close} origin={origin}>
      <View style={styles.body}>
        <View style={[styles.iconDisc, { backgroundColor: brand }]}>
          {sentTo
            ? <MailCheck size={22} color="#000000" strokeWidth={2.2} />
            : <UserPlus size={22} color="#000000" strokeWidth={2.2} />}
        </View>

        {sentTo ? (
          <>
            <Text style={[styles.title, { color: colors.fg }]}>Invite sent</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              We emailed <Text style={{ color: colors.fg, fontWeight: '700' }}>{sentTo}</Text> a
              link to join. When they sign up, you'll be the first member we suggest they follow.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: brand }]}
              onPress={() => setSentTo(null)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Invite someone else</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.fg }]}>Invite a friend</Text>
            <Text style={[styles.copy, { color: colors.muted }]}>
              Know someone who belongs here? We'll email them a link to join. Once they
              sign up, you'll be the first member we suggest they follow, and your cars
              the first cars they see.
            </Text>

            <TextInput
              style={[
                ss.input,
                styles.input,
                {
                  color: colors.fg,
                  backgroundColor: colors.inputBg,
                  borderColor: error ? palette.red : colors.inputBorder,
                },
              ]}
              value={email}
              onChangeText={(text) => { setEmail(text); if (error) setError(null); }}
              placeholder="friend@example.com"
              placeholderTextColor={colors.grey}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={canSend ? send : undefined}
              editable={!isLoading}
              accessibilityLabel="Friend's email address"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: brand }, !canSend && styles.buttonDisabled]}
              onPress={send}
              disabled={!canSend}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send invite"
            >
              {isLoading
                ? <ActivityIndicator color="#000000" />
                : <Text style={styles.buttonText}>Send invite</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  // The top padding clears SummaryModal's floating close button.
  body:     { padding: 20, paddingTop: 22, gap: 10 },
  iconDisc: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  copy:     { fontSize: 14, lineHeight: 20 },
  input:    { marginTop: 6 },
  error:    { fontSize: 13, color: palette.red, marginTop: -2 },
  button:   {
    marginTop: 6, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  buttonDisabled: { opacity: 0.5 },
  // Black on both brand fills — see SummaryModal's action button.
  buttonText: { fontSize: 16, fontWeight: '600', color: '#000000' },
});
