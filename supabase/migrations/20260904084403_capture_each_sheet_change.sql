alter table public.sheet_snapshot_history
  drop constraint sheet_snapshot_history_owner_hash_unique;

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
    pg_catalog.hashtextextended(new.user_id::text || ':' || new.spreadsheet_id, 0)
  );

  select history.snapshot_hash
  into latest_hash
  from public.sheet_snapshot_history as history
  where history.user_id = new.user_id
    and history.spreadsheet_id = new.spreadsheet_id
  order by history.captured_at desc, history.id desc
  limit 1;

  if latest_hash = new.snapshot_hash then
    return null;
  end if;

  return new;
end;
$$;

revoke execute on function public.skip_consecutive_duplicate_sheet_snapshots() from public, anon, authenticated;

create trigger skip_consecutive_duplicate_sheet_snapshots
before insert on public.sheet_snapshot_history
for each row
execute function public.skip_consecutive_duplicate_sheet_snapshots();
