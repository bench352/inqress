import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
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
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          bgcolor: "white",
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Just a moment...</Typography>
      </Box>
    );
  }

  return (
    <AppInfoContext.Provider value={value}>{children}</AppInfoContext.Provider>
  );
}
