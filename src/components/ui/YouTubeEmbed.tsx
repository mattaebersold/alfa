import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * A 16:9 YouTube player.
 *
 * react-native-webview is already a dependency and already carries the group
 * resource embeds, so this adds no native surface — the same component works in
 * the existing build without a rebuild.
 *
 * The black backing matters: the WebView paints white until the player loads,
 * which flashes hard against the app's dark surfaces.
 */
interface YouTubeEmbedProps {
  /** The 11-character video id, not the full URL. */
  videoId: string;
  style?: StyleProp<ViewStyle>;
}

export default function YouTubeEmbed({ videoId, style }: YouTubeEmbedProps) {
  if (!videoId) return null;

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        source={{ uri: `https://www.youtube.com/embed/${videoId}` }}
        style={styles.player}
        allowsFullscreenVideo
        javaScriptEnabled
        // Left to the user: autoplaying a video inside a scrolling page is
        // hostile, and iOS blocks it without this anyway.
        mediaPlaybackRequiresUserAction
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden' },
  player: { flex: 1, backgroundColor: '#000' },
});
