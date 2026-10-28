import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBootHold } from "../components/bootHold";
import { AuthContext } from "./useAuth";

const STORAGE_KEY = "admin.sessionStamp";

export default function SessionAuthProvider({ children }: PropsWithChildren) {
  const [username, setUsername] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/auth/session`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setUsername(data.username);
        setIsAuthenticated(true);
        return true;
      }
      setUsername(null);
      setIsAuthenticated(false);
      return false;
    } catch {
      setUsername(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (newUsername: string, newPassword: string) => {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: newUsername,
            password: newPassword,
          }),
        },
      );

      if (res.status === 429) {
        throw new Error("Too many login attempts. Please try again later.");
      }
      if (!res.ok) {
        throw new Error("Invalid credentials");
      }
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      const stored = await checkSession();
      if (!stored) {
        throw new Error(
          "Session cookie was not stored. Open this site over HTTPS.",
        );
      }
    },
    [checkSession],
  );

  const logout = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        return false;
      }
    } catch {
      return false;
    }
    localStorage.removeItem(STORAGE_KEY);
    setUsername(null);
    setIsAuthenticated(false);
    return true;
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkSession();
    };
    void init();
  }, [checkSession]);

  // Listen for storage events from other tabs (logout/login)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        checkSession();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [checkSession]);

  const value = useMemo(
    () => ({ isAuthenticated, username, login, logout }),
    [isAuthenticated, username, login, logout],
  );

  useBootHold(loading);

  if (loading) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
