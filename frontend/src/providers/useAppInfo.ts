import { createContext, useContext } from "react";

export interface AppInfoContextValue {
  orgName: string | null;
  sendViaEmail: string;
  isLoading: boolean;
}

export const AppInfoContext = createContext<AppInfoContextValue | null>(null);

export function useAppInfo(): AppInfoContextValue {
  const ctx = useContext(AppInfoContext);
  if (!ctx) {
    throw new Error("useAppInfo must be used within an AppInfoProvider");
  }
  return ctx;
}
