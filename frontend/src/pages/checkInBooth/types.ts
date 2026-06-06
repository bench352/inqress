export interface CheckinSuccessDetail {
  title: string | null;
  name: string;
}

export interface CheckinConflictDetail {
  reason: string;
  conflictingParticipants: Array<{
    id: string;
    title: string | null;
    name: string;
    email: string | null;
    countryCode: string | null;
    phone: string | null;
    checkedInAt: string | null;
  }>;
}

export interface CheckinErrorDetail {
  reason: string;
}

export interface CheckinResponse {
  success: boolean;
  detail: CheckinSuccessDetail | CheckinConflictDetail | CheckinErrorDetail;
}

export type CheckinPhase =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "multiple";
