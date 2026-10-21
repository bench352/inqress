import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import BootScreen from "../components/BootScreen";
import { useAuth } from "./useAuth";
import { AppInfoContext } from "./useAppInfo";
import { useApi } from "../api";

interface AppInfo {
  orgName: string;
  sendViaEmail: string;
  appVersion: string;
}

export default function AppInfoProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const api = useApi();

  const { data, isLoading } = useQuery<AppInfo>({
    queryKey: ["appInfo"],
    queryFn: () => api.get("/api/info"),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  const value = useMemo(
    () => ({
      orgName: data?.orgName ?? null,
      sendViaEmail: data?.sendViaEmail ?? "",
      appVersion: data?.appVersion ?? "0.0.0",
      isLoading,
    }),
    [data, isLoading],
  );

  if (isLoading) {
    return <BootScreen />;
  }

  return (
    <AppInfoContext.Provider value={value}>{children}</AppInfoContext.Provider>
  );
}
