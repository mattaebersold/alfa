import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import Button from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { CONFIG } from '../../constants/config';
import type { AuthScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts'

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
      await axios.post(`${CONFIG.API_BASE_URL}/api/password-reset/request`, {
        email: email.trim().toLowerCase(),
      });
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
      <FormScrollView style={styles.flex} contentContainerStyle={styles.container}>
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
          variant="dark"
        />
      </FormScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  backBtn: { marginBottom: 24 },
  back: { fontSize: 14, color: colors.primaryAlt, fontFamily: FONT_INTER.semibold },
  title: { fontSize: 26, fontFamily: FONT_INTER.bold, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: FONT_INTER.semibold, marginBottom: 6 },
});
