// Single-pairing storage: one browser = one event + mode. The pairing token
// is never stored — the server cookie is the only credential.
const STORAGE_KEY = "inqress.companions";

export interface StoredPairing {
  eventId: string;
  mode: "kiosk" | "scanner";
}

function isValid(v: unknown): v is StoredPairing {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as StoredPairing).eventId === "string" &&
    ((v as StoredPairing).mode === "kiosk" ||
      (v as StoredPairing).mode === "scanner")
  );
}

/** Current pairing, or null. Legacy array / corrupt values are dropped. */
export function readPairing(): StoredPairing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) {
      return { eventId: parsed.eventId, mode: parsed.mode };
    }
  } catch {
    // unreadable storage or unparsable value — fall through to clear
  }
  clearPairing();
  return null;
}

export function writePairing(p: StoredPairing): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function clearPairing(): void {
  localStorage.removeItem(STORAGE_KEY);
}
