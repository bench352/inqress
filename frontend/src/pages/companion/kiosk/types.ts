export interface CheckinSuccessDetail {
  title: string | null;
  name: string;
}

export interface ConflictParticipant {
  id: string;
  title: string | null;
  name: string;
  email: string | null;
  countryCode: string | null;
  phone: string | null;
  checkedInAt: string | null;
}

export interface CheckinConflictDetail {
  reason: string;
  conflictingParticipants: ConflictParticipant[];
}

export interface CheckinErrorDetail {
  reason: string;
  // Set when the server identified the guest (refused scan, or that refusal
  // relayed to the kiosk). Other check-in errors carry the reason alone.
  title?: string | null;
  name?: string | null;
}

export interface CheckinResponse {
  success: boolean;
  detail: CheckinSuccessDetail | CheckinConflictDetail | CheckinErrorDetail;
}

export type CheckinPhase =
  | "input"
  | "loading"
  | "success"
  | "error"
  | "multiple";

export function isConflictDetail(
  detail: CheckinResponse["detail"],
): detail is CheckinConflictDetail {
  return "conflictingParticipants" in detail;
}

export function isSuccessDetail(
  detail: CheckinResponse["detail"],
): detail is CheckinSuccessDetail {
  return !("reason" in detail);
}

export function isErrorDetail(
  detail: CheckinResponse["detail"],
): detail is CheckinErrorDetail {
  return "reason" in detail;
}
