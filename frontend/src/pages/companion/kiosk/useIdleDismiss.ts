import { useCallback, useEffect, useRef } from "react";

const IDLE_DISMISS_MS = 30000;

/**
 * Return home after 30 seconds without guest input. `active` is the entry
 * screen only: loading, a result, and the conflict picker each own their exit.
 */
export default function useIdleDismiss(onClose: () => void, active: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, IDLE_DISMISS_MS);
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    bump();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [active, bump]);

  return bump;
}
