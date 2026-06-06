import { useMemo } from "react";
import { useAuth } from "./providers/useAuth";

export const apiUrl = import.meta.env.VITE_BACKEND_API_URL ?? "";

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
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
  const { username, password } = useAuth();

  return useMemo(() => {
    const authHeaders = (): Record<string, string> => {
      if (!username || !password) return {};
      return { Authorization: basicAuth(username, password) };
    };

    return {
      get: async <T>(path: string): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      post: async <T>(path: string, body?: unknown): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      put: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      del: async <T>(path: string, body?: unknown): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "DELETE",
          headers: {
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...authHeaders(),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw await parseApiError(res);
        if (res.status === 204) return undefined as unknown as Promise<T>;
        return res.json() as Promise<T>;
      },
      getBlob: async (path: string): Promise<Blob> => {
        const res = await fetch(`${apiUrl}${path}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw await parseApiError(res);
        return res.blob();
      },
      getText: async (path: string): Promise<string> => {
        const res = await fetch(`${apiUrl}${path}`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw await parseApiError(res);
        return res.text();
      },
      postFormData: async <T>(path: string, formData: FormData): Promise<T> => {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });
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
      getAuthToken: (): string | null => {
        if (!username || !password) return null;
        return btoa(`${username}:${password}`);
      },
    };
  }, [username, password]);
}
