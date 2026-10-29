import React from 'react';
import KitSummaryModal from '@ors/kit/src/components/SummaryModal';
import { PANE_SCRIM } from '../../constants/config';

/** The notifications panel's blur strength (NotificationsBell), so the two match. */
const SUMMARY_BLUR = 30;

/**
 * The summary panel — one copy, in the kit (@ors/kit's components/SummaryModal),
 * shared with the photography map and the photo and spot apps. Wrapped here so
 * alfa's imports stay where they were, and so it sits over the same light grey
 * wash as every other pane in the app (PANE_SCRIM), blurred behind on iOS as
 * the header's notifications panel is.
 */
export default function SummaryModal(props: React.ComponentProps<typeof KitSummaryModal>) {
  return <KitSummaryModal scrimColor={PANE_SCRIM} blurIntensity={SUMMARY_BLUR} {...props} />;
}
export * from '@ors/kit/src/components/SummaryModal';
