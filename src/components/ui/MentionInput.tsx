import React, { useState, useRef, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
} from 'react-native';
import { useSearchUsersQuery } from '../../api/apiService';
import Avatar from './Avatar';
import { useColors } from '../../hooks/useColors';

interface MentionInputProps {
  value: string;
  onChangeText: (text: string, mentionedUserIds: string[]) => void;
  placeholder?: string;
  style?: any;
  containerStyle?: any;
  placeholderTextColor?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function MentionInput({
  value,
  onChangeText,
  placeholder,
  style,
  containerStyle,
  placeholderTextColor,
  multiline,
  autoFocus,
  onFocus,
  onBlur,
}: MentionInputProps) {
  const c = useColors();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const mentionedIds = useRef<Set<string>>(new Set());

  const { data: searchData } = useSearchUsersQuery(mentionQuery ?? '', {
    skip: mentionQuery === null || mentionQuery.length < 1,
  });
  const results = searchData?.entries ?? [];

  const handleChangeText = useCallback((text: string) => {
    // Detect if the last word is an @mention
    const match = text.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
    onChangeText(text, Array.from(mentionedIds.current));
  }, [onChangeText]);

  const selectUser = useCallback((user: any) => {
    const userId = user.user_id;
    const username = user.username;
    mentionedIds.current.add(userId);

    // Replace the partial @query with the full @username
    const replaced = value.replace(/@(\w*)$/, `@${username} `);
    setMentionQuery(null);
    onChangeText(replaced, Array.from(mentionedIds.current));
  }, [value, onChangeText]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {mentionQuery !== null && results.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Rendered with map() rather than a FlatList: this input often lives
              inside a ScrollView, and a nested VirtualizedList warns/breaks. The
              suggestion list is tiny (≤6), so a plain map is the right tool. */}
          {results.slice(0, 6).map((item: any) => (
            <TouchableOpacity
              key={item.user_id}
              style={[styles.resultRow, { borderBottomColor: c.border }]}
              onPress={() => selectUser(item)}
              activeOpacity={0.7}
            >
              <Avatar
                user={item}
                size={28}
              />
              <Text style={[styles.username, { color: c.fg }]}>@{item.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        style={[style, multiline && contentHeight ? { height: contentHeight } : null]}
        multiline={multiline}
        onContentSizeChange={
          multiline ? (e) => setContentHeight(e.nativeEvent.contentSize.height) : undefined
        }
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { position: 'relative' },
  dropdown:   {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 220,
    zIndex: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  resultRow:  {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  username:   { fontSize: 14, fontWeight: '600' },
});
