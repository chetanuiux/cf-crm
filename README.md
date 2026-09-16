# CaseFundersHQ CRM

Internal CRM for CaseFunders — manages leads, law firm applications, commissions, tasks, calendar, and support tickets. Built with [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router) and [Supabase](https://supabase.com) (Postgres, Auth, Edge Functions), deployed to Cloudflare Workers.

## Tech stack

- **Framework:** TanStack Start (React 19, TanStack Router, Vite 7)
- **UI:** Tailwind CSS 4, Radix UI primitives, shadcn-style components (`src/components/ui`)
- **Data/Auth:** Supabase (Postgres + Row Level Security, Auth, Edge Functions)
- **Deployment:** Cloudflare Workers (`@cloudflare/vite-plugin`, `wrangler.jsonc`)
- **Forms/validation:** react-hook-form + zod
- **State/data fetching:** TanStack Query

## Getting started

```bash
# install dependencies
npm install   # or bun install

# copy env template and fill in values
cp .env.example .env.development
```

Fill in `.env.development` with your Supabase project URL/keys and Google OAuth credentials (see comments in [.env.example](.env.example) for details on which values are needed client-side vs. server-side vs. Supabase Edge Function secrets).

```bash
npm run dev
```

The app runs on Vite's dev server. Sign-in and most data flow through Supabase, so a configured Supabase project (or `VITE_USE_MOCKS=true` for mocked data, currently used by the calendar feature) is required for local development.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Build in development mode |
| `npm run preview` | Preview a production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm run migrate:calendar` | Run the calendar-related Supabase migration |
| `npm run migrate:all` | Run all Supabase migrations |
| `npm run remove-demo-data` | Remove seeded demo data from the database |
| `npm run clean-leads-firms` | Clean up leads/firms data via `scripts/clean-leads-firms.mjs` |

## Project structure

```
src/
  routes/            TanStack Router file-based routes (auth-gated under _authenticated/)
  features/          Feature modules (e.g. calendar)
  components/        Shared UI components (components/ui = design-system primitives)
  api/               Typed API contracts, with mock and real implementations
  integrations/      Third-party integrations (Supabase client/auth/middleware)
  lib/               Shared utilities, server functions, and domain helpers
  server.ts          Cloudflare Worker/server entry
  router.tsx          Router setup
supabase/
  migrations/        SQL migrations
  functions/         Supabase Edge Functions (Google Calendar OAuth, lead emails, admin user mgmt, etc.)
scripts/             One-off/maintenance Node scripts (migrations, demo data, user passwords)
```

### Key routes

The app is organized around CRM entities, all under `_authenticated`: dashboard, leads, applications, firms, commissions, tasks, calendar, notes, notifications, reports, support tickets, team communications, admin, and settings.

### Supabase Edge Functions

- `google-calendar-connect` / `google-calendar-callback` / `google-calendar-disconnect` — Google Calendar OAuth flow
- `send-lead-email` — notifies the team when a lead is created
- `submit-website-lead` — intake endpoint for leads submitted from the public website
- `list-platform-applications` — proxies application data from the CaseFunders platform
- `admin-manage-user` — admin user management

## Deployment

The app deploys to Cloudflare Workers via `wrangler.jsonc` (entry point `src/server.ts`). Supabase Edge Functions are deployed separately via the Supabase CLI (`supabase/config.toml`, `supabase/functions/`).

Note: the Google OAuth callback is handled by the Supabase Edge Function (`google-calendar-callback`), not by the Cloudflare Worker — Vercel-style `/api/*` routes are not used in this deployment target. See [.env.example](.env.example) for the full list of required environment variables and secrets across the client, server, and Supabase Edge Functions.