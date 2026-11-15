import React from 'react';
import BaseSummaryModal from '../SummaryModal';
import { APP_BG, PANE_SCRIM } from '../../constants/config';

/** The notifications panel's blur strength (NotificationsBell), so the two match. */
const SUMMARY_BLUR = 30;
/** The close button's fill: black at 20%, light over the blurred backdrop. */
const SUMMARY_CLOSE_BG = 'rgba(0,0,0,0.2)';

/**
 * The summary panel (components/SummaryModal), shared with the photography
 * map. Wrapped here so it sits over the same light grey
 * wash as every other pane in the app (PANE_SCRIM), blurred behind on iOS as
 * the header's notifications panel is. Its ground is the app's own page colour
 * (APP_BG) rather than the shared black.
 */
export default function SummaryModal(props: React.ComponentProps<typeof BaseSummaryModal>) {
  return <BaseSummaryModal scrimColor={PANE_SCRIM} blurIntensity={SUMMARY_BLUR} closeColor={SUMMARY_CLOSE_BG} surfaceColor={APP_BG} {...props} />;
}
export * from '../SummaryModal';
