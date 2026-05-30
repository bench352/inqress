import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./useAuth";

const USERNAME_KEY = "admin.username";
const PASSWORD_KEY = "admin.password";

export default function BasicAuthProvider({ children }: PropsWithChildren) {
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem(USERNAME_KEY) || null,
  );
  const [password, setPassword] = useState<string | null>(
    () => localStorage.getItem(PASSWORD_KEY) || null,
  );

  const isAuthenticated = !!(username && password);

  const login = useCallback((newUsername: string, newPassword: string) => {
    localStorage.setItem(USERNAME_KEY, newUsername);
    localStorage.setItem(PASSWORD_KEY, newPassword);
    setUsername(newUsername);
    setPassword(newPassword);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(PASSWORD_KEY);
    setUsername(null);
    setPassword(null);
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === USERNAME_KEY) setUsername(e.newValue);
      if (e.key === PASSWORD_KEY) setPassword(e.newValue);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, username, password, login, logout }),
    [isAuthenticated, username, password, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
