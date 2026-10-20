export const PARTICIPANT_FIELDS = [
  "(Ignore)",
  "Title",
  "Name",
  "Phone",
  "Email",
] as const;

export type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];
