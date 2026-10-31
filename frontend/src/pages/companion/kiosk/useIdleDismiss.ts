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
  // While a timer runs: when it fires. While paused: how long is left.
  const deadlineRef = useRef<number | null>(null);

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
      deadlineRef.current = null;
      return;
    }
    if (paused) return;
    if (timerRef.current === null) {
      const left = deadlineRef.current ?? IDLE_DISMISS_MS;
      start(left > 0 ? left : IDLE_DISMISS_MS);
    }
    return () => {
      // Runs before the next setup, and is the last point where the live
      // deadline is known: turn it into the time left for a resume.
      if (timerRef.current !== null) {
        deadlineRef.current = Math.max(
          0,
          (deadlineRef.current ?? Date.now()) - Date.now(),
        );
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, paused, start]);

  return bump;
}
