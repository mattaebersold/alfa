import { useSyncExternalStore } from 'react';

/**
 * What this session knows about a document's likes, past what any one copy of
 * it says.
 *
 * A post's like state arrives inside whatever list it came in — the feed, a
 * profile, a group — as a snapshot taken when that list loaded. Liking it
 * changed the server but not the snapshot, so a card rebuilt from it (scrolled
 * out of the list and back, opened again from somewhere else) went back to the
 * old heart and the old count. Worse, the next tap then counted from the stale
 * number: a post showing no likes went straight to two.
 *
 * So every like and unlike is written here — optimistically on the tap, then
 * exactly from the server's answer, which carries the whole liker list — and
 * every heart reads here first, falling back to its snapshot only for a
 * document nobody has touched this session.
 */
export interface LikeState {
  liked: boolean;
  count: number;
  /** Everyone who's liked it, when the server has said — for the faces. */
  users?: string[];
}

const states = new Map<string, LikeState>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const likeStates = {
  get: (id: string) => states.get(id),
  set: (id: string, state: LikeState) => { states.set(id, state); emit(); },
  /** Forget it all — when a list has just been reloaded with fresh counts. */
  clear: () => { if (states.size) { states.clear(); emit(); } },
  /** From the server's like record — the truth, for this viewer. */
  fromRecord: (id: string, users: string[] | undefined, myId: string | undefined) => {
    const list = Array.isArray(users) ? users : [];
    states.set(id, { liked: !!myId && list.includes(myId), count: list.length, users: list });
    emit();
  },
};

/** This document's like state as this session knows it, or undefined. */
export function useLikeState(id: string | undefined): LikeState | undefined {
  return useSyncExternalStore(subscribe, () => (id ? states.get(id) : undefined));
}
