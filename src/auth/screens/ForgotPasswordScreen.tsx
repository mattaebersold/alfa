import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Text, TextInput } from '../../theme/Text';
import FormScrollView from '../../keyboard/FormScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { colors } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { requestPasswordReset } from '../authSlice';
import type { AuthScreenProps } from '../branding';
import { ss } from '../../theme/shared';
import { FONT_INTER } from '../../theme/fonts'

export default function ForgotPasswordScreen({ navigation }: AuthScreenProps<'ForgotPassword'>) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = useColors();

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      Alert.alert(
        'Email Sent',
        'If an account exists for that email, a password reset link has been sent.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
      <FormScrollView style={styles.flex}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.fg }]}>Forgot Password</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Enter the email associated with your account and we'll send a reset link.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.fg }]}>Email</Text>
            <TextInput
              style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.grey}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <Button
            label="Send Reset Link"
            onPress={handleSubmit}
            loading={loading}
            size="full"
            variant="brand"
          />
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  backBtn: { marginBottom: 24 },
  back: { fontSize: 14, color: '#F5EFED', fontFamily: FONT_INTER.semibold },
  title: { fontSize: 26, fontFamily: FONT_INTER.bold, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: FONT_INTER.semibold, marginBottom: 6 },
});
