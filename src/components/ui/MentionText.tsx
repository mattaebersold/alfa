import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { useColors } from '../../hooks/useColors';
import { useLazyGetPublicUserQuery } from '../../api/apiService';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

interface MentionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
}

function MentionSegment({ username, textStyle }: { username: string; textStyle?: any }) {
  const c = useColors();
  const navigation = useNavigation<AppNav>();
  const [fetchUser] = useLazyGetPublicUserQuery();

  const handlePress = async () => {
    try {
      const user = await fetchUser(username).unwrap();
      if (user?.user_id) {
        navigation.navigate('UserDetail', { userId: user.user_id, username });
      }
    } catch {
      // User not found — no-op
    }
  };

  // Plain Text with onPress keeps the mention inline and baseline-aligned with the
  // surrounding text — nesting a TouchableOpacity (a View) inside Text breaks alignment.
  return (
    <Text onPress={handlePress} style={[textStyle, styles.mention, { color: c.primaryAlt }]}>@{username}</Text>
  );
}

export default function MentionText({ text, style, numberOfLines }: MentionTextProps) {
  const parts = text.split(/(@\w+)/g);

  if (parts.length === 1) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        const match = part.match(/^@(\w+)$/);
        if (match) {
          return <MentionSegment key={i} username={match[1]} textStyle={style} />;
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  mention: { fontWeight: '600' },
});
