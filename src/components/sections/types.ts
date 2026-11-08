import type React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * A section's sub-screen in the home header — Events › Calendar, Marketplace ›
 * Watchlist and so on. See FeedScreen: inside a section the header's row is
 * [home] [the section, its landing] [these], and each of these is a pane of
 * its own under the header, mounted the first time it's picked and kept.
 */
export interface SectionScreenProps {
  /**
   * The header's height (status bar, buttons and tab row): the pane starts
   * its scroll content this far down, and the header floats over the rest.
   */
  headerPad: number;
  /**
   * Spread on the pane's scroller with `scrollEventThrottle={16}` — hides and
   * shows the header as it scrolls (useHeaderScroll). Only fires while this
   * pane is showing.
   */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Room to leave under the content — clears the floating tab bar and the + button. */
  bottomPad: number;
  /** Whether this pane is the one on screen — for a pane that polls or plays something. */
  active: boolean;
}

export interface SectionSub {
  /** Unique within its section. */
  key: string;
  label: string;
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  Component: React.ComponentType<SectionScreenProps>;
}
