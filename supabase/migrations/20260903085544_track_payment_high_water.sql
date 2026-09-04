-- Preserve the original amount while allowing the comparison amount to rise.
alter table public.sheet_payment_baselines
  add column high_water_amount numeric(20, 2),
  add column high_water_at timestamptz,
  add constraint payment_high_water_valid check (
    (high_water_amount is null and high_water_at is null)
    or (high_water_amount is not null and high_water_at is not null
      and high_water_amount >= baseline_amount
      and high_water_amount <= 90071992547409.91
      and isfinite(high_water_at))
  );

-- Column grants retain the immutability of the original baseline and identity.
grant update (high_water_amount, high_water_at)
  on public.sheet_payment_baselines to authenticated;

create policy "Users raise their own payment comparison amounts"
  on public.sheet_payment_baselines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.guard_payment_high_water()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if old.high_water_amount is not null and (
    new.high_water_amount is null
    or new.high_water_amount < old.high_water_amount
    or (new.high_water_amount = old.high_water_amount
      and new.high_water_at is distinct from old.high_water_at)
  ) then
    raise exception 'Payment comparison amount cannot be reduced or reset.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_payment_high_water() from public, anon, authenticated;
create trigger guard_payment_high_water
  before update of high_water_amount, high_water_at on public.sheet_payment_baselines
  for each row execute function public.guard_payment_high_water();

-- Batch updates run with the caller's RLS and column permissions. Conditional
-- updates recheck the stored maximum after row locks, so retries and concurrent
-- lower observations cannot overwrite a higher value.
create function public.advance_sheet_payment_baselines(
  p_spreadsheet_id text,
  p_observations jsonb
)
returns void
language sql security invoker set search_path = ''
as $$
  with observations as (
    select distinct on (o.customer_cif, o.loan_signature)
      o.customer_cif, o.loan_signature, round(o.amount, 2) as amount, o.observed_at
    from jsonb_to_recordset(p_observations) as o(
      customer_cif text, loan_signature text, amount numeric, observed_at timestamptz
    )
    where o.amount >= 0 and o.amount <= 90071992547409.91
      and o.observed_at is not null and isfinite(o.observed_at)
    order by o.customer_cif, o.loan_signature, o.amount desc, o.observed_at
  )
  update public.sheet_payment_baselines as b
  set high_water_amount = greatest(b.baseline_amount, o.amount),
      high_water_at = case when o.amount > b.baseline_amount
        then o.observed_at else b.baseline_at end
  from observations as o
  where b.user_id = (select auth.uid())
    and b.spreadsheet_id = p_spreadsheet_id
    and b.customer_cif = o.customer_cif
    and b.loan_signature = o.loan_signature
    and (b.high_water_amount is null or o.amount > b.high_water_amount);
$$;

revoke all on function public.advance_sheet_payment_baselines(text, jsonb) from public, anon;
grant execute on function public.advance_sheet_payment_baselines(text, jsonb) to authenticated;

comment on table public.sheet_payment_baselines is
  'Original CIF totals plus monotonic comparison maxima for net column-I reductions; not a transaction ledger.';
