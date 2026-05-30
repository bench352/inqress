import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from "@tanstack/react-query";
import { useSnackbar } from "notistack";

let globalEnqueueSnackbar:
  | ((
      message: string,
      options?: { variant?: "success" | "error" | "warning" | "info" },
    ) => void)
  | null = null;

function QueryClientProviderInner({ children }: PropsWithChildren) {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    globalEnqueueSnackbar = enqueueSnackbar;
    return () => {
      globalEnqueueSnackbar = null;
    };
  }, [enqueueSnackbar]);

  return children;
}

export default function QueryClientProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (_error, _variables, _context, mutation) => {
            if (mutation.options.onError) return;
            const err = _error as { detail?: string };
            globalEnqueueSnackbar?.(err?.detail || "Request failed", {
              variant: "error",
            });
          },
        }),
        queryCache: new QueryCache({
          onError: (_error, query) => {
            if (query.state.data !== undefined) return;
            const err = _error as { detail?: string };
            globalEnqueueSnackbar?.(err?.detail || "Failed to load data", {
              variant: "error",
            });
          },
        }),
      }),
  );

  return (
    <TanStackQueryClientProvider client={queryClient}>
      <QueryClientProviderInner>{children}</QueryClientProviderInner>
    </TanStackQueryClientProvider>
  );
}
