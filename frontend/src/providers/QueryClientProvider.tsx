import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { ApiError } from "../api";

let globalEnqueueSnackbar:
  | ((
      message: string,
      options?: {
        variant?: "success" | "error" | "warning" | "info";
        preventDuplicate?: boolean;
      },
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
        defaultOptions: {
          queries: {
            // A 404 is confirmed missing; retrying only delays the message.
            retry: (failureCount, error) =>
              error instanceof ApiError && error.status === 404
                ? false
                : failureCount < 3,
          },
        },
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
            // Several queries 404 at once on a dead event URL; one snack each.
            globalEnqueueSnackbar?.(err?.detail || "Failed to load data", {
              variant: "error",
              preventDuplicate: true,
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
