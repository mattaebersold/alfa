import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useSearchMessageUsersQuery,
  useSendMessageMutation,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function UserResult({ user, onSelect }: { user: User; onSelect: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.userRow, { borderBottomColor: colors.border }]} onPress={onSelect} activeOpacity={0.7}>
      <Avatar
        filename={user.gallery?.[0]?.filename}
        name={user.firstName}
        size={36}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.fg }]}>{user.firstName} {user.lastName}</Text>
        <Text style={[styles.userHandle, { color: colors.grey }]}>@{user.username}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ComposeMessageScreen({ route }: { route: any }) {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [recipient, setRecipient] = useState<User | null>(
    route.params?.userId ? { user_id: route.params.userId, username: route.params.username ?? '' } as User : null
  );
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const { data: results = [] } = useSearchMessageUsersQuery(search, { skip: search.length < 2 });
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  const handleSend = useCallback(async () => {
    if (!recipient || !body.trim()) {
      Alert.alert('Missing fields', 'Select a recipient and write a message.');
      return;
    }
    try {
      const msg = await sendMessage({
        recipient_id: recipient.user_id,
        subject: subject.trim() || undefined,
        body: body.trim(),
      }).unwrap();
      navigation.replace('MessageThread', {
        threadId: msg.thread_id,
        recipientId: recipient.user_id,
        subject: subject.trim() || undefined,
      });
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    }
  }, [recipient, subject, body, sendMessage, navigation]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* To: field */}
        <View style={[styles.field, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.grey }]}>To</Text>
          {recipient ? (
            <View style={[styles.recipientPill, { backgroundColor: colors.segment }]}>
              <Text style={[styles.recipientName, { color: colors.fg }]}>
                {recipient.firstName} {recipient.lastName} (@{recipient.username})
              </Text>
              <TouchableOpacity onPress={() => setRecipient(null)}>
                <X size={14} color={colors.fg} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchRow}>
              <Search size={15} color={colors.grey} />
              <TextInput
                style={[styles.searchInput, { color: colors.fg }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search members..."
                placeholderTextColor={colors.grey}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* User search results */}
        {!recipient && search.length >= 2 && results.length > 0 && (
          <View style={[styles.results, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {results.slice(0, 6).map((u) => (
              <UserResult
                key={u.user_id}
                user={u}
                onSelect={() => { setRecipient(u); setSearch(''); }}
              />
            ))}
          </View>
        )}

        {/* Subject */}
        <View style={[styles.field, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.grey }]}>Subject</Text>
          <TextInput
            style={[styles.textInput, { color: colors.fg }]}
            value={subject}
            onChangeText={setSubject}
            placeholder="Optional subject"
            placeholderTextColor={colors.grey}
          />
        </View>

        {/* Body */}
        <View style={[styles.field, styles.bodyField, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.grey }]}>Message</Text>
          <TextInput
            style={[styles.textInput, styles.bodyInput, { color: colors.fg }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your message..."
            placeholderTextColor={colors.grey}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Send button */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.sendBtn, (!recipient || !body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!recipient || !body.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.sendBtnText}>Send Message</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  flex:    { flex: 1 },
  field:   {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bodyField: { flex: 1 },
  label:   { fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { fontSize: 15 },
  bodyInput: { flex: 1, minHeight: 120 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  results: { borderBottomWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600' },
  userHandle: { fontSize: 12 },
  recipientPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start', gap: 8,
  },
  recipientName: { fontSize: 14, fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1 },
  sendBtn: {
    backgroundColor: Colors.brg, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
