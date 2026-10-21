import { useMemo } from "react";
import { redirectToLogin } from "./providers/redirectToLogin";

export const apiUrl = import.meta.env.VITE_BACKEND_API_URL ?? "";

export async function sessionStatus(): Promise<number | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/session`, {
      credentials: "include",
    });
    return res.status;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  return new ApiError(res.status, body?.detail ?? `${res.status}`);
}

type Parse = "json" | "blob" | "text";

async function request<T>(
  path: string,
  init: RequestInit = {},
  parse: Parse = "json",
  redirectOn401 = false,
): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
  });
  if (res.status === 401) {
    // Session expired or invalid
    if (redirectOn401) redirectToLogin(window.location.pathname);
    throw await parseApiError(res);
  }
  if (!res.ok) throw await parseApiError(res);
  if (parse === "blob") return (await res.blob()) as T;
  if (parse === "text") return (await res.text()) as T;
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

function createApi(redirectOn401: boolean) {
  return {
    get: <T>(path: string) => request<T>(path, {}, "json", redirectOn401),
    post: <T>(path: string, body?: unknown) =>
      request<T>(
        path,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        "json",
        redirectOn401,
      ),
    put: <T>(path: string, body: unknown) =>
      request<T>(
        path,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "json",
        redirectOn401,
      ),
    del: <T>(path: string, body?: unknown) =>
      request<T>(
        path,
        {
          method: "DELETE",
          ...(body !== undefined
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        },
        "json",
        redirectOn401,
      ),
    getBlob: (path: string) => request<Blob>(path, {}, "blob", redirectOn401),
    getText: (path: string) => request<string>(path, {}, "text", redirectOn401),
    postFormData: <T>(path: string, formData: FormData) =>
      request<T>(
        path,
        { method: "POST", body: formData },
        "json",
        redirectOn401,
      ),
    postNoAuth: async <T>(path: string, body: unknown): Promise<T> => {
      const res = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        if (redirectOn401) redirectToLogin(window.location.pathname);
        throw await parseApiError(res);
      }
      if (!res.ok) throw await parseApiError(res);
      if (res.status === 204) return undefined as unknown as T;
      return (await res.json()) as T;
    },
  };
}

export function useApi() {
  return useMemo(() => createApi(true), []);
}

export function useCompanionApi() {
  // Companion calls must never trigger the global admin login redirect.
  return useMemo(() => createApi(false), []);
}
