import React from 'react';
import { ScrollView } from 'react-native';
import EmptyState from '../ui/EmptyState';
import type { SectionScreenProps } from './types';

/** A sub-screen not built yet — a stand-in so the header's tabs can be laid out first. */
export function sectionPlaceholder(title: string) {
  return function SectionPlaceholder({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
    return (
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: bottomPad }}
      >
        <EmptyState title={`${title} — coming soon`} />
      </ScrollView>
    );
  };
}
