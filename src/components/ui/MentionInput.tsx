import React, { useState, useRef, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { Car as CarIcon } from 'lucide-react-native';
import { useSearchUsersQuery, useGetCarsQuery } from '../../api/apiService';
import Avatar from './Avatar';
import { useColors } from '../../hooks/useColors';
import { buildCarMention, carDisplayName } from '../../utils/mentions';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';

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
  /**
   * Turn the OS keyboard's corrections and spelling suggestions off.
   *
   * On by default: everything typed through this is prose — a comment, a
   * reply, a message — and prose wants a spell checker. Set this on a field
   * where a correction would be wrong (a handle, a URL, a part number).
   */
  disableSuggestions?: boolean;
}

/** How many of each kind the dropdown shows before it stops. */
const MAX_USERS = 4;
const MAX_CARS = 4;

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
  disableSuggestions = false,
}: MentionInputProps) {
  const c = useColors();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const mentionedIds = useRef<Set<string>>(new Set());

  const skip = mentionQuery === null || mentionQuery.length < 1;

  const { data: searchData } = useSearchUsersQuery(mentionQuery ?? '', { skip });
  const users = searchData?.entries ?? [];

  // Garage cars answer the same `@`. The server matches the term against a
  // car's title, make and model, so "@porsche" finds "1998 Porsche 911" even
  // though a title with spaces can't be typed out after an @.
  const { data: carData } = useGetCarsQuery(
    { search: mentionQuery ?? '', limit: MAX_CARS },
    { skip },
  );
  const cars = (carData?.entries ?? []) as GarageCar[];

  const hasResults = users.length > 0 || cars.length > 0;

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

  /**
   * A car is stored as `@[Title](car:id)` — see utils/mentions. The id has to
   * travel with it because cars have no unique handle to look up later.
   */
  const selectCar = useCallback((car: GarageCar) => {
    // A function replacer, not a string: a car titled "$1000 Miata" would
    // otherwise have its `$1` read as the captured query.
    const token = `${buildCarMention(car)} `;
    const replaced = value.replace(/@(\w*)$/, () => token);
    setMentionQuery(null);
    onChangeText(replaced, Array.from(mentionedIds.current));
  }, [value, onChangeText]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {mentionQuery !== null && hasResults && (
        <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Rendered with map() rather than a FlatList: this input often lives
              inside a ScrollView, and a nested VirtualizedList warns/breaks. The
              suggestion list is tiny (≤8), so a plain map is the right tool. */}
          {users.slice(0, MAX_USERS).map((item: any) => (
            <TouchableOpacity
              key={`u_${item.user_id}`}
              style={[styles.resultRow, { borderBottomColor: c.border }]}
              onPress={() => selectUser(item)}
              activeOpacity={0.7}
            >
              <Avatar user={item} size={28} />
              <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>@{item.username}</Text>
            </TouchableOpacity>
          ))}

          {/* Only labelled when both kinds are on screen — with one kind
              showing, a heading is a line of furniture over a list of four. */}
          {cars.length > 0 && users.length > 0 && (
            <Text style={[styles.sectionLabel, { color: c.grey, borderTopColor: c.border }]}>CARS</Text>
          )}

          {cars.slice(0, MAX_CARS).map((car) => {
            const thumb = imageUrl(car.profile_image) ?? firstGalleryUrl(car.gallery);
            return (
              <TouchableOpacity
                key={`c_${car.internal_id}`}
                style={[styles.resultRow, { borderBottomColor: c.border }]}
                onPress={() => selectCar(car)}
                activeOpacity={0.7}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.carThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.carThumb, styles.carThumbEmpty, { backgroundColor: c.segment }]}>
                    <CarIcon size={14} color={c.grey} />
                  </View>
                )}
                <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>
                  {carDisplayName(car)}
                </Text>
              </TouchableOpacity>
            );
          })}
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
        // Stated rather than left to the defaults. `spellCheck` in particular
        // only follows `autoCorrect` when neither is given, so anything that
        // touched one of them silently turned the other off too.
        autoCorrect={!disableSuggestions}
        spellCheck={!disableSuggestions}
        autoCapitalize={disableSuggestions ? 'none' : 'sentences'}
        keyboardType="default"
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
    maxHeight: 280,
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
  label:      { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.7,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Rectangular, not a circle: it's a car, and a round crop of a car is
  // mostly bodywork.
  carThumb:      { width: 34, height: 26, borderRadius: 5 },
  carThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
});
