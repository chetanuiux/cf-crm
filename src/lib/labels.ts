import { STATUS_LABELS } from "@/lib/pipeline-status";

// Human-readable labels and badge tones for all enums.
export const titleize = (s: string | null | undefined) =>
  (s ?? "").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export function statusLabel(s: string | null | undefined): string {
  if (!s) return "";
  return STATUS_LABELS[s] ?? titleize(s);
}

export const formatLocation = (city: string | null | undefined, state: string | null | undefined) =>
  [city, state].filter(Boolean).join(", ") || "—";

export type Tone = "neutral" | "info" | "success" | "warning" | "destructive" | "muted";

export function salesStatusTone(s: string): Tone {
  if (["signed_up", "demo_completed_signed_up", "onboarding_approved", "first_case_funded", "three_cases_funded"].includes(s)) return "success";
  if (["lost_not_interested", "dnc", "demo_completed_didnt_sign_up"].includes(s)) return "destructive";
  if (["demo_no_show", "demo_needs_reschedule"].includes(s)) return "warning";
  if (["new_lead", "contacted", "reconnect_later"].includes(s)) return "muted";
  return "info";
}
export function onboardingTone(s: string): Tone {
  if (["complete", "ready_for_first_application", "onboarding_approved", "first_case_funded", "three_cases_funded"].includes(s)) return "success";
  if (s === "not_started") return "muted";
  return "info";
}
export function paymentSetupTone(s: string): Tone {
  if (s === "verified_ready") return "success";
  if (s === "issue_manual_review" || s === "disabled") return "destructive";
  if (s === "not_started") return "muted";
  return "info";
}
export function applicationTone(s: string): Tone {
  if (["funded", "paid_to_firm", "approved", "client_selected_offer", "funds_in_transit"].includes(s)) return "success";
  if (["declined", "issue_stuck", "no_offers", "cancelled", "error", "client_declined_offers", "no_offers_available", "application_withdrawn"].includes(s)) return "destructive";
  if (["link_not_sent", "link_sent", "application_invite_sent"].includes(s)) return "muted";
  return "info";
}
export function fundingTone(s: string): Tone {
  if (["confirmed_funded", "disbursed_to_client", "approved"].includes(s)) return "success";
  if (["failed", "cancelled"].includes(s)) return "destructive";
  if (s === "manual_review") return "warning";
  if (s === "not_started") return "muted";
  return "info";
}
export function paymentTone(s: string): Tone {
  if (["paid_to_firm", "charged"].includes(s)) return "success";
  if (["failed", "refunded", "cancelled"].includes(s)) return "destructive";
  if (s === "manual_review") return "warning";
  if (s === "not_started") return "muted";
  return "info";
}
export function taskTone(s: string): Tone {
  if (s === "completed") return "success";
  if (s === "overdue") return "destructive";
  if (s === "in_progress") return "info";
  if (s === "cancelled") return "muted";
  return "neutral";
}
export function priorityTone(s: string): Tone {
  if (s === "urgent") return "destructive";
  if (s === "high") return "warning";
  if (s === "low") return "muted";
  return "info";
}
export function lenderTone(s: string): Tone {
  if (s === "active") return "success";
  if (s === "paused" || s === "testing") return "warning";
  if (s === "inactive") return "muted";
  return "info";
}
export function offerTone(s: string): Tone {
  if (s === "selected") return "success";
  if (s === "declined" || s === "error" || s === "expired") return "destructive";
  if (s === "manual_review") return "warning";
  return "info";
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales_team_lead: "Sales Team Lead",
  sales: "Sales / Account Manager",
  operations_team_lead: "Operations Team Lead",
  operations: "Operations",
  support: "Support / Read Only",
};

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));

export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
export const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
export const fmtDateUTC = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
};
export const fmtTimeUTC = (d: string | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
};
export const fmtLocalDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
};
