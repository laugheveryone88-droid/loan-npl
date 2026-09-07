alter table public.sheet_current_state
  drop constraint sheet_current_state_updated_by_fkey;

alter table public.sheet_current_state
  alter column updated_by drop not null;

alter table public.sheet_current_state
  add constraint sheet_current_state_updated_by_fkey
  foreign key (updated_by)
  references auth.users(id)
  on delete set null;
