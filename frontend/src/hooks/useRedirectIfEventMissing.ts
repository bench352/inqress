import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ApiError } from "../api";

/** A confirmed 404 has no recoverable page: replace the dead URL so Back cannot bounce. */
export function useRedirectIfEventMissing(error: unknown) {
  const navigate = useNavigate();

  useEffect(() => {
    if (error instanceof ApiError && error.status === 404) {
      void navigate({ to: "/admin/events", replace: true });
    }
  }, [error, navigate]);
}
