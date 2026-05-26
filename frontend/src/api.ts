import {useMemo} from 'react'
import {useAuth} from './providers/useAuth'

export const apiUrl = import.meta.env.VITE_BACKEND_API_URL ?? ''

function basicAuth(username: string, password: string): string {
    return `Basic ${btoa(`${username}:${password}`)}`
}

export function useApi() {
    const {username, password} = useAuth()

    return useMemo(() => {
        const authHeaders = (): Record<string, string> => {
            if (!username || !password) return {}
            return {Authorization: basicAuth(username, password)}
        }

        return {
            get: async <T>(path: string): Promise<T> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    headers: authHeaders(),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json() as Promise<T>
            },
            post: async <T>(path: string, body: unknown): Promise<T> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(),
                    },
                    body: JSON.stringify(body),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json() as Promise<T>
            },
            put: async <T>(path: string, body: unknown): Promise<T> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders(),
                    },
                    body: JSON.stringify(body),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json() as Promise<T>
            },
            del: async <T>(path: string): Promise<T> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    method: 'DELETE',
                    headers: authHeaders(),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json() as Promise<T>
            },
            getBlob: async (path: string): Promise<Blob> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    headers: authHeaders(),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.blob()
            },
            postFormData: async (path: string, formData: FormData): Promise<void> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: formData,
                })
                if (!res.ok) throw new Error(`${res.status}`)
            },
            postNoAuth: async <T>(path: string, body: unknown): Promise<T> => {
                const res = await fetch(`${apiUrl}${path}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(body),
                })
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json() as Promise<T>
            },
        }
    }, [username, password])
}
