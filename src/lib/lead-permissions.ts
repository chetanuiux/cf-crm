import type { AppRole } from "./auth";

/** All CRM roles may convert a lead into a firm */
export const LEAD_CONVERT_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "sales_team_lead",
  "sales",
  "operations_team_lead",
  "operations",
  "support",
];

/** All CRM roles may dismiss (soft-delete) a lead */
export const LEAD_DISMISS_ROLES: AppRole[] = LEAD_CONVERT_ROLES;

export function canConvertLead(roles: AppRole[]) {
  return roles.some((r) => LEAD_CONVERT_ROLES.includes(r));
}

export function canDismissLead(roles: AppRole[]) {
  return roles.some((r) => LEAD_DISMISS_ROLES.includes(r));
}
