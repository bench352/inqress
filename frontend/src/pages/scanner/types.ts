export interface CheckinSuccessDetail {
  title: string;
  name: string;
}

export interface CheckinErrorDetail {
  reason: string;
}

export interface CheckinResponse {
  success: boolean;
  detail: CheckinSuccessDetail | CheckinErrorDetail;
}

export type CheckinPhase = "idle" | "loading" | "success" | "error";
