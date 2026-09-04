create table public.sheet_snapshot_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_title text not null,
  snapshot_hash text not null,
  captured_at timestamptz not null default now(),
  row_count integer not null default 0 check (row_count >= 0),
  column_count integer not null default 0 check (column_count >= 0),
  change_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(change_summary) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  constraint sheet_snapshot_history_hash_format check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint sheet_snapshot_history_owner_hash_unique unique (user_id, spreadsheet_id, snapshot_hash)
);

create index sheet_snapshot_history_user_captured_idx
  on public.sheet_snapshot_history (user_id, captured_at desc);

alter table public.sheet_snapshot_history enable row level security;

create policy "Users can read their own sheet snapshots"
  on public.sheet_snapshot_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own sheet snapshots"
  on public.sheet_snapshot_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.sheet_snapshot_history from anon;
grant select, insert on table public.sheet_snapshot_history to authenticated;
grant all on table public.sheet_snapshot_history to service_role;
grant usage, select on sequence public.sheet_snapshot_history_id_seq to authenticated;
grant all on sequence public.sheet_snapshot_history_id_seq to service_role;
