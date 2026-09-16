import type { CalendarAPI, CalendarEvent, ListParams } from '../contracts/calendar';

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms + Math.random() * 100));

const now = new Date();
const d = (daysOffset: number, h: number, m = 0) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + daysOffset);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

let store: CalendarEvent[] = [
  {
    id: 'evt-001', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-001', firm_name: 'Smith & Associates',
    application_id: 'app-1042', application_ref: 'APP-1042',
    title: 'Demo Call – Smith & Associates', description: 'Walk through CaseFunders platform features and funding process.',
    event_type: 'demo', start_at: d(0, 10), end_at: d(0, 11), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'john.smith@smithlaw.com', name: 'John Smith', response_status: 'accepted' },
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://meet.google.com/abc-defg-hij',
    created_at: d(-3, 9), updated_at: d(-1, 14),
  },
  {
    id: 'evt-002', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-002', firm_name: 'Martinez Law Group',
    application_id: null, application_ref: null,
    title: 'Discovery Call – Martinez Law Group', description: 'Initial discovery to understand their case portfolio and funding needs.',
    event_type: 'discovery', start_at: d(1, 14), end_at: d(1, 14, 45), timezone: 'America/Chicago',
    attendees: [
      { email: 'rosa.martinez@martinezlaw.com', name: 'Rosa Martinez', response_status: 'accepted' },
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/123456789',
    created_at: d(-2, 10), updated_at: d(-2, 10),
  },
  {
    id: 'evt-003', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-003', firm_name: 'Patel Injury Lawyers',
    application_id: 'app-1055', application_ref: 'APP-1055',
    title: 'Underwriting Review – APP-1055', description: 'Review case merit and funding viability for personal injury case.',
    event_type: 'underwriting', start_at: d(2, 9), end_at: d(2, 10, 30), timezone: 'America/New_York',
    attendees: [
      { email: 'amir.patel@patelinjury.com', name: 'Amir Patel', response_status: 'tentative' },
      { email: 'ops@casefunders.com', name: 'Ops Team', response_status: 'accepted' },
    ],
    status: 'tentative', is_recurring: false, recurrence_rule: null,
    location: '1200 Brickell Ave, Miami, FL', meeting_url: null,
    created_at: d(-1, 11), updated_at: d(-1, 11),
  },
  {
    id: 'evt-004', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-004', firm_name: 'Chen & Partners',
    application_id: 'app-1061', application_ref: 'APP-1061',
    title: 'Signing – Chen & Partners Funding Agreement', description: 'Final signing of funding documents for APP-1061.',
    event_type: 'signing', start_at: d(3, 13), end_at: d(3, 13, 30), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'linda.chen@chenpartners.com', name: 'Linda Chen', response_status: 'accepted' },
      { email: 'legal@casefunders.com', name: 'Legal Team', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://docusign.com/sign/xyz',
    created_at: d(-2, 15), updated_at: d(-1, 9),
  },
  {
    id: 'evt-005', google_event_id: null, user_id: 'user-nick',
    firm_id: null, firm_name: null, application_id: null, application_ref: null,
    title: 'Weekly Sales Standup', description: 'Internal weekly sync for the sales team.',
    event_type: 'internal', start_at: d(0, 9), end_at: d(0, 9, 30), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
      { email: 'sales@casefunders.com', name: 'Sales Team', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: true, recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
    location: null, meeting_url: 'https://meet.google.com/internal-standup',
    created_at: d(-30, 9), updated_at: d(-30, 9),
  },
  {
    id: 'evt-006', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-005', firm_name: 'Goldberg Legal',
    application_id: null, application_ref: null,
    title: 'Follow-up – Goldberg Legal Q2 Pipeline', description: 'Follow up on Q2 pipeline discussion and outstanding applications.',
    event_type: 'follow_up', start_at: d(4, 11), end_at: d(4, 11, 45), timezone: 'America/New_York',
    attendees: [
      { email: 'daniel.goldberg@goldberglegal.com', name: 'Daniel Goldberg', response_status: 'pending' },
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/987654321',
    created_at: d(-1, 16), updated_at: d(-1, 16),
  },
  {
    id: 'evt-007', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-001', firm_name: 'Smith & Associates',
    application_id: 'app-1070', application_ref: 'APP-1070',
    title: 'Demo – New Case Types Discussion', description: 'Demo of new features for personal injury funding.',
    event_type: 'demo', start_at: d(5, 15), end_at: d(5, 16), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'john.smith@smithlaw.com', name: 'John Smith', response_status: 'accepted' },
      { email: 'partner@smithlaw.com', name: 'Amy Smith', response_status: 'tentative' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://meet.google.com/demo-new',
    created_at: d(-2, 8), updated_at: d(-2, 8),
  },
  {
    id: 'evt-008', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-003', firm_name: 'Patel Injury Lawyers',
    application_id: 'app-1058', application_ref: 'APP-1058',
    title: 'Underwriting Review – APP-1058', description: 'Second underwriting review for motor vehicle accident case.',
    event_type: 'underwriting', start_at: d(6, 10), end_at: d(6, 11, 30), timezone: 'America/New_York',
    attendees: [
      { email: 'amir.patel@patelinjury.com', name: 'Amir Patel', response_status: 'accepted' },
      { email: 'underwriting@casefunders.com', name: 'Underwriting', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: null,
    created_at: d(-3, 14), updated_at: d(-3, 14),
  },
  {
    id: 'evt-009', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-002', firm_name: 'Martinez Law Group',
    application_id: 'app-1063', application_ref: 'APP-1063',
    title: 'Signing Ceremony – Martinez APP-1063', description: 'Execution of funding agreement.',
    event_type: 'signing', start_at: d(7, 14), end_at: d(7, 14, 30), timezone: 'America/Chicago',
    attendees: [
      { email: 'rosa.martinez@martinezlaw.com', name: 'Rosa Martinez', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: '500 W Madison St, Chicago, IL', meeting_url: null,
    created_at: d(-2, 12), updated_at: d(-2, 12),
  },
  {
    id: 'evt-010', google_event_id: null, user_id: 'user-nick',
    firm_id: null, firm_name: null, application_id: null, application_ref: null,
    title: 'Q2 Pipeline Review (Internal)', description: 'Quarterly review of pipeline health and forecasting.',
    event_type: 'internal', start_at: d(7, 9), end_at: d(7, 11), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
      { email: 'ops@casefunders.com', name: 'Ops Team', response_status: 'accepted' },
      { email: 'finance@casefunders.com', name: 'Finance Team', response_status: 'tentative' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: 'Board Room A', meeting_url: null,
    created_at: d(-7, 10), updated_at: d(-7, 10),
  },
  {
    id: 'evt-011', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-004', firm_name: 'Chen & Partners',
    application_id: null, application_ref: null,
    title: 'Discovery Call – Chen & Partners Expansion', description: 'Discussing expanded funding across their office network.',
    event_type: 'discovery', start_at: d(8, 13), end_at: d(8, 13, 45), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'linda.chen@chenpartners.com', name: 'Linda Chen', response_status: 'accepted' },
      { email: 'michael.chen@chenpartners.com', name: 'Michael Chen', response_status: 'pending' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/111222333',
    created_at: d(-1, 9), updated_at: d(-1, 9),
  },
  {
    id: 'evt-012', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-005', firm_name: 'Goldberg Legal',
    application_id: 'app-1075', application_ref: 'APP-1075',
    title: 'Follow-up – APP-1075 Status Update', description: 'Follow up on underwriting decision status.',
    event_type: 'follow_up', start_at: d(9, 10), end_at: d(9, 10, 30), timezone: 'America/New_York',
    attendees: [
      { email: 'daniel.goldberg@goldberglegal.com', name: 'Daniel Goldberg', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://meet.google.com/follow-up',
    created_at: d(-2, 11), updated_at: d(-2, 11),
  },
  {
    id: 'evt-013', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-001', firm_name: 'Smith & Associates',
    application_id: 'app-1080', application_ref: 'APP-1080',
    title: 'Underwriting Review – APP-1080', description: 'Complex multi-plaintiff case review.',
    event_type: 'underwriting', start_at: d(10, 11), end_at: d(10, 12, 30), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'john.smith@smithlaw.com', name: 'John Smith', response_status: 'accepted' },
      { email: 'underwriting@casefunders.com', name: 'Underwriting', response_status: 'accepted' },
    ],
    status: 'tentative', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: null,
    created_at: d(-3, 15), updated_at: d(-3, 15),
  },
  {
    id: 'evt-014', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-002', firm_name: 'Martinez Law Group',
    application_id: null, application_ref: null,
    title: 'Demo – Mass Tort Funding Features', description: 'Showcasing new mass tort product capabilities.',
    event_type: 'demo', start_at: d(11, 15), end_at: d(11, 16), timezone: 'America/Chicago',
    attendees: [
      { email: 'rosa.martinez@martinezlaw.com', name: 'Rosa Martinez', response_status: 'accepted' },
      { email: 'associate@martinezlaw.com', name: 'Carlos Vega', response_status: 'pending' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/444555666',
    created_at: d(-1, 10), updated_at: d(-1, 10),
  },
  {
    id: 'evt-015', google_event_id: null, user_id: 'user-nick',
    firm_id: null, firm_name: null, application_id: null, application_ref: null,
    title: 'Weekly Sales Standup', description: 'Internal weekly sync for the sales team.',
    event_type: 'internal', start_at: d(7, 9), end_at: d(7, 9, 30), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
      { email: 'sales@casefunders.com', name: 'Sales Team', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: true, recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
    location: null, meeting_url: 'https://meet.google.com/internal-standup',
    created_at: d(-30, 9), updated_at: d(-30, 9),
  },
  {
    id: 'evt-016', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-003', firm_name: 'Patel Injury Lawyers',
    application_id: null, application_ref: null,
    title: 'Follow-up – Patel Referral Program', description: 'Discuss referral incentives and new firm intro calls.',
    event_type: 'follow_up', start_at: d(12, 9, 30), end_at: d(12, 10), timezone: 'America/New_York',
    attendees: [
      { email: 'amir.patel@patelinjury.com', name: 'Amir Patel', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://meet.google.com/patel-follow-up',
    created_at: d(-2, 13), updated_at: d(-2, 13),
  },
  {
    id: 'evt-017', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-005', firm_name: 'Goldberg Legal',
    application_id: 'app-1088', application_ref: 'APP-1088',
    title: 'Signing – Goldberg APP-1088', description: 'Funding agreement execution for slip & fall case.',
    event_type: 'signing', start_at: d(14, 13), end_at: d(14, 13, 30), timezone: 'America/New_York',
    attendees: [
      { email: 'daniel.goldberg@goldberglegal.com', name: 'Daniel Goldberg', response_status: 'accepted' },
      { email: 'legal@casefunders.com', name: 'Legal Team', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://docusign.com/sign/abc123',
    created_at: d(-3, 11), updated_at: d(-3, 11),
  },
  {
    id: 'evt-018', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-004', firm_name: 'Chen & Partners',
    application_id: 'app-1090', application_ref: 'APP-1090',
    title: 'Underwriting Review – APP-1090', description: 'Workplace injury review — Chen & Partners.',
    event_type: 'underwriting', start_at: d(15, 10), end_at: d(15, 11), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'linda.chen@chenpartners.com', name: 'Linda Chen', response_status: 'accepted' },
      { email: 'underwriting@casefunders.com', name: 'Underwriting', response_status: 'pending' },
    ],
    status: 'tentative', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: null,
    created_at: d(-4, 16), updated_at: d(-4, 16),
  },
  {
    id: 'evt-019', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-001', firm_name: 'Smith & Associates',
    application_id: null, application_ref: null,
    title: 'Discovery Call – New Practice Area', description: 'Exploring medical malpractice funding options.',
    event_type: 'discovery', start_at: d(18, 14), end_at: d(18, 14, 45), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'john.smith@smithlaw.com', name: 'John Smith', response_status: 'pending' },
    ],
    status: 'tentative', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/777888999',
    created_at: d(-1, 12), updated_at: d(-1, 12),
  },
  {
    id: 'evt-020', google_event_id: null, user_id: 'user-nick',
    firm_id: null, firm_name: null, application_id: null, application_ref: null,
    title: 'Monthly All-Hands', description: 'Company-wide monthly all-hands meeting.',
    event_type: 'internal', start_at: d(20, 10), end_at: d(20, 11, 30), timezone: 'America/Los_Angeles',
    attendees: [
      { email: 'nick@casefunders.com', name: 'Nick Nagel', response_status: 'accepted' },
      { email: 'all@casefunders.com', name: 'All Staff', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: true, recurrence_rule: 'RRULE:FREQ=MONTHLY',
    location: 'Main Conference Room', meeting_url: 'https://meet.google.com/all-hands',
    created_at: d(-30, 9), updated_at: d(-30, 9),
  },
  {
    id: 'evt-021', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-002', firm_name: 'Martinez Law Group',
    application_id: 'app-1095', application_ref: 'APP-1095',
    title: 'Follow-up – APP-1095 Funding Decision', description: 'Communicate final funding decision and next steps.',
    event_type: 'follow_up', start_at: d(22, 11), end_at: d(22, 11, 30), timezone: 'America/Chicago',
    attendees: [
      { email: 'rosa.martinez@martinezlaw.com', name: 'Rosa Martinez', response_status: 'accepted' },
    ],
    status: 'confirmed', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: null,
    created_at: d(-2, 14), updated_at: d(-2, 14),
  },
  {
    id: 'evt-022', google_event_id: null, user_id: 'user-nick',
    firm_id: 'firm-005', firm_name: 'Goldberg Legal',
    application_id: null, application_ref: null,
    title: 'Demo – Goldberg Referral Program', description: 'Show referral dashboard and commission tracking features.',
    event_type: 'demo', start_at: d(25, 15), end_at: d(25, 16), timezone: 'America/New_York',
    attendees: [
      { email: 'daniel.goldberg@goldberglegal.com', name: 'Daniel Goldberg', response_status: 'pending' },
      { email: 'associate@goldberglegal.com', name: 'Sarah Bloom', response_status: 'pending' },
    ],
    status: 'tentative', is_recurring: false, recurrence_rule: null,
    location: null, meeting_url: 'https://zoom.us/j/999000111',
    created_at: d(-1, 15), updated_at: d(-1, 15),
  },
];

let idCounter = 100;
const newId = () => `evt-${++idCounter}`;
const nowISO = () => new Date().toISOString();

export const calendarMock: CalendarAPI = {
  async list({ start, end, user_id, firm_id, event_type }: ListParams) {
    await delay();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return store.filter(ev => {
      const evStart = new Date(ev.start_at).getTime();
      if (evStart < s || evStart > e) return false;
      if (user_id && ev.user_id !== user_id) return false;
      if (firm_id && ev.firm_id !== firm_id) return false;
      if (event_type && ev.event_type !== event_type) return false;
      return true;
    });
  },

  async get(id: string) {
    await delay(200);
    const ev = store.find(e => e.id === id);
    if (!ev) throw new Error(`Event ${id} not found`);
    return ev;
  },

  async create(event) {
    await delay();
    const now2 = nowISO();
    const created: CalendarEvent = { ...event, id: newId(), google_event_id: null, created_at: now2, updated_at: now2 };
    store = [created, ...store];
    return created;
  },

  async update(id: string, patch: Partial<CalendarEvent>) {
    await delay();
    const idx = store.findIndex(e => e.id === id);
    if (idx === -1) throw new Error(`Event ${id} not found`);
    const updated = { ...store[idx], ...patch, updated_at: nowISO() };
    store = store.map((e, i) => (i === idx ? updated : e));
    return updated;
  },

  async delete(id: string) {
    await delay(200);
    store = store.filter(e => e.id !== id);
  },

  async checkConflicts(start: string, end: string, user_ids: string[]) {
    await delay(200);
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return store.filter(ev => {
      if (!user_ids.includes(ev.user_id)) return false;
      const evS = new Date(ev.start_at).getTime();
      const evE = new Date(ev.end_at).getTime();
      return evS < e && evE > s;
    });
  },

  // TODO: backend — initiate Google OAuth flow, return redirect URL
  async connectGoogle() {
    await delay(400);
    return { auth_url: 'https://accounts.google.com/o/oauth2/auth?mock=true' };
  },

  // TODO: backend — revoke Google token for current user
  async disconnectGoogle() {
    await delay(300);
  },

  // TODO: backend — check google_calendar_connections table for current user
  async syncStatus() {
    await delay(200);
    return { connected: false, last_sync: null, email: null };
  },
};
