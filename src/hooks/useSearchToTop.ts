import { useCallback, useRef, useState } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Below the status bar, where the search row comes to rest. */
const TOP_GAP = 8;

/**
 * A list's search field, brought to the top of the screen when it's focused
 * — so with the keyboard up, the results get the rest of the screen rather
 * than whatever was above the search (a featured row, a heading).
 *
 * The floating header hides as the list scrolls down, so the row comes to
 * rest just under the status bar. While searching, the list keeps room at its
 * foot (`contentMinHeight`) so even a short result can scroll that far.
 *
 *   const s = useSearchToTop(scrollRef, contentTop);
 *   <View onLayout={s.onToolsLayout}>…<SearchPill onFocus={s.onSearchFocus} onBlur={s.onSearchBlur} />…</View>
 *   contentContainerStyle={[…, s.contentMinHeight]}
 *
 * `contentTop` is the list's top padding — where its header starts. The
 * tools row's onLayout must be measured against the list header's top.
 */
export function useSearchToTop(
  scrollRef: React.RefObject<{ scrollToOffset: (p: { offset: number; animated?: boolean }) => void } | null>,
  contentTop: number,
) {
  const insets = useSafeAreaInsets();
  const toolsY = useRef(0);
  const [searching, setSearching] = useState(false);

  const onToolsLayout = useCallback((e: LayoutChangeEvent) => { toolsY.current = e.nativeEvent.layout.y; }, []);

  const offset = () => Math.max(0, contentTop + toolsY.current - (insets.top + TOP_GAP));

  const onSearchFocus = useCallback(() => {
    setSearching(true);
    // After the room at the foot has laid out, or a short list can't get there.
    requestAnimationFrame(() => scrollRef.current?.scrollToOffset({ offset: offset(), animated: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentTop, insets.top]);
  const onSearchBlur = useCallback(() => setSearching(false), []);

  const contentMinHeight = searching
    ? { minHeight: Dimensions.get('window').height + offset() }
    : null;

  return { onToolsLayout, onSearchFocus, onSearchBlur, contentMinHeight };
}
