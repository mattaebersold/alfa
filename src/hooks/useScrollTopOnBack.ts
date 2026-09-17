import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useRoute } from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';
import { resetHeader } from './useHeaderScroll';

/**
 * Scroll-to-top on the AppHeader's back button.
 *
 * Going back reveals a screen that never unmounted — a stack screen underneath,
 * or another tab's screen from the tab history — so it comes back wherever it
 * was left. The header's back button should land you at the top instead.
 *
 * The header can't hold the destination's scroll view: it's rendered by the
 * screen being *left*, and which screen is next isn't known until the pop has
 * happened (tab history, nested stacks). So scrollables register here under
 * their route key, and the back action looks the new focused route up once the
 * navigation state has actually changed.
 *
 * Only the header button does this. Swipe and hardware back keep the platform
 * behaviour of returning you to where you were — reading down a feed, opening a
 * post and swiping back to carry on is the common case, and resetting that
 * would be a regression.
 */

/** Anything with a way to jump to the top: FlatList, ScrollView, their Animated forms. */
type Scrollable = {
  scrollToOffset?: (p: { offset: number; animated?: boolean }) => void;
  scrollTo?: (p: { x?: number; y?: number; animated?: boolean }) => void;
};

const registry = new Map<string, Set<RefObject<unknown>>>();

function scrollToTop(target: unknown) {
  const s = target as Scrollable | null;
  if (!s) return;
  // FlatList first: it also has no `scrollTo`, and its offset form is the one
  // that doesn't depend on item layout having been measured.
  if (typeof s.scrollToOffset === 'function') s.scrollToOffset({ offset: 0, animated: false });
  else if (typeof s.scrollTo === 'function') s.scrollTo({ x: 0, y: 0, animated: false });
}

/**
 * Every route key along the focused path, root to leaf. A scrollable may live
 * in a screen that itself hosts a navigator, so the leaf alone isn't enough.
 */
function focusedKeys(state: NavigationState | PartialState<NavigationState> | undefined): string[] {
  const keys: string[] = [];
  let s = state;
  while (s && s.routes && s.routes.length) {
    const route = s.routes[s.index ?? s.routes.length - 1];
    if (!route) break;
    if (route.key) keys.push(route.key);
    s = route.state as typeof s;
  }
  return keys;
}

/**
 * Registers a screen's main scroll view to be reset to the top when the header
 * back button lands on this screen. Call once per scrollable — a screen with a
 * list and a separate empty-state scroll view can register both.
 */
export function useScrollTopOnBack(ref: RefObject<unknown>) {
  const { key } = useRoute();
  useEffect(() => {
    let set = registry.get(key);
    if (!set) registry.set(key, (set = new Set()));
    set.add(ref);
    return () => {
      set.delete(ref);
      if (set.size === 0) registry.delete(key);
    };
  }, [key, ref]);
}

/**
 * The header back action: go back, then put the screen that comes into focus
 * at the top with the header shown.
 *
 * The container's `state` event fires after the new state is committed, so the
 * focused route read there is the destination. If the leaf didn't change the
 * pop wasn't handled and nothing is touched — so a listener can never fire
 * later against some unrelated navigation.
 */
export function goBackToTop(navigation: { canGoBack: () => boolean; goBack: () => void }) {
  if (!navigation.canGoBack()) return;

  if (navigationRef.isReady()) {
    const before = focusedKeys(navigationRef.getRootState()).pop();
    const unsubscribe = navigationRef.addListener('state', () => {
      unsubscribe();
      const keys = focusedKeys(navigationRef.getRootState());
      if (keys[keys.length - 1] === before) return;
      keys.forEach((k) => registry.get(k)?.forEach((r) => scrollToTop(r.current)));
      // `headerOffset` is shared by every screen, so the one being left could
      // have handed over a header still slid out of view. At the top it must
      // be showing.
      resetHeader();
    });
  }

  navigation.goBack();
}
