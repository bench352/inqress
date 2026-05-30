import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../api";
import type { EventItem } from ".././eventsList/useEvents";

export interface AttendeeItem {
  id: string;
  eventId: string;
  title: string;
  name: string;
  email: string;
  rawPhone: string;
  countryCode: string;
  phone: string;
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

  const eventQuery = useQuery<EventItem>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
  });

  const attendeesQuery = useQuery<AttendeeItem[]>({
    queryKey: ["attendees", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/attendees`),
    refetchInterval: 30_000,
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
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => api.del<EventItem>(`/api/events/${eventId}`),
  });

  const attended = useMemo(
    () =>
      (attendeesQuery.data ?? [])
        .filter((a) => a.checkedInAt != null)
        .sort((a, b) =>
          (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""),
        ),
    [attendeesQuery.data],
  );

  const notAttended = useMemo(
    () =>
      (attendeesQuery.data ?? [])
        .filter((a) => a.checkedInAt == null && a.isTicketReady)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [attendeesQuery.data],
  );

  const ticketUndelivered = useMemo(
    () =>
      (attendeesQuery.data ?? [])
        .filter((a) => a.checkedInAt == null && !a.isTicketReady)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [attendeesQuery.data],
  );

  const attendees = attendeesQuery.data ?? [];

  return {
    event: eventQuery.data,
    isEventLoading: eventQuery.isLoading,
    attendees,
    attended,
    notAttended,
    ticketUndelivered,
    isAttendeesLoading: attendeesQuery.isLoading,
    updateEvent: updateEventMutation.mutate,
    isUpdating: updateEventMutation.isPending,
    updateMode: updateModeMutation.mutate,
    isUpdatingMode: updateModeMutation.isPending,
    deleteEvent: deleteEventMutation.mutate,
    isDeleting: deleteEventMutation.isPending,
  };
}
