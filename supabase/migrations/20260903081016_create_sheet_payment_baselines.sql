-- One immutable starting balance per owner, sheet, and normalized CIF.
create table public.sheet_payment_baselines (
  user_id uuid not null references auth.users(id) on delete cascade,
  spreadsheet_id text not null,
  customer_cif text not null check (length(customer_cif) > 0),
  baseline_amount numeric(20, 2) not null check (baseline_amount >= 0),
  loan_signature text not null,
  baseline_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, spreadsheet_id, customer_cif)
);

alter table public.sheet_payment_baselines enable row level security;

create policy "Users read their own payment baselines"
  on public.sheet_payment_baselines for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users establish their own payment baselines"
  on public.sheet_payment_baselines for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.sheet_payment_baselines from anon, authenticated;
grant select, insert on public.sheet_payment_baselines to authenticated;
grant all on public.sheet_payment_baselines to service_role;

comment on table public.sheet_payment_baselines is
  'Immutable initial CIF totals for calculating net column-I reductions; not a transaction ledger.';
