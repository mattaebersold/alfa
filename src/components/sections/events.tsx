import { CalendarDays, Flag, Map } from 'lucide-react-native';
import type { SectionSub } from './types';
import EventsCalendarScreen from './events/EventsCalendarScreen';
import EventsRalliesScreen from './events/EventsRalliesScreen';
import EventsMapScreen from './events/EventsMapScreen';

/** Events › Calendar, Map, ORS Rallys. */
export const EVENTS_SUBS: SectionSub[] = [
  { key: 'calendar', label: 'Calendar',   Icon: CalendarDays, Component: EventsCalendarScreen },
  { key: 'map',      label: 'Map',        Icon: Map,          Component: EventsMapScreen },
  { key: 'rallies',  label: 'ORS Rallys', Icon: Flag,         Component: EventsRalliesScreen },
];
