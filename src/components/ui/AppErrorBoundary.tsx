import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { clearNavState } from '../../navigation/navPersistence';
import { colors } from '../../constants/colors';
import { APP_BG, COMMON_RADIUS, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The last word on an error while drawing.
 *
 * Without one, a single screen that threw took the whole app down — in a
 * release build an uncaught render error closes the app outright. Caught here
 * instead, the member gets a screen that says so and a way back in. Where
 * they were is forgotten on the way (see navPersistence), so the way back in
 * starts on the feed rather than on the screen that just failed.
 */
export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean; attempt: number; detail: string | null }
> {
  state = { failed: false, attempt: 0, detail: null as string | null };

  /**
   * What broke, in a line under the apology — the error and the component it
   * came from. A release build keeps no console, so a screenshot of this is
   * the only trace of a crash on someone's phone.
   */
  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { failed: true, detail: msg.slice(0, 300) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    clearNavState();
    console.error('AppErrorBoundary', error, info.componentStack);
    // The nearest few components it happened in, after the message.
    const where = (info.componentStack ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' ‹ ');
    if (where) this.setState((s) => ({ detail: `${s.detail ?? ''}\n${where}`.slice(0, 600) }));
  }

  // A fresh key remounts everything under it, from the navigator down.
  private retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1, detail: null }));

  render() {
    if (!this.state.failed) {
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }
    return (
      <View style={styles.fill}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>That screen hit a problem. Back to the feed and carry on.</Text>
        <TouchableOpacity style={styles.button} onPress={this.retry} activeOpacity={0.85}>
          <Text style={styles.label}>Back to the app</Text>
        </TouchableOpacity>
        {this.state.detail ? <Text style={styles.detail} selectable>{this.state.detail}</Text> : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: APP_BG, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { color: COLOR_WHITE, fontSize: 20, fontFamily: FONT_INTER.bold, marginBottom: 10, textAlign: 'center' },
  message: { color: '#9A9A9A', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
  button: {
    backgroundColor: colors.primaryAlt,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: COMMON_RADIUS,
    minWidth: 200, alignItems: 'center',
  },
  label: { color: COLOR_WHITE, fontSize: 15, fontFamily: FONT_INTER.bold },
  detail: { color: '#5E5E5E', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 28 },
});
