import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '../../hooks/useColors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * How tall the form starts. Enough of the form to be obviously a form, and — on
 * the short ones — enough to fill in without scrolling anything at all.
 */
const BASE_HEIGHT = Math.round(Math.min(720, SCREEN_HEIGHT * 0.8));
/** A runaway page shouldn't turn the pane into an endless scroll. */
const MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 2.5);
/** Within this of the box's own height, a measurement tells us nothing. */
const SELF_SCROLL_TOLERANCE = 48;

/**
 * Report the page's own content height so the box can grow to fit it, which
 * leaves the surrounding pane as the only thing that scrolls.
 *
 * ResizeObserver rather than a one-shot measure: a hosted form changes height as
 * you move between its pages and as validation messages appear, and a box frozen
 * at the first measurement would clip everything after it.
 */
const MEASURE_HEIGHT = `
  (function () {
    var post = function () {
      var doc = document.documentElement;
      var body = document.body;
      var height = Math.max(
        doc ? doc.scrollHeight : 0,
        body ? body.scrollHeight : 0
      );
      if (height) window.ReactNativeWebView.postMessage(String(height));
    };
    post();
    if (window.ResizeObserver && document.body) {
      new ResizeObserver(post).observe(document.body);
    }
    window.addEventListener('load', post);
  })();
  true;
`;

/**
 * A rally's registration form, embedded in the detail pane.
 *
 * The form used to live behind a "Register Now" button that swapped the whole
 * pane out for it. Registering is the point of an upcoming rally, though, so the
 * form is now simply part of the page — you scroll to it the way you scroll to
 * anything else.
 *
 * The box grows to the page's reported height so the pane does the scrolling.
 * Until a height arrives — and if one never does, because a hosted form manages
 * its own scroll container — the WebView keeps its own scrolling, so the form
 * stays usable either way rather than being clipped at a guess.
 */
export default function RallyRegistrationForm({ url }: { url: string }) {
  const colors = useColors();
  const [height, setHeight] = useState(BASE_HEIGHT);
  // Only stop the inner scroll once the page has told us it fits.
  const [fitsContent, setFitsContent] = useState(false);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.fg }]}>Register</Text>
      <View style={[styles.frame, { borderColor: colors.border, height }]}>
        <WebView
          source={{ uri: url }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          scrollEnabled={!fitsContent}
          nestedScrollEnabled
          injectedJavaScript={MEASURE_HEIGHT}
          onMessage={(event) => {
            const measured = Number(event.nativeEvent.data);
            if (!Number.isFinite(measured) || measured <= 0) return;
            // A page that manages its own scrolling reports the viewport height
            // we just handed it, which says nothing about its content. Ignoring
            // measurements that match the box leaves such a form scrolling
            // internally, which is the only thing that works for it.
            if (Math.abs(measured - height) <= SELF_SCROLL_TOLERANCE) return;
            setHeight(Math.min(measured, MAX_HEIGHT));
            setFitsContent(measured <= MAX_HEIGHT);
          }}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primaryAlt} />
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, gap: 10 },
  heading: { fontSize: 18, fontWeight: '800' },
  frame:   { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  web:     { flex: 1, backgroundColor: '#FFFFFF' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
