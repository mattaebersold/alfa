import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useSearchMessageUsersQuery,
  useSendMessageMutation,
  useGetMessagesQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useKeyboardInset, useKeyboardOverlap } from '../../hooks/useKeyboardHeight';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function UserResult({ user, onSelect }: { user: User; onSelect: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.userRow, { borderBottomColor: colors.border }]} onPress={onSelect} activeOpacity={0.7}>
      <Avatar user={user} size={36} />
      <Text style={[styles.userName, { color: colors.fg }]}>@{user.username}</Text>
    </TouchableOpacity>
  );
}

export default function ComposeMessageScreen({ route }: { route: any }) {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const [recipient, setRecipient] = useState<User | null>(
    route.params?.userId
      ? { user_id: route.params.userId, username: route.params.username ?? '' } as User
      : null,
  );
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState(route.params?.subject ?? '');
  const [body, setBody] = useState(route.params?.initialBody ?? '');

  const { data: messagesData } = useGetMessagesQuery({ limit: 100 });
  const allMessages = messagesData?.entries ?? [];

  // Find the most recent existing thread with the selected recipient
  const existingThread = React.useMemo(() => {
    if (!recipient || !allMessages.length) return null;
    return allMessages.find((m) => {
      const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id;
      return otherId === recipient.user_id;
    }) ?? null;
  }, [allMessages, recipient, myId]);

  // If there's already a thread with this person, go there instead
  useEffect(() => {
    if (existingThread && recipient) {
      navigation.replace('MessageThread', {
        threadId: existingThread.thread_id,
        recipientId: recipient.user_id,
        subject: existingThread.subject,
      });
    }
  }, [existingThread, recipient, navigation]);

  const { data: results = [] } = useSearchMessageUsersQuery(search, { skip: search.length < 2 });
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();

  const handleSend = useCallback(async () => {
    if (!recipient || !body.trim()) {
      Alert.alert('Missing fields', 'Please select a recipient and write a message.');
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
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [recipient, subject, body, sendMessage, navigation]);

  const canSend = !!recipient && !!body.trim() && !sending;

  /**
   * Lift the whole screen off the keyboard.
   *
   * This was a KeyboardAvoidingView, which needed a `keyboardVerticalOffset`
   * guessed from the nav header's height on iOS and did nothing at all useful
   * on Android — `behavior="height"` has no window resize to work with in an
   * edge-to-edge app, so the keyboard simply covered the message field and the
   * Send button. Padding by the measured inset needs no guess and behaves the
   * same on both.
   */
  const { animated: keyboardPad, height: keyboardHeight } = useKeyboardInset();

  /**
   * And a measured correction on top of it.
   *
   * The padding above is computed from the reported keyboard height, which is
   * right on iOS and can be short by a navigation bar on Android. This measures
   * the footer against the keyboard's actual top edge and makes up whatever is
   * missing — zero, wherever the arithmetic was already right.
   */
  const footerRef = useRef<View>(null);
  const { animated: footerLift, onLayout: onFooterLayout } = useKeyboardOverlap(footerRef);

  return (
    <Animated.View
      style={[styles.root, { backgroundColor: colors.cream, paddingBottom: keyboardPad }]}
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* To: */}
        <View style={[styles.field, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.grey }]}>To</Text>
          {recipient ? (
            <View style={[styles.recipientPill, { backgroundColor: colors.segment }]}>
              <Text style={[styles.recipientName, { color: colors.fg }]}>@{recipient.username}</Text>
              <TouchableOpacity onPress={() => setRecipient(null)} hitSlop={8}>
                <X size={14} color={colors.fg} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.searchRow}>
              <Search size={15} color={colors.grey} />
              <TextInput
                style={[styles.textInput, { color: colors.fg }]}
                value={search}
                onChangeText={setSearch}
                placeholder="Search members..."
                placeholderTextColor={colors.grey}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
        </View>

        {/* User search results */}
        {!recipient && search.length >= 2 && results.length > 0 && (
          <View style={[styles.results, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {results.slice(0, 6).map((u) => (
              <UserResult key={u.user_id} user={u} onSelect={() => { setRecipient(u); setSearch(''); }} />
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
            returnKeyType="next"
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
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Send button — always visible above the keyboard */}
      <Animated.View
        ref={footerRef}
        onLayout={onFooterLayout}
        style={[
        styles.footer,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          // The home indicator's clearance is only needed while the keyboard is
          // down; with it up, the root's padding has already lifted the footer
          // clear and this would just be a gap above the keys.
          paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 12),
          marginBottom: footerLift,
        },
      ]}>
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.sendBtnText}>Send Message</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { flexGrow: 1 },

  field: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bodyField:     { minHeight: 160 },
  label:         { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput:     { fontSize: 15, padding: 0 },
  bodyInput:     { minHeight: 120, textAlignVertical: 'top' },

  searchRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },

  results:       { borderBottomWidth: 1 },
  userRow:       {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  userName:      { fontSize: 14, fontWeight: '600' },

  recipientPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start', gap: 8,
  },
  recipientName: { fontSize: 14, fontWeight: '600' },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
  },
  sendBtn:         {
    backgroundColor: colors.primaryAlt, borderRadius: 10,
    paddingVertical: 15, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
