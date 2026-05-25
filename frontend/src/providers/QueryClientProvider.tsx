import type {PropsWithChildren} from 'react'
import {useState} from 'react'
import {QueryClient, QueryClientProvider as TanStackQueryClientProvider} from '@tanstack/react-query'

export default function QueryClientProvider({children}: PropsWithChildren) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <TanStackQueryClientProvider client={queryClient}>
            {children}
        </TanStackQueryClientProvider>
    )
}
