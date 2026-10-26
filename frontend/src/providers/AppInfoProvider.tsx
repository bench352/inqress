import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { useBootHold } from "../components/bootHold";
import { useAuth } from "./useAuth";
import { AppInfoContext } from "./useAppInfo";
import { ApiError, useApi } from "../api";

const RETRY_MS = 5000;

interface AppInfo {
  orgName: string;
  fromHeader: string;
  fromError: string | null;
  emailFooterEnabled: boolean;
  appVersion: string;
  maxUploadMb: number;
}

export default function AppInfoProvider({ children }: PropsWithChildren) {
  const { isAuthenticated } = useAuth();
  const api = useApi();
  const [info, setInfo] = useState<AppInfo | null>(null);
  // AppShell only mounts this provider for a signed-in admin.
  const [loading, setLoading] = useState(isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        const data = await api.get<AppInfo>("/api/info");
        if (cancelled) return;
        setInfo(data);
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        // The shell is unusable without this, so a network failure keeps the
        // boot screen up. Any HTTP answer is final: open with what we have.
        if (e instanceof ApiError) setLoading(false);
        else timer = window.setTimeout(() => void load(), RETRY_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isAuthenticated, api]);

  useBootHold(loading, "Loading app settings...");

  const value = useMemo(
    () => ({
      orgName: info?.orgName ?? null,
      fromHeader: info?.fromHeader ?? "",
      fromError: info?.fromError ?? null,
      emailFooterEnabled: info?.emailFooterEnabled ?? true,
      appVersion: info?.appVersion ?? "0.0.0",
      maxUploadMb: info?.maxUploadMb ?? 30,
      isLoading: loading,
    }),
    [info, loading],
  );

  if (loading) {
    return null;
  }

  return (
    <AppInfoContext.Provider value={value}>{children}</AppInfoContext.Provider>
  );
}
