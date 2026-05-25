import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useApi} from '../../api'

export interface EventItem {
    id: string
    name: string
    description: string
    date: string
    mode: string
    hasBoothImage: boolean
}

export interface EventCreatePayload {
    name: string
    description: string
    date: string
}

export function useEvents() {
    const api = useApi()
    const queryClient = useQueryClient()

    const eventsQuery = useQuery<EventItem[]>({
        queryKey: ['events'],
        queryFn: () => api.get('/api/events'),
    })

    const createEventMutation = useMutation({
        mutationFn: (payload: EventCreatePayload) => api.post<EventItem>('/api/events', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['events']})
        },
    })

    return {
        events: eventsQuery.data ?? [],
        isLoading: eventsQuery.isLoading,
        isError: eventsQuery.isError,
        createEvent: createEventMutation.mutate,
        isCreating: createEventMutation.isPending,
    }
}
