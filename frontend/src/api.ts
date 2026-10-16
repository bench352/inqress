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

export function useApi() {
  return useMemo(() => {
    const fetchWithCreds = (path: string, init?: RequestInit) =>
      fetch(`${apiUrl}${path}`, {
        ...init,
        credentials: "include",
      });

    return {
      get: async <T>(path: string): Promise<T> => {
        const res = await fetchWithCreds(path);
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      post: async <T>(path: string, body?: unknown): Promise<T> => {
        const res = await fetchWithCreds(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      put: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetchWithCreds(path, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      del: async <T>(path: string, body?: unknown): Promise<T> => {
        const res = await fetchWithCreds(path, {
          method: "DELETE",
          ...(body !== undefined
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        });
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      getBlob: async (path: string): Promise<Blob> => {
        const res = await fetchWithCreds(path);
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        return res.blob();
      },
      getText: async (path: string): Promise<string> => {
        const res = await fetchWithCreds(path);
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        return res.text();
      },
      postFormData: async <T>(path: string, formData: FormData): Promise<T> => {
        const res = await fetchWithCreds(path, {
          method: "POST",
          body: formData,
        });
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      postNoAuth: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          // Session expired or invalid
          redirectToLogin(window.location.pathname);
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
    };
  }, []);
}

export function useCompanionApi() {
  // Companion calls must never trigger the global admin login redirect.
  return useMemo(() => {
    const fetchWithCreds = (path: string, init?: RequestInit) =>
      fetch(`${apiUrl}${path}`, {
        ...init,
        credentials: "include",
      });

    return {
      get: async <T>(path: string): Promise<T> => {
        const res = await fetchWithCreds(path);
        if (res.status === 401) {
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      post: async <T>(path: string, body?: unknown): Promise<T> => {
        const res = await fetchWithCreds(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (res.status === 401) {
          throw await parseApiError(res);
        }
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      postNoAuth: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
    };
  }, []);
}
