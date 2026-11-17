import DailyGamesLanding from './DailyGamesLanding';
import type { SectionScreenProps } from '../types';

/**
 * PRO › Games: today's two games and today's results — one page, no switch.
 * Past Games and Leaderboards are each game's own, linked from its screen
 * (DailyGameScreen › GameListScreen).
 */
export default function GamesScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  return <DailyGamesLanding headerPad={headerPad} bottomPad={bottomPad} onScroll={onScroll} />;
}
