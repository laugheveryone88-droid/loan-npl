create table public.sheet_current_state (
  spreadsheet_id text primary key,
  spreadsheet_title text not null,
  snapshot_hash text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  row_count integer not null default 0 check (row_count >= 0),
  column_count integer not null default 0 check (column_count >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint sheet_current_state_hash_format check (snapshot_hash ~ '^[0-9a-f]{64}$')
);

alter table public.sheet_current_state enable row level security;

create policy "Authenticated users can read the published sheet"
  on public.sheet_current_state
  for select
  to authenticated
  using (true);

create policy "Admins can publish the sheet"
  on public.sheet_current_state
  for insert
  to authenticated
  with check (
    (select auth.uid()) = updated_by
    and coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  );

create policy "Admins can update the published sheet"
  on public.sheet_current_state
  for update
  to authenticated
  using (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin')
  with check (
    (select auth.uid()) = updated_by
    and coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  );

revoke all on table public.sheet_current_state from anon;
grant select, insert, update on table public.sheet_current_state to authenticated;
grant all on table public.sheet_current_state to service_role;

insert into public.sheet_current_state (
  spreadsheet_id,
  spreadsheet_title,
  snapshot_hash,
  payload,
  row_count,
  column_count,
  updated_at,
  updated_by
)
select
  spreadsheet_id,
  spreadsheet_title,
  snapshot_hash,
  payload,
  row_count,
  column_count,
  captured_at,
  user_id
from public.sheet_snapshot_history
where spreadsheet_id = '1NDDlNpouyiVPZrsmhS_3Mwkli1pjYIL7gyLpznN11G4'
  and captured_at = timestamptz '2026-09-04 17:21:17.303603+08'
  and payload->'sheets'->0->>'title' = 'Үндсэн'
order by id
limit 1;

delete from public.sheet_snapshot_history
where spreadsheet_id = '1NDDlNpouyiVPZrsmhS_3Mwkli1pjYIL7gyLpznN11G4'
  and exists (
    select 1
    from public.sheet_current_state
    where spreadsheet_id = '1NDDlNpouyiVPZrsmhS_3Mwkli1pjYIL7gyLpznN11G4'
  )
  and id <> coalesce((
    select id
    from public.sheet_snapshot_history
    where spreadsheet_id = '1NDDlNpouyiVPZrsmhS_3Mwkli1pjYIL7gyLpznN11G4'
      and captured_at = timestamptz '2026-09-04 17:21:17.303603+08'
      and payload->'sheets'->0->>'title' = 'Үндсэн'
    order by id
    limit 1
  ), id);

drop policy "Users can read their own sheet snapshots"
  on public.sheet_snapshot_history;
drop policy "Users can create their own sheet snapshots"
  on public.sheet_snapshot_history;

create policy "Authenticated users can read published sheet history"
  on public.sheet_snapshot_history
  for select
  to authenticated
  using (true);

create policy "Admins can create published sheet history"
  on public.sheet_snapshot_history
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin'
  );

create index sheet_snapshot_history_spreadsheet_captured_idx
  on public.sheet_snapshot_history (spreadsheet_id, captured_at desc, id desc);

create or replace function public.skip_consecutive_duplicate_sheet_snapshots()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  latest_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.spreadsheet_id, 0)
  );

  select history.snapshot_hash
  into latest_hash
  from public.sheet_snapshot_history as history
  where history.spreadsheet_id = new.spreadsheet_id
  order by history.captured_at desc, history.id desc
  limit 1;

  if latest_hash = new.snapshot_hash then
    return null;
  end if;

  return new;
end;
$$;
