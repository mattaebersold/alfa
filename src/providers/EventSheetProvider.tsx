import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import SocietyEventSheet from '../components/society/SocietyEventSheet';

type OpenArgs = { eventId: string; occurrenceDate?: string };

const EventSheetContext = createContext<{ openEventSheet: (args: OpenArgs) => void }>({
  openEventSheet: () => {},
});

/**
 * Hosts the one event sheet, at the root, so any surface can open it — including
 * ones that are themselves modals (the nav drawer, the day sheet) and would
 * otherwise dismiss the sheet along with themselves.
 */
export function EventSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenArgs | null>(null);

  const openEventSheet = useCallback((args: OpenArgs) => setOpen(args), []);
  const value = useMemo(() => ({ openEventSheet }), [openEventSheet]);

  return (
    <EventSheetContext.Provider value={value}>
      {children}
      <SocietyEventSheet
        visible={!!open}
        eventId={open?.eventId}
        occurrenceDate={open?.occurrenceDate}
        onClose={() => setOpen(null)}
      />
    </EventSheetContext.Provider>
  );
}

export const useEventSheet = () => useContext(EventSheetContext);
