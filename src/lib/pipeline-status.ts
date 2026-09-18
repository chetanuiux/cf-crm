/** CaseFunders sales + application pipeline ledgers and display labels. */

export const SALES_FLOW = [
  "new_lead",
  "contacted",
  "demo_booked",
  "demo_completed",
  "signed_up",
] as const;

export const SALES_BRANCHES = ["demo_no_show", "lost_not_interested", "dnc"] as const;

export const SALES_OPTIONS = [...SALES_FLOW, ...SALES_BRANCHES] as const;

export const SALES_COMPLETE = "signed_up";

export const ONBOARDING_FLOW = [
  "onboarding_submitted",
  "onboarding_approved",
  "first_case_funded",
  "three_cases_funded",
] as const;

export const APPLICATION_SUBSTATUSES = [
  "application_invite_sent",
  "application_incomplete",
  "no_offers_available",
  "offer_selection_needed",
  "client_declined_offers",
  "offer_processing",
  "funds_in_transit",
  "funded",
  "error",
  "application_withdrawn",
] as const;

export type SalesFlowStatus = (typeof SALES_FLOW)[number];
export type SalesStatus = (typeof SALES_OPTIONS)[number];
export type OnboardingStatus = (typeof ONBOARDING_FLOW)[number];
export type ApplicationSubstatus = (typeof APPLICATION_SUBSTATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  demo_booked: "Demo Booked",
  demo_completed: "Demo Completed",
  signed_up: "Signed Up",
  demo_completed_signed_up: "Signed Up",
  demo_completed_didnt_sign_up: "Demo Completed",
  demo_no_show: "Demo No-Show",
  lost_not_interested: "Lost — Not Interested",
  dnc: "Do Not Contact",
  interested: "Contacted",
  signup_link_sent: "Contacted",
  follow_up_after_demo: "Demo Completed",
  demo_needs_reschedule: "Demo Booked",
  reconnect_later: "Contacted",

  onboarding_submitted: "Onboarding Submitted",
  onboarding_approved: "Onboarding Approved",
  first_case_funded: "First Case Funded",
  three_cases_funded: "Three Cases Funded",
  signup_submitted: "Onboarding Submitted",
  bank_account_connected: "Onboarding Submitted",
  onboarding_done: "Onboarding Approved",
  completed_first_application: "First Case Funded",
  funded_three_cases: "Three Cases Funded",
  not_started: "Not Started",
  ready_for_first_application: "Onboarding Approved",
  complete: "Onboarding Approved",

  application_invite_sent: "Application Invite Sent",
  application_incomplete: "Application Incomplete",
  no_offers_available: "No Offers Available",
  offer_selection_needed: "Offer Selection Needed",
  client_declined_offers: "Client Declined Offers",
  offer_processing: "Offer Processing",
  funds_in_transit: "Funds in Transit",
  funded: "Funded",
  error: "Error",
  application_withdrawn: "Application Withdrawn",
  link_sent: "Application Invite Sent",
  link_not_sent: "Application Invite Sent",
  application_started: "Application Incomplete",
  submitted: "Application Incomplete",
  offers_available: "Offer Selection Needed",
  no_offers: "No Offers Available",
  client_selected_offer: "Offer Processing",
  approved: "Offer Processing",
  declined: "Client Declined Offers",
  issue_stuck: "Error",
  cancelled: "Application Withdrawn",
  paid_to_firm: "Funded",
};

export function canonicalSalesStatus(s: string): string {
  if (s === "demo_completed_signed_up") return "signed_up";
  if (s === "demo_completed_didnt_sign_up" || s === "follow_up_after_demo") return "demo_completed";
  if (s === "interested" || s === "signup_link_sent" || s === "reconnect_later") return "contacted";
  if (s === "demo_needs_reschedule") return "demo_booked";
  return s;
}

export function canonicalOnboardingStatus(s: string): string {
  if (s === "signup_submitted" || s === "bank_account_connected") return "onboarding_submitted";
  if (
    s === "onboarding_done" ||
    s === "ready_for_first_application" ||
    s === "complete"
  ) {
    return "onboarding_approved";
  }
  if (s === "completed_first_application") return "first_case_funded";
  if (s === "funded_three_cases") return "three_cases_funded";
  return s;
}

export function mapPlatformSubstatus(raw: string, fundedAmount?: number | null): ApplicationSubstatus | "link_not_sent" {
  const s = (raw || "").trim().toLowerCase();
  if (fundedAmount != null && fundedAmount > 0) return "funded";
  if (!s) return "link_not_sent";
  if (s === "client invited" || s === "application invite sent" || s === "link sent") return "application_invite_sent";
  if (s === "application started" || s === "application incomplete" || s === "incomplete") return "application_incomplete";
  if (s === "no offer" || s === "no offers" || s === "no offers available") return "no_offers_available";
  if (
    s === "offer selection needed" ||
    s === "offers available" ||
    s === "client reviewing offers" ||
    s === "client reviewing"
  ) {
    return "offer_selection_needed";
  }
  if (s === "client declined offers" || s === "declined" || s === "client declined") return "client_declined_offers";
  if (s === "offer processing" || s === "processing" || s === "client selected offer") return "offer_processing";
  if (s === "funds in transit" || s === "approved") return "funds_in_transit";
  if (s === "funded") return "funded";
  if (s === "error" || s === "issue" || s === "stuck") return "error";
  if (s === "application withdrawn" || s === "withdrawn" || s === "cancelled") return "application_withdrawn";
  return "application_incomplete";
}

export function pipelineStatus(salesStatus: string, onboardingStatus: string): string {
  const sales = canonicalSalesStatus(salesStatus);
  if (sales === "lost_not_interested" || sales === "dnc") return sales;
  if (sales !== "signed_up") return sales;
  const onboard = canonicalOnboardingStatus(onboardingStatus);
  if (ONBOARDING_FLOW.includes(onboard as OnboardingStatus)) return onboard;
  return "signed_up";
}

export const SALES_TERMINAL = new Set(["lost_not_interested", "dnc", "three_cases_funded"]);
export const APPLICATION_NO_FOLLOW_UP = new Set(["no_offers_available", "funded", "application_withdrawn"]);
