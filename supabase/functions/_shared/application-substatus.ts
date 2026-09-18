/** Map live CaseFunders application statuses onto the CRM substatus ledger. */

export const APPLICATION_SUBSTATUSES = [
  'application_invite_sent',
  'application_incomplete',
  'no_offers_available',
  'offer_selection_needed',
  'client_declined_offers',
  'offer_processing',
  'funds_in_transit',
  'funded',
  'error',
  'application_withdrawn',
] as const;

export type ApplicationSubstatus = (typeof APPLICATION_SUBSTATUSES)[number];

export function mapPlatformSubstatus(raw: string, fundedAmount?: number | null): string {
  const s = (raw || '').trim().toLowerCase();
  if (fundedAmount != null && fundedAmount > 0) return 'funded';
  if (!s) return 'application_invite_sent';
  if (s === 'client invited' || s === 'application invite sent' || s === 'link sent') return 'application_invite_sent';
  if (s === 'application started' || s === 'application incomplete' || s === 'incomplete') return 'application_incomplete';
  if (s === 'no offer' || s === 'no offers' || s === 'no offers available') return 'no_offers_available';
  if (
    s === 'offer selection needed' ||
    s === 'offers available' ||
    s === 'client reviewing offers' ||
    s === 'client reviewing'
  ) {
    return 'offer_selection_needed';
  }
  if (s === 'client declined offers' || s === 'declined' || s === 'client declined') return 'client_declined_offers';
  if (s === 'offer processing' || s === 'processing' || s === 'client selected offer') return 'offer_processing';
  if (s === 'funds in transit' || s === 'approved') return 'funds_in_transit';
  if (s === 'funded') return 'funded';
  if (s === 'error' || s === 'issue' || s === 'stuck') return 'error';
  if (s === 'application withdrawn' || s === 'withdrawn' || s === 'cancelled') return 'application_withdrawn';
  return 'application_incomplete';
}
