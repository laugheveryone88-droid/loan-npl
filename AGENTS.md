<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Loan NPL project context

## Product identity

- Product name: **Loan NPL** (`loan_npl`).
- Purpose: a Mongolian loan portfolio and non-performing loan (NPL) management
  system for financial institutions.
- Primary users: portfolio managers, credit/risk staff, collection staff, and
  system administrators.
- Product language: all user-visible product copy must be in Mongolian. Keep
  established brand names such as Loan NPL, Supabase, and Vercel unchanged.
- Current maturity: authenticated live Google Sheets analysis workspace with
  overdue-loan and standalone viewer dashboards. Google Sheets is the sole source for loan work fields; the application is read-only
  and preserves owner-scoped source snapshots in Supabase.
  Broader live operational analytics and true role-based authorization are not implemented yet.

## Current pages and navigation

### Implemented routes

- `/login` — responsive Mongolian email/password and Google sign-in page.
  Authentication is handled by Supabase Auth. Google sign-in also requests the
  read-only Google Sheets scope. By default, an authenticated visitor is redirected
  directly to `/overdue`.
- `/forgot-password` — public Supabase Auth password-recovery request page. It
  avoids account enumeration and sends a one-time recovery link back through
  `/auth/callback`.
- `/update-password` — recovery-session-only new-password page. It updates the
  authenticated Supabase user and signs out the local recovery session before
  returning the user to `/login`.
- `/` — protected entry route that immediately redirects to `/overdue`; it renders
  no intermediate connection or dashboard-selection page.
- `/overdue` — Google Sheets-backed overdue-loan dashboard using every available
  source column. It groups customers by normalized CIF, provides metrics, a read-only
  source table (50 rows per page), and immutable history. L (`Төлөв`) is read from
  the Sheet; date, status, and notes are edited only in Google Sheets. All columns,
  including newly added or unnamed columns, appear after an administrator manually
  presses `Одоо шинэчлэх`. Opening or focusing the app and connectivity changes do
  not read Google Sheets. All authenticated users read the latest published database
  copy; only an administrator can publish a new copy.
- `/admin/users` — server-protected administrator-only user management. It
  lists Supabase Auth users and supports create, name/role/password update, and
  confirmed deletion through a JWT-protected Edge Function. Passwords are
  never readable or returned; an administrator may only assign a new temporary
  password. The route is hidden from non-administrator navigation, and an
  administrator cannot demote or delete their own account.
- `/dashboard` — protected, standalone view-only presentation of the live
  Google Sheets dashboard. It removes the main application sidebar and detailed
  source-row work tab while preserving filters and main metrics from the latest
  administrator-published copy.
- Unknown routes use the Mongolian `not-found.tsx` page.

The main application sidebar links to `/overdue` as **Үндсэн цэс**. The standalone
`/dashboard` viewer remains available by direct URL but is intentionally omitted
from the sidebar. The sidebar also
contains disabled future areas for daily work, lending eligibility, and
settings. Do not make a disabled item look functional before its route and core
flow exist.

## Dashboard vocabulary and metrics

- NPL / чанаргүй зээл: a non-performing loan.
- User-visible days-past-due wording is `Хугацаа хэтэрсэн хоног`; never show the
  `DPD` abbreviation in the interface. Internal identifiers and source compatibility
  may continue to use DPD.
- Хугацаа хэтэрсэн хоногийн distribution buckets are non-overlapping: 0–5, 6–10, 11–30, 31–60,
  61–90, 91–180, 181+, and unknown.
- The main monetary summary and customer list use column I, `Нийт төлбөрийн дүн`.
- The `Нийт төлбөрийн дүн` KPI sums I only for rows whose L (`Төлөв`) is not
  `Төлсөн`, including blank and other statuses. The paid and unpaid KPIs partition
  the same filtered source rows; changing a row to paid removes its amount from
  this KPI and includes it in `Зөрчил арилгасан дүн`. Historical KPI cards apply
  the same rule using each snapshot's statuses. Raw source/customer table amounts
  remain the original column I values.
- Хугацаа хэтэрсэн хоногийн distribution rows are interactive filters for the detailed source-row
  list, which is paginated 50 rows at a time.
- The main KPI labels use `Давхардаагүй харилцагч` for CIF-grouped customers and
  `Давхардсан харилцагч` for customers with two or more loan rows.
- The detailed source-row list supports surname/name, phone, and CIF search through
  the shared dashboard filter. Each CIF cell shows the customer's grouped loan count.
- The history tab uses only the Google Sheet tab named `Үндсэн`. It starts with
  the retained state captured at 2026-09-04 17:21:17 Asia/Ulaanbaatar and records
  each later state only when an administrator manually refreshes and the source changed,
  including a return to an older state. Changes limited to other tabs do not create
  history. Prior later snapshots were removed at the manual-refresh cutover. Consecutive identical reads
  are suppressed transactionally. Saved versions are grouped by
  capture date and update time. Selecting one time shows that snapshot's five main
  KPIs; `Бүх ангилал` sums those KPIs across every saved time. The history tab does
  not show a customer list or raw detailed Sheet rows.
- Current overdue KPIs: unique customers, customers with multiple loan rows,
  unpaid total payment amount, `Төлөгдөж байгаа`, and `Зөрчил арилгасан дүн`.
- On desktop, the overview uses two rows: five main KPI cards followed by a
  horizontal row of the eight overdue-day customer buckets. Narrow screens wrap the cards
  and buckets. The former `Шалгах харилцагч` KPI is removed; identity filters remain.
- Main KPI cards show labels, values, and icons without footer descriptions;
  descriptions remain available on hover, including incomplete-data context.
  The total payment icon uses `₮`. The overdue-day card has no explanatory subtitle, and
  the shared filter panel is titled `Хайлт`.
- `Зөрчил арилгасан дүн` sums column I (`Нийт төлбөрийн дүн`) only for individual
  rows whose `Төлөв` is `Төлсөн` (trimmed, Unicode normalized, case insensitive).
  Shared dashboard filters apply. It is recalculated from the current Sheet,
  never incremented on polling, and does not include unpaid sibling loans of a CIF.
  Missing amounts are flagged; money is displayed in MNT. Historical snapshots
  preserve the amounts/status at capture time. This is not a lifetime payment ledger.
- `Төлөгдөж байгаа` is the positive net reduction of the sum of I for each
  normalized CIF from its highest saved compatible I total: max(highest I total -
  current I total, 0). A higher observed I total raises the persisted comparison
  amount. 5m -> 7m -> 6m is 0 -> 0 -> 1m; then 5m is 2m, and a rebound to 6.5m
  reduces it to 0.5m. It does not add successive deltas. L status does not affect it.
  Current shared CIF/overdue-day/search filters apply. Missing CIF/invalid amounts are
  excluded with a partial-total warning. Changes in loan membership (multiset of
  origination date, original amount, maturity date) require review instead of
  treating added/deleted/replaced loans as repayments. Reordering rows is safe.
- `sheet_payment_baselines` preserves first valid CIF totals per user and source,
  alongside `high_water_amount` / `high_water_at` for the highest comparison value.
  Initial setup uses that user's latest saved source snapshot where loan membership
  matches, otherwise the current valid source. No earlier history is backfilled as
  cumulative receipts. Existing rows initialize the comparison amount from the
  highest of the original, latest compatible saved source, and current valid value.
  The unique key preserves the original. The batch SECURITY INVOKER RPC
  `advance_sheet_payment_baselines` conditionally raises maxima under RLS; a trigger
  forbids lowering or clearing them. Concurrent sessions reread the persisted winner.
  Current progress and
  baseline metadata are embedded in snapshot JSON; old snapshots without progress
  show an unavailable indicator. A deleted CIF keeps its baseline and historical
  amounts but is absent from the current filtered KPI.
- Monetary values should be explicit about currency and use consistent Mongolian
  number formatting. Percentages and dates must use one consistent format.
- Never present placeholder, mock, or estimated values as live financial data.

## Visual language

- Style: calm, trustworthy, professional financial dashboard; information-rich
  without visual clutter.
- Typography: Geist Sans for interface text, main KPI numbers, and detailed source
  amounts. KPI values use regular weight to match the detailed list. Geist Mono
  remains for identifiers and other existing tabular numeric values.
- Primary color: deep teal/emerald (`--primary: oklch(0.47 0.12 170)`).
- Surfaces: white cards on a very light neutral/teal-tinted background, subtle
  borders, modest shadows, and approximately 10 px base corner radius.
- Standalone viewer exception: `/dashboard` intentionally uses a scoped dark
  charcoal, cobalt-accent presentation inspired by the internal m business
  dashboard. This visual treatment must remain isolated from the main `/overdue`
  workspace and must not introduce m business data or branding.
- Components: use the existing shadcn/ui and Radix-based components in
  `src/components/ui/`; use Lucide icons.
- Layout: responsive collapsible sidebar, sticky-style header treatment, broad
  dashboard canvas, and cards/tables that remain usable on mobile.
- Preserve the established design tokens in `src/app/globals.css`. Extend tokens
  instead of adding unrelated hard-coded color systems.
- Support accessible labels, keyboard use, focus states, sufficient contrast,
  loading states, empty states, and clear Mongolian error messages.

## Architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- `src/app/` — routes, layouts, route actions, and global styles.
- `src/components/` — shared app components; `src/components/ui/` contains the
  local shadcn/ui primitives.
- `src/features/` — feature-owned UI and business logic. New substantial
  modules belong here rather than in a single oversized page component.
- `src/features/workbook-data/` — Google Sheets row parsing, live client sync
  state, dashboard/history components, and CIF-based unique-customer analysis.
- `src/lib/supabase/` — browser client, server client, environment parsing, and
  session utilities.
- `src/app/api/google-sheets/overdue/` — authenticated server-side adapter. GET
  returns the latest published Supabase copy without contacting Google. Admin-only
  POST reads the full available column range from the configured Google Sheet using
  a server service account when configured, with user OAuth as a fallback, and
  publishes a new copy and immutable history snapshot only when `Үндсэн` changed.
  It never writes back to Google Sheets.
- `src/lib/sheet-payment-progress.ts` — initializes original CIF baselines, raises
  comparison maxima, and calculates progress on each authenticated Sheet read, before ETag and snapshot
  persistence. Baseline storage failure leaves the last good snapshot intact and
  shows the new KPI as unavailable, allowing the next poll to recover.
- `src/lib/google-sheets-service-account.ts` — server-only JWT exchange for the
  least-privilege Google Sheets read-only service account. Its credentials must
  exist only in local/Vercel environment settings.
- `src/app/api/google-sheets/history/` — authenticated, owner-scoped snapshot
  history list, detail, and all-history KPI aggregate API.
- `src/types/database.ts` — generated Supabase schema types, currently including
  `sheet_snapshot_history`.
- Use the `@/` import alias for code under `src/`.
- Prefer Server Components for page/data composition; add `"use client"` only
  where interactivity or browser APIs require it.

## Authentication and backend state

- Supabase is connected through environment variables. The browser must receive
  only the project URL and publishable/anon client key.
- Expected variables are `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the code temporarily accepts
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a compatibility fallback.
- Never commit `.env.local`, passwords, secret keys, or a Supabase
  `service_role` key. Never put privileged keys in a `NEXT_PUBLIC_` variable.
- The root proxy refreshes authentication cookies. Protected pages must verify
  server-side claims and redirect unauthenticated users to `/login`.
- Google Sheets access uses a short-lived, HTTP-only Google provider token. The
  token is deleted at sign-out and must never be logged, committed, returned to
  browser JavaScript, or treated as a durable database credential.
- The live overdue source may instead use
  `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL` and
  `GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY`. The target Sheet must be shared
  read-only with that account. Codex/ChatGPT Google Drive connector credentials
  are not application runtime credentials and must not be copied into the app.
- Application administrator access is stored in Supabase Auth
  `app_metadata.role`. The `/admin/users` route and its Edge Function both
  require the value `admin`; newly created accounts receive the `user` role.
  Never authorize privileged actions from client-side visibility alone.
- Protected dashboards and Google Sheets APIs validate the current user with
  Supabase Auth on each request so deleted or banned accounts do not retain
  application access through a locally valid JWT.
- The latest published Sheet copy is stored in the RLS-protected
  `sheet_current_state` table and is readable by authenticated users. Only an admin
  JWT may insert or update it. Published source snapshots are stored in
  `sheet_snapshot_history` only when `Үндсэн` changes; authenticated users may read
  them and only admins may insert them. The dashboard loads the database copy once
  on page load and performs no polling, focus, connectivity, morning, daytime, or
  evening refresh. Google is contacted only by an admin-only manual POST.
  The snapshot schema is managed by versioned migrations with least-privilege
  grants and generated `src/types/database.ts` types.
- `sheet_payment_baselines` is owner-scoped with RLS, SELECT/INSERT and column-level
  UPDATE only for high_water_amount/high_water_at. Original values and identity
  remain immutable to clients. No anonymous access or client DELETE grants.
  The composite primary key begins with user_id and spreadsheet_id for RLS reads.
- The legacy `loan_collection_actions` table and migration remain intact to preserve
  previously saved data. The application no longer reads or writes that table and
  exposes no collection editing controls. Current work fields come from the Sheet.
- Treat loan/customer/payment data as sensitive financial and personal data.
  Avoid logging it, exposing it to the client unnecessarily, or using real
  customer data as fixtures.
- Never place sensitive source data under `public/` or commit it to source control.

## Deployment

- The app is deployed under the Ontime team as the Vercel project `loan-npl`.
- Current production address: `https://loan-npl.vercel.app`.
- Supabase public environment variables must exist in every Vercel environment
  that is used (Production, Preview, and Development as applicable).
- Deployment URLs and protection settings can change; verify current Vercel
  state before reporting them as facts or sharing access links.

## Implementation rules for future AI work

1. Inspect the existing route, feature, and shared components before adding new
   ones; extend the current application instead of rebuilding it.
2. Keep all new user-visible text in natural Mongolian, including validation,
   loading, error, empty, and accessibility text.
3. Preserve the teal financial-dashboard theme and reuse existing components.
   Keep the documented `/dashboard` dark viewer theme scoped to that route.
4. Do not invent backend tables, fields, analytics definitions, or regulatory
   rules silently. Make domain assumptions explicit and encode agreed schema
   changes in migrations.
5. Do not weaken authentication, bypass email verification, disable RLS, or use
   client-side-only authorization for protected operations.
6. Keep secrets and administrator credentials out of source files,
   documentation, logs, screenshots, and test fixtures.
7. For Next.js behavior, first consult the matching local guide under
   `node_modules/next/dist/docs/` as required by the generated rule above.
8. After code changes, run the relevant checks: `pnpm lint`, `pnpm typecheck`,
   and `pnpm build`. For UI changes, also verify `/login`, `/`, mobile layout,
   authentication redirects, and browser console errors.
9. Update this file when routes, product terminology, architecture, data model,
   authorization, theme, or deployment identity materially changes.
