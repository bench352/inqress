import { useCallback, useEffect, useState } from "react";

export const LOW_PERCENT = 25;

export interface BatteryState {
  percent: number;
  charging: boolean;
  /** Held here so it survives the companion view switching under the page. */
  dismissed: boolean;
  dismiss: () => void;
}

interface Reading {
  percent: number;
  charging: boolean;
}

/** The one expression behind the low battery card, for the pages that pause for it. */
export function batteryAlertOpen(battery: BatteryState | null): boolean {
  return (
    battery !== null &&
    !battery.charging &&
    battery.percent < LOW_PERCENT &&
    !battery.dismissed
  );
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

// The Battery API is not in lib.dom, and browsers are free to omit it.
type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

// Returns null until (or unless) the browser exposes the Battery API. Safari
// and Firefox never do, which is why every caller must handle null.
export default function useBattery(): BatteryState | null {
  const [reading, setReading] = useState<Reading | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const getBattery = (navigator as NavigatorWithBattery).getBattery;
    if (typeof getBattery !== "function") return;

    let cancelled = false;
    let manager: BatteryManagerLike | null = null;

    const update = () => {
      if (cancelled || !manager || !Number.isFinite(manager.level)) return;
      const percent = Math.round(manager.level * 100);
      setReading({ percent, charging: manager.charging });
      // Back at 25% or above, or plugged in, the warning is armed again.
      if (percent >= LOW_PERCENT || manager.charging) setDismissed(false);
    };

    getBattery
      .call(navigator)
      .then((m) => {
        if (cancelled) return;
        manager = m;
        update();
        m.addEventListener("levelchange", update);
        m.addEventListener("chargingchange", update);
      })
      .catch(() => {
        // The API can be present but gated for fingerprinting; stay null.
      });

    return () => {
      cancelled = true;
      manager?.removeEventListener("levelchange", update);
      manager?.removeEventListener("chargingchange", update);
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  return reading ? { ...reading, dismissed, dismiss } : null;
}
