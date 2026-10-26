export type ParticipantStep = "edit" | "email" | "share";

/** Dialogs reopened by a refresh. Confirmation dialogs and previews stay local. */
export interface EventSearch {
  participant?: string;
  step?: ParticipantStep;
  pair?: boolean;
}

export function validateEventSearch(
  search: Record<string, unknown>,
): EventSearch {
  const step = search.step;
  return {
    participant:
      typeof search.participant === "string" ? search.participant : undefined,
    step:
      step === "edit" || step === "email" || step === "share"
        ? step
        : undefined,
    // The router JSON-parses search values, so "1" arrives as a number.
    pair:
      search.pair === true ||
      search.pair === "1" ||
      search.pair === 1 ||
      undefined,
  };
}
