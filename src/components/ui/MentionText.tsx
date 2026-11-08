import React from 'react';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import { useColors } from '../../hooks/useColors';
import { useLazyGetPublicUserQuery } from '../../api/apiService';
import { parseMentions } from '../../utils/mentions';
import { Linking } from 'react-native';
import { LINK_LABEL, LINK_MARKER_RE } from '../../utils/linkify';
import { FONT_INTER } from '../../constants/fonts';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

interface MentionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
  /**
   * Passed straight through to the underlying `Text`.
   *
   * A caller that clamps this needs to know whether the clamp actually cut
   * anything off, and the line count is the only honest answer to that.
   */
  onTextLayout?: (e: any) => void;
  /**
   * Rendered inside the same text run, after the words — an inline "more"
   * at the end of a clamped preview, which has to share the last line rather
   * than take one of its own.
   */
  trailing?: React.ReactNode;
  /**
   * The URLs behind the text's link markers, in order — see utils/linkify.
   * Each marker is drawn as a bold, underlined "View More" that opens its URL.
   */
  links?: string[];
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

export default function MentionText({ text, style, numberOfLines, onTextLayout, trailing, links }: MentionTextProps) {
  const segments = parseMentions(text);
  // Which URL the next marker opens — markers are numbered in reading order
  // across every plain run.
  let linkIndex = 0;
  /** A plain run, with any link markers in it drawn as links. */
  const plain = (s: string, key?: number) => {
    if (!links?.length || !s.includes(LINK_LABEL)) return key == null ? s : <Text key={key}>{s}</Text>;
    const parts = s.split(LINK_MARKER_RE);
    return (
      <Text key={key}>
        {parts.map((p, j) => {
          if (j === 0) return p;
          const url = links[linkIndex++];
          return (
            <React.Fragment key={j}>
              {url ? (
                <Text style={LINK_STYLE} onPress={() => { Linking.openURL(url).catch(() => {}); }} accessibilityRole="link">
                  {LINK_LABEL}
                </Text>
              ) : LINK_LABEL}
              {p}
            </React.Fragment>
          );
        })}
      </Text>
    );
  };

  if (segments.length <= 1 && segments[0]?.kind !== 'car' && segments[0]?.kind !== 'user') {
    return (
      <Text style={style} numberOfLines={numberOfLines} onTextLayout={onTextLayout}>
        {plain(text)}
        {trailing}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} onTextLayout={onTextLayout}>
      {segments.map((seg, i) => {
        if (seg.kind === 'user') {
          return <UserSegment key={i} username={seg.username} textStyle={style} />;
        }
        if (seg.kind === 'car') {
          return <CarSegment key={i} label={seg.label} carId={seg.carId} textStyle={style} />;
        }
        return plain(seg.text, i);
      })}
      {trailing}
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

/** A link in the words: the words' own face and ink, bold and underlined. */
const LINK_STYLE = { fontFamily: FONT_INTER.bold, textDecorationLine: 'underline' as const };
