create index sheet_current_state_updated_by_idx
  on public.sheet_current_state (updated_by);

drop policy "Admins can publish the sheet"
  on public.sheet_current_state;
drop policy "Admins can update the published sheet"
  on public.sheet_current_state;
drop policy "Admins can create published sheet history"
  on public.sheet_snapshot_history;

create policy "Admins can publish the sheet"
  on public.sheet_current_state
  for insert
  to authenticated
  with check (
    (select auth.uid()) = updated_by
    and coalesce(((select auth.jwt())->'app_metadata'->>'role'), '') = 'admin'
  );

create policy "Admins can update the published sheet"
  on public.sheet_current_state
  for update
  to authenticated
  using (coalesce(((select auth.jwt())->'app_metadata'->>'role'), '') = 'admin')
  with check (
    (select auth.uid()) = updated_by
    and coalesce(((select auth.jwt())->'app_metadata'->>'role'), '') = 'admin'
  );

create policy "Admins can create published sheet history"
  on public.sheet_snapshot_history
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt())->'app_metadata'->>'role'), '') = 'admin'
  );
