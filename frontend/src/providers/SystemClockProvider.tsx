import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import { SystemClockContext } from "./useSystemClock";

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function SystemClockProvider({ children }: PropsWithChildren) {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    // Fire exactly on the next minute boundary, then every minute, so the
    // displayed minute flips with the system clock instead of drifting.
    let interval: number | undefined;
    const timeout = window.setTimeout(
      () => {
        setTime(formatTime(new Date()));
        interval = window.setInterval(
          () => setTime(formatTime(new Date())),
          60_000,
        );
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  return (
    <SystemClockContext.Provider value={{ time }}>
      {children}
    </SystemClockContext.Provider>
  );
}
