import { createContext, useContext } from "react";

export interface SystemClockContextValue {
  /** Current wall-clock time as "HH:mm" (24h, zero-padded). */
  time: string;
}

export const SystemClockContext = createContext<SystemClockContextValue | null>(
  null,
);

export function useSystemClock(): SystemClockContextValue {
  const ctx = useContext(SystemClockContext);
  if (!ctx) {
    throw new Error("useSystemClock must be used within a SystemClockProvider");
  }
  return ctx;
}
