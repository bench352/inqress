import { createContext, useContext } from "react";

export interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  password: string | null;
  login: (username: string, password: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within a BasicAuthProvider");
  }
  return ctx;
}
