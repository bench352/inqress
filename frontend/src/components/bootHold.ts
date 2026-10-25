import { useLayoutEffect, useSyncExternalStore } from "react";

export interface BootState {
  active: boolean;
  message: string | null;
}

const holds = new Map<number, string | undefined>();
const listeners = new Set<() => void>();
let nextHoldId = 1;
let snapshot: BootState = { active: false, message: null };

function publish() {
  const messages: string[] = [];
  for (const message of holds.values()) {
    if (message) messages.push(message);
  }
  snapshot = { active: holds.size > 0, message: messages.at(-1) ?? null };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps the one boot screen up for as long as this component is mounted.
 * Overlapping holds share the same screen; a message says what is being
 * waited on, and is left empty for a wait the visitor does not need explained.
 */
export function useBootHold(active: boolean, message?: string) {
  useLayoutEffect(() => {
    if (!active) return;
    const id = nextHoldId++;
    holds.set(id, message);
    publish();
    return () => {
      holds.delete(id);
      publish();
    };
  }, [active, message]);
}

export function useBootState(): BootState {
  return useSyncExternalStore(subscribe, () => snapshot);
}
