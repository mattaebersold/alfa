import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { registerUser, clearError, clearSuccess } from '../../store/authSlice';
import Button from '../../components/ui/Button';
import { Colors } from '../../constants/colors';
import type { AuthScreenProps } from '../../navigation/types';

export default function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const { loading, error, success } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    zip: '',
  });

  useEffect(() => {
    if (success) {
      Alert.alert('Account Created', 'You can now sign in with your credentials.', [
        {
          text: 'Sign In',
          onPress: () => {
            dispatch(clearSuccess());
            navigation.navigate('Login');
          },
        },
      ]);
    }
  }, [success]);

  const handleChange = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleRegister = () => {
    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!form.firstName || !form.lastName || !form.username || !form.email || !form.password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    const fd = new FormData();
    fd.append('firstName', form.firstName.trim());
    fd.append('lastName', form.lastName.trim());
    fd.append('username', form.username.trim().toLowerCase());
    fd.append('email', form.email.trim().toLowerCase());
    fd.append('password', form.password);
    fd.append('zip', form.zip.trim());

    dispatch(clearError());
    dispatch(registerUser(fd));
  };

  const fields: { key: keyof typeof form; label: string; placeholder: string; secure?: boolean; keyboard?: any }[] = [
    { key: 'firstName', label: 'First Name *', placeholder: 'Jane' },
    { key: 'lastName', label: 'Last Name *', placeholder: 'Smith' },
    { key: 'username', label: 'Username *', placeholder: 'janesmith' },
    { key: 'email', label: 'Email *', placeholder: 'jane@example.com', keyboard: 'email-address' },
    { key: 'password', label: 'Password *', placeholder: '••••••••', secure: true },
    { key: 'confirmPassword', label: 'Confirm Password *', placeholder: '••••••••', secure: true },
    { key: 'zip', label: 'Zip Code', placeholder: '90210', keyboard: 'numeric' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {fields.map(({ key, label, placeholder, secure, keyboard }) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={handleChange(key)}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.grey}
                  secureTextEntry={secure}
                  autoCapitalize={key === 'username' || key === 'email' ? 'none' : 'words'}
                  keyboardType={keyboard ?? 'default'}
                  autoCorrect={false}
                />
              </View>
            ))}

            <View style={styles.gap} />

            <Button
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              size="full"
              variant="dark"
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.signinLink}
            >
              <Text style={styles.signinText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },
  topRow: { marginBottom: 24 },
  back: { fontSize: 14, color: Colors.brg, fontWeight: '600', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.fg },
  form: { gap: 0 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: Colors.red, fontSize: 14, fontWeight: '500' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.fg, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.fg,
    backgroundColor: Colors.inputBg,
  },
  gap: { height: 8 },
  signinLink: { alignItems: 'center', marginTop: 16 },
  signinText: { fontSize: 14, color: Colors.brg, fontWeight: '500' },
});
