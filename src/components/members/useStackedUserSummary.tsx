import React, { useCallback, useEffect, useState } from 'react';
import UserSummaryModal from './UserSummaryModal';
import type { SummaryOrigin } from '../ui/SummaryModal';

/**
 * A person's summary, opened over the summary you're already in.
 *
 * Returns `openUser` for the rows, and `stacked` to pass to the host panel's
 * SummaryModal as its `stacked` prop — rendered there and nowhere else, or iOS
 * won't present it (see SummaryModal's "Stacking").
 *
 * The user summary's own actions (View Profile, Message) close both panels
 * before they navigate; SummaryModal does that for any stacked panel.
 *
 * @param hostVisible Whether the host panel is open. A person left open when it
 *   closes some other way is forgotten, so reopening the host doesn't bring
 *   them straight back up over it.
 */
export function useStackedUserSummary(hostVisible: boolean) {
  const [open, setOpen] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);

  useEffect(() => { if (!hostVisible) setOpen(null); }, [hostVisible]);

  const openUser = useCallback((userId: string, origin: SummaryOrigin | null) => {
    setOpen({ userId, origin });
  }, []);
  const closeUser = useCallback(() => setOpen(null), []);

  const stacked = (
    <UserSummaryModal userId={open?.userId ?? null} origin={open?.origin} onClose={closeUser} />
  );

  return { openUser, closeUser, stacked };
}
