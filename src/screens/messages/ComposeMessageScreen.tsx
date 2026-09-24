import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { FormScrollView, KeyboardAvoidingView, KEYBOARD_GAP, HomeIndicatorSpacer } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useSearchMessageUsersQuery,
  useSendMessageMutation,
  useGetMessagesQuery,
  type SendMessageArgs,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import { ComposerAttach, ComposerPhotoStrip } from '../../components/social/Composer';
import { useComposerPhotos, appendPhotosTo } from '../../hooks/useComposerPhotos';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

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
  // Up to four, the server's ceiling for a message — see uploadMessageGallery.
  const photos = useComposerPhotos(4);

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
    if (!recipient || (!body.trim() && !photos.hasPhotos)) {
      Alert.alert('Missing fields', 'Please select a recipient and write a message.');
      return false;
    }
    try {
      const fields: SendMessageArgs = {
        recipient_id: recipient.user_id,
        subject: subject.trim() || undefined,
        body: body.trim(),
      };
      // Multipart only when there's a file — see sendMessage.
      let payload: SendMessageArgs | FormData = fields;
      if (photos.hasPhotos) {
        const fd = new FormData();
        (Object.keys(fields) as (keyof SendMessageArgs)[]).forEach((key) => {
          const v = fields[key];
          if (v != null) fd.append(key, v);
        });
        appendPhotosTo(fd, photos.photos);
        payload = fd;
      }
      const msg = await sendMessage(payload).unwrap();
      navigation.replace('MessageThread', {
        threadId: msg.thread_id,
        recipientId: recipient.user_id,
        subject: subject.trim() || undefined,
      });
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      return false;
    }
  }, [recipient, subject, body, photos, sendMessage, navigation]);

  const canSend = !!recipient && (!!body.trim() || photos.hasPhotos) && !sending;

  // Send's height, kept clear under the focused field.
  const [footerH, setFooterH] = useState(0);

  return (
    // Fields above, Send pinned under them: the column shrinks by the keyboard's
    // height so Send sits on the keyboard (kit's KeyboardAvoidingView), and the
    // focused field is kept clear of Send as well.
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.cream }]}>
      <FormScrollView
        style={styles.scroll}
        bottomOffset={KEYBOARD_GAP + footerH}
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

        {/* Body — typed right here; the form keeps it above the keyboard as
            it grows. */}
        <View style={[styles.field, styles.bodyField, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.bodyHead}>
            <Text style={[styles.label, { color: colors.grey }]}>Message</Text>
            <ComposerAttach photos={photos} tint={colors.grey} />
          </View>
          <TextInput
            style={[styles.textInput, styles.bodyInput, { color: colors.fg }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your message..."
            placeholderTextColor={colors.grey}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
          />
          <ComposerPhotoStrip photos={photos} borderColor={colors.border} />
        </View>
      </FormScrollView>

      {/* Send button — always visible above the keyboard. Measured without
          the home indicator's clearance, which collapses under it as the
          keyboard rises: a height that changed mid-animation would move the
          form's scroll offset with it, and the form would bob. */}
      <View style={{ backgroundColor: colors.card }}>
      <View
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        style={[
        styles.footer,
        {
          borderTopColor: colors.border,
          paddingBottom: 12,
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
      </View>
      <HomeIndicatorSpacer height={Math.max(insets.bottom, 12) - 12} />
      </View>
    </KeyboardAvoidingView>
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
  // The label with the attach button across from it.
  bodyHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    borderRadius: PILL_RADIUS, paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start', gap: 8,
  },
  recipientName: { fontSize: 14, fontWeight: '600' },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
  },
  sendBtn:         {
    backgroundColor: colors.primaryAlt, borderRadius: COMMON_RADIUS,
    paddingVertical: 15, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
