# Calendar Module — Frontend Complete / Backend Handoff

**Date:** May 18, 2026  
**Status:** Frontend done, running on mock data. Ready to swap to real backend.

---

## What's Built (Frontend)

The full Calendar UI is live at `/calendar`. Everything runs against an in-memory mock right now — no backend calls are made.

### Views
- **Month view** — traditional grid, color-coded events, max 3 per cell with "+N more" overflow, click cell to switch to Day view
- **Week view** — 7-column time grid (6am–10pm), events as positioned blocks
- **Day view** — single-day time grid, same behavior as Week
- **Agenda view** — chronological list grouped by day with full event details

### Features
- **Create / Edit / Delete events** — full modal with validation, inline conflict detection warning
- **Event types** with color coding: Demo (green), Discovery (blue), Follow-up (amber), Underwriting (purple), Signing (red), Internal (gray)
- **Event detail drawer** — slides from right, shows all metadata, attendee RSVP status icons, clickable firm/application links
- **Conflict detection** — on save, checks for overlapping events and shows "schedule anyway?" prompt
- **Attendee chips** — multi-email input with add/remove, stored with RSVP status
- **Firm + Application linking** — event stores `firm_id`, `firm_name`, `application_id`, `application_ref` for display
- **Google Calendar banner** — dismissible, shown when Google sync is not connected
- **Filter by event type** — dropdown in header filters all views
- **Timezone-aware display** — each event stores an IANA timezone and times render in that zone
- **Empty states** with CTA to create first event

### Architecture (how the swap works)

```
VITE_USE_MOCKS=true   →  src/api/mocks/calendar.mock.ts   (in-memory, fake delay)
VITE_USE_MOCKS=false  →  src/api/real/calendar.real.ts    (throws "Not implemented yet")
```

Every component imports only from `src/api/index.ts` — never touches mock or real directly.  
To go live: implement `calendar.real.ts` and flip the env var.

---

## What Backend Needs to Build

### 1. Database Table

```sql
create table calendar_events (
  id               uuid primary key default gen_random_uuid(),
  google_event_id  text,                         -- null until Google sync
  user_id          uuid not null references profiles(id),
  firm_id          uuid references firms(id),
  application_id   uuid references client_applications(id),
  firm_name        text,                         -- denormalized for display speed
  application_ref  text,                         -- e.g. "APP-1042"
  title            text not null,
  description      text not null default '',
  event_type       text not null,                -- demo | discovery | follow_up | underwriting | signing | internal
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  timezone         text not null,               -- IANA, e.g. "America/Los_Angeles"
  attendees        jsonb not null default '[]', -- [{ email, name, response_status }]
  status           text not null default 'confirmed',  -- confirmed | tentative | cancelled
  is_recurring     boolean not null default false,
  recurrence_rule  text,                        -- RRULE format, null if not recurring
  location         text,
  meeting_url      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- RLS: users can read all events in their org; can only write their own
alter table calendar_events enable row level security;
```

### 2. API Methods to Implement

Open `src/api/real/calendar.real.ts` — every method has a `TODO: backend` comment with the exact Supabase query. Summary:

| Method | Query |
|---|---|
| `list(params)` | `select * from calendar_events where start_at >= :start and start_at <= :end` + optional filters |
| `get(id)` | `select * where id = :id` |
| `create(event)` | `insert into calendar_events ... returning *` |
| `update(id, patch)` | `update calendar_events set ... where id = :id returning *` |
| `delete(id)` | `delete from calendar_events where id = :id` |
| `checkConflicts(start, end, user_ids)` | `select * where user_id = any(:user_ids) and start_at < :end and end_at > :start` |
| `connectGoogle()` | Edge Function — initiate Google OAuth, return `auth_url` |
| `disconnectGoogle()` | Edge Function — revoke token |
| `syncStatus()` | `select * from google_calendar_connections where user_id = :uid` |

### 3. Google Calendar Sync (separate table)

```sql
create table google_calendar_connections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  email       text not null,
  access_token  text,
  refresh_token text,
  last_sync   timestamptz,
  created_at  timestamptz default now()
);
```

The `syncStatus()` call checks this table. The OAuth flow needs a Supabase Edge Function with Google OAuth client ID/secret stored as secrets.

### 4. Realtime (optional but nice)

```ts
supabase.channel('calendar-events')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, handler)
  .subscribe()
```

This would push new/updated events to all connected clients without a page refresh.

### 5. Email Reminders (future)

A pg_cron job or Edge Function scheduled to run every 15 minutes:
- Query events where `start_at` is within 24h or 1h from now
- Send email via Resend/SendGrid to all attendees
- Mark reminder sent to avoid duplicates (add `reminder_24h_sent`, `reminder_1h_sent` bool columns)

---

## How to Go Live

1. Run the SQL above in Supabase dashboard (or add as a migration)
2. Implement each method in `src/api/real/calendar.real.ts`
3. In `.env` (production), set `VITE_USE_MOCKS=false` (or remove the var — defaults to real)
4. The entire UI switches over with no component changes needed

The contract in `src/api/contracts/calendar.ts` is the source of truth for the shape of every request and response — backend should match it exactly.
