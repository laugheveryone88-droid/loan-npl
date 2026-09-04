create table public.loan_collection_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id text not null,
  source_sheet text not null,
  source_row integer not null check (source_row >= 2),
  action_date date,
  status text check (
    status is null or status in (
      'Холбогдох боломжгүй',
      'Төлөхөө амласан',
      'Хэсэгчлэн төлнө',
      'Төлсөн'
    )
  ),
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_collection_actions_user_record_unique unique (user_id, record_id)
);

alter table public.loan_collection_actions enable row level security;

create policy "Users can read their own loan collection actions"
  on public.loan_collection_actions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own loan collection actions"
  on public.loan_collection_actions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own loan collection actions"
  on public.loan_collection_actions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.loan_collection_actions from anon, authenticated;
grant select, insert, update on table public.loan_collection_actions to authenticated;
grant all on table public.loan_collection_actions to service_role;
grant usage, select on sequence public.loan_collection_actions_id_seq to authenticated;
grant all on sequence public.loan_collection_actions_id_seq to service_role;
