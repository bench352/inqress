import { useCallback, useEffect, useRef } from "react";

const IDLE_DISMISS_MS = 30000;

/**
 * Return home after 30 seconds without guest input. `active` is the entry
 * screen only: loading, a result, and the conflict picker each own their exit.
 * `paused` freezes it without losing the time already spent; it resumes with
 * what was left rather than a fresh 30 seconds.
 */
export default function useIdleDismiss(
  onClose: () => void,
  active: boolean,
  paused = false,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef(0);

  const start = useCallback(
    (ms: number) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      deadlineRef.current = Date.now() + ms;
      timerRef.current = setTimeout(onClose, ms);
    },
    [onClose],
  );

  const bump = useCallback(() => start(IDLE_DISMISS_MS), [start]);

  useEffect(() => {
    if (!active) {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      deadlineRef.current = 0;
      return;
    }
    if (paused && timerRef.current !== null) {
      const left = Math.max(0, deadlineRef.current - Date.now());
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      deadlineRef.current = Date.now() + left;
      return;
    }
    if (timerRef.current === null) {
      const left = deadlineRef.current
        ? Math.max(0, deadlineRef.current - Date.now())
        : IDLE_DISMISS_MS;
      start(left > 0 ? left : IDLE_DISMISS_MS);
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [active, paused, start]);

  return bump;
}
