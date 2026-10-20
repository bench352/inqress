import { useEffect, useState } from "react";

/**
 * Companion devices share the browser's cookie jar with the admin pages, so a
 * device must not leave an admin session behind. Signs one out when there is
 * one; a 401 for the check means there was none. Returns true when an admin
 * was signed out, so the page can say so with CompanionAdminSessionAlert.
 */
export default function useClearAdminSession(): boolean {
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    (async () => {
      const base = import.meta.env.VITE_BACKEND_API_URL ?? "";
      const session = await fetch(`${base}/api/auth/session`, {
        credentials: "include",
      }).catch(() => null);
      if (!session?.ok) return;
      await fetch(`${base}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
      setCleared(true);
    })();
  }, []);

  return cleared;
}
