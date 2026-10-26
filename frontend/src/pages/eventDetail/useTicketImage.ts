import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api.ts";

/** The full ticket image as a Blob URL, fetched only once someone opens it. */
export function useTicketImage(
  eventId: string,
  participantId: string,
  enabled: boolean,
) {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["ticketImage", eventId, participantId],
    queryFn: () =>
      api.getBlob(
        `/api/events/${eventId}/participants/${participantId}/ticketImage`,
      ),
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const next = URL.createObjectURL(query.data);
      blobUrlRef.current = next;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Blob URL management requires state sync with external resource
      setUrl(next);
    } else {
      setUrl(null);
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [query.data]);

  return {
    blob: query.data ?? null,
    url,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
