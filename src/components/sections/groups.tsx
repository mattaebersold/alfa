import { UserCheck } from 'lucide-react-native';
import type { SectionSub } from './types';
import MyGroupsScreen from './groups/MyGroupsScreen';

/** Groups › My Groups. */
export const GROUPS_SUBS: SectionSub[] = [
  { key: 'mine', label: 'My Groups', Icon: UserCheck, Component: MyGroupsScreen },
];
