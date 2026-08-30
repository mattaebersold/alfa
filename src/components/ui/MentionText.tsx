import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { useColors } from '../../hooks/useColors';
import { useLazyGetPublicUserQuery } from '../../api/apiService';
import { parseMentions } from '../../utils/mentions';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

interface MentionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
}

function UserSegment({ username, textStyle }: { username: string; textStyle?: any }) {
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
    <Text onPress={handlePress} style={[textStyle, { color: c.blueLight }]}>@{username}</Text>
  );
}

/**
 * A tagged garage car. The id travels in the token, so this needs no lookup —
 * it goes straight to the car, and two cars sharing a title stay distinct.
 */
function CarSegment({ label, carId, textStyle }: { label: string; carId: string; textStyle?: any }) {
  const c = useColors();
  const navigation = useNavigation<AppNav>();

  return (
    <Text
      onPress={() => navigation.navigate('CarDetail', { carId })}
      style={[textStyle, { color: c.blueLight }]}
    >
      @{label}
    </Text>
  );
}

export default function MentionText({ text, style, numberOfLines }: MentionTextProps) {
  const segments = parseMentions(text);

  if (segments.length <= 1 && segments[0]?.kind !== 'car' && segments[0]?.kind !== 'user') {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => {
        if (seg.kind === 'user') {
          return <UserSegment key={i} username={seg.username} textStyle={style} />;
        }
        if (seg.kind === 'car') {
          return <CarSegment key={i} label={seg.label} carId={seg.carId} textStyle={style} />;
        }
        return <Text key={i}>{seg.text}</Text>;
      })}
    </Text>
  );
}

// A mention has no styles of its own: it takes the weight of whatever it is
// written in, and the link blue is what marks it as pressable. Weighting it
// separately made a sentence change thickness mid-word.
//
// The blue itself matters: it used to take `primaryAlt`, which useColors
// remaps to gold for pro members, so a mention read as a highlight rather than
// as something to press.
