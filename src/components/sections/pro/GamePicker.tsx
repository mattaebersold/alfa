import React from 'react';
import SubTabs from '../../ui/SubTabs';
import { DAILY_GAMES } from '../../games/game';
import type { DailyGameKind } from '../../../types/games';

const OPTIONS = DAILY_GAMES.map((g) => ({ key: g.value, label: g.label, Icon: g.Icon }));

/** Which game a PRO sub-screen shows — Past Games' and Leaderboards' switch. */
export default function GamePicker({ value, onChange }: { value: DailyGameKind; onChange: (g: DailyGameKind) => void }) {
  return <SubTabs options={OPTIONS} value={value} onChange={onChange} inset={0} stretch />;
}
