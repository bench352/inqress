import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/api.ts";
import type { EventItem } from ".././eventsList/useEvents";

export interface ParticipantItem {
  id: string;
  eventId: string;
  title: string | null;
  name: string;
  email: string | null;
  rawPhone: string | null;
  countryCode: string | null;
  phone: string | null;
  isTicketDelivered: boolean;
  isTicketReady: boolean;
  checkedInAt: string | null;
}

export interface EventPutPayload {
  name: string;
  description: string;
  date: string;
}

export function useEventDetail(eventId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const enabled = !!eventId;

  const eventQuery = useQuery<EventItem>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled,
  });

  const participantsQuery = useQuery<ParticipantItem[]>({
    queryKey: ["participants", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/participants`),
    refetchInterval: 30_000,
    enabled,
  });

  const updateEventMutation = useMutation({
    mutationFn: (payload: EventPutPayload) =>
      api.put<EventItem>(`/api/events/${eventId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: (mode: string) =>
      api.put<EventItem>(`/api/events/${eventId}/mode`, { mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => api.del<EventItem>(`/api/events/${eventId}`),
  });

  const attended = useMemo(
    () =>
      (participantsQuery.data ?? [])
        .filter((a) => a.checkedInAt != null)
        .sort((a, b) =>
          (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""),
        ),
    [participantsQuery.data],
  );

  const notAttended = useMemo(
    () =>
      (participantsQuery.data ?? [])
        .filter(
          (a) =>
            a.checkedInAt == null && a.isTicketReady && a.isTicketDelivered,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participantsQuery.data],
  );

  const ticketUndelivered = useMemo(
    () =>
      (participantsQuery.data ?? [])
        .filter((a) => a.checkedInAt == null && !a.isTicketReady)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participantsQuery.data],
  );

  const notDelivered = useMemo(
    () =>
      (participantsQuery.data ?? [])
        .filter(
          (a) =>
            a.checkedInAt == null && a.isTicketReady && !a.isTicketDelivered,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participantsQuery.data],
  );

  const participants = participantsQuery.data ?? [];

  return {
    event: eventQuery.data,
    isEventLoading: eventQuery.isLoading,
    participants,
    attended,
    notAttended,
    notDelivered,
    ticketUndelivered,
    isParticipantsLoading: participantsQuery.isLoading,
    updateEvent: updateEventMutation.mutate,
    isUpdating: updateEventMutation.isPending,
    updateMode: updateModeMutation.mutate,
    isUpdatingMode: updateModeMutation.isPending,
    deleteEvent: deleteEventMutation.mutate,
    isDeleting: deleteEventMutation.isPending,
  };
}
