-- 004_hardening.sql
-- Security hardening and reporting helpers for UVfIN.
-- Safe to run after 001-003. Run it once, in the SQL editor, after 003_storage.sql.

-- ---------------------------------------------------------------------------
-- 1. Profiles: finance users may read every profile name (needed to show
--    "Added By" and "Who" columns). Nobody can write profiles through the API.
-- ---------------------------------------------------------------------------
drop policy if exists "read profiles: finance users" on public.profiles;
create policy "read profiles: finance users" on public.profiles
  for select to authenticated using (public.has_finance_access());

-- ---------------------------------------------------------------------------
-- 2. Table privileges (defence in depth on top of RLS).
--    - anon gets nothing at all.
--    - authenticated can never DELETE or TRUNCATE (TRUNCATE bypasses RLS).
--    - profiles and audit_log are read-only for authenticated.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update on public.profiles, public.audit_log from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke delete, truncate on tables from authenticated;

-- Functions: only signed-in users may call the RLS helpers. Trigger functions
-- are not callable by anyone through the API.
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_finance_manager() from public, anon;
revoke execute on function public.has_finance_access() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_finance_manager() to authenticated;
grant execute on function public.has_finance_access() to authenticated;
revoke execute on function public.log_changes() from public, anon, authenticated;
revoke execute on function public.log_changes_investors() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row integrity: the database, not the client, decides who created a row
--    and when. Soft-deleted rows are frozen.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_row_integrity()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := now();
    new.updated_at := now();
    if tg_table_name <> 'investors' then
      new.is_deleted := false;
    end if;
    return new;
  end if;

  -- UPDATE
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if tg_table_name <> 'investors' then
    if old.is_deleted then
      raise exception 'Deleted records cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.enforce_row_integrity() from public, anon, authenticated;

drop trigger if exists integrity_expenses on public.expenses;
create trigger integrity_expenses before insert or update on public.expenses
  for each row execute function public.enforce_row_integrity();
drop trigger if exists integrity_earnings on public.earnings;
create trigger integrity_earnings before insert or update on public.earnings
  for each row execute function public.enforce_row_integrity();
drop trigger if exists integrity_investors on public.investors;
create trigger integrity_investors before insert or update on public.investors
  for each row execute function public.enforce_row_integrity();
drop trigger if exists integrity_investments on public.investments;
create trigger integrity_investments before insert or update on public.investments
  for each row execute function public.enforce_row_integrity();

-- Contributions may only be recorded against active investors.
create or replace function public.check_investor_active()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.investor_id is not distinct from old.investor_id then
    return new;
  end if;
  if not exists (select 1 from public.investors where id = new.investor_id and is_active) then
    raise exception 'Investor is inactive or does not exist' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_investor_active() from public, anon, authenticated;

drop trigger if exists investments_active_investor on public.investments;
create trigger investments_active_investor
  before insert or update of investor_id on public.investments
  for each row execute function public.check_investor_active();

-- ---------------------------------------------------------------------------
-- 4. Size limits on free-text columns (keeps the free tier safe from abuse).
-- ---------------------------------------------------------------------------
alter table public.expenses
  add constraint expenses_category_len check (char_length(category) <= 100),
  add constraint expenses_payee_len check (char_length(payee) between 1 and 200),
  add constraint expenses_description_len check (char_length(description) <= 1000),
  add constraint expenses_payment_method_len check (char_length(payment_method) <= 50),
  add constraint expenses_reference_len check (char_length(reference_no) <= 100),
  add constraint expenses_attachment_len check (char_length(attachment_path) <= 300),
  add constraint expenses_amount_max check (amount < 1000000000000);

alter table public.earnings
  add constraint earnings_source_len check (char_length(source) <= 100),
  add constraint earnings_client_len check (char_length(client_name) <= 200),
  add constraint earnings_description_len check (char_length(description) <= 1000),
  add constraint earnings_payment_method_len check (char_length(payment_method) <= 50),
  add constraint earnings_reference_len check (char_length(reference_no) <= 100),
  add constraint earnings_attachment_len check (char_length(attachment_path) <= 300),
  add constraint earnings_amount_max check (amount < 1000000000000);

alter table public.investors
  add constraint investors_name_len check (char_length(full_name) between 1 and 200),
  add constraint investors_email_len check (char_length(email) <= 200),
  add constraint investors_phone_len check (char_length(phone) <= 30),
  add constraint investors_notes_len check (char_length(notes) <= 1000);

alter table public.investments
  add constraint investments_payment_method_len check (char_length(payment_method) <= 50),
  add constraint investments_reference_len check (char_length(reference_no) <= 100),
  add constraint investments_notes_len check (char_length(notes) <= 1000),
  add constraint investments_amount_max check (amount < 1000000000000);

-- Extra indexes for the list filters.
create index if not exists idx_expenses_live_date on public.expenses(expense_date desc) where not is_deleted;
create index if not exists idx_earnings_live_date on public.earnings(earning_date desc) where not is_deleted;
create index if not exists idx_investments_live_at on public.investments(invested_at desc) where not is_deleted;
create index if not exists idx_audit_log_changed_by on public.audit_log(changed_by);

-- ---------------------------------------------------------------------------
-- 5. Storage: receipts are evidence, so they can be added but never replaced
--    or removed through the API. Uploads must sit under expenses/ or earnings/.
-- ---------------------------------------------------------------------------
update storage.buckets
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
  where id = 'attachments';

drop policy if exists "update attachments: manager only" on storage.objects;
drop policy if exists "delete attachments: manager only" on storage.objects;
drop policy if exists "upload attachments: manager only" on storage.objects;
create policy "upload attachments: manager only" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and public.is_finance_manager()
    and (storage.foldername(name))[1] in ('expenses', 'earnings')
  );

-- ---------------------------------------------------------------------------
-- 6. Reporting helpers. All are SECURITY INVOKER, so RLS still applies:
--    a user without a profile gets zeros, never data.
-- ---------------------------------------------------------------------------

-- Investor list with totals.
create or replace view public.investor_summary
with (security_invoker = true) as
select
  i.id, i.full_name, i.email, i.phone, i.notes, i.is_active,
  i.created_by, i.created_at, i.updated_at,
  coalesce(sum(inv.amount) filter (where not inv.is_deleted), 0)::numeric(14,2) as total_invested,
  count(inv.id) filter (where not inv.is_deleted)::int as contribution_count,
  max(inv.invested_at) filter (where not inv.is_deleted) as last_invested_at
from public.investors i
left join public.investments inv on inv.investor_id = i.id
group by i.id;

revoke all on public.investor_summary from anon;
grant select on public.investor_summary to authenticated;

-- Totals for the filtered list views (same filters as the app's queries).
create or replace function public.filtered_total(
  p_table text,
  p_from date default null,
  p_to date default null,
  p_kind text default null,          -- category (expenses) / source (earnings)
  p_method text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_search text default null,
  p_investor uuid default null,
  p_tz text default 'Asia/Kolkata'
) returns numeric
language plpgsql stable security invoker set search_path = public as $$
declare
  result numeric;
  pattern text := case when p_search is null or p_search = '' then null else '%' || p_search || '%' end;
begin
  if p_table = 'expenses' then
    select coalesce(sum(amount), 0) into result from public.expenses e
    where not e.is_deleted
      and (p_from is null or e.expense_date >= p_from)
      and (p_to is null or e.expense_date <= p_to)
      and (p_kind is null or e.category = p_kind)
      and (p_method is null or e.payment_method = p_method)
      and (p_min is null or e.amount >= p_min)
      and (p_max is null or e.amount <= p_max)
      and (pattern is null or e.payee ilike pattern or e.description ilike pattern or e.reference_no ilike pattern);
  elsif p_table = 'earnings' then
    select coalesce(sum(amount), 0) into result from public.earnings e
    where not e.is_deleted
      and (p_from is null or e.earning_date >= p_from)
      and (p_to is null or e.earning_date <= p_to)
      and (p_kind is null or e.source = p_kind)
      and (p_method is null or e.payment_method = p_method)
      and (p_min is null or e.amount >= p_min)
      and (p_max is null or e.amount <= p_max)
      and (pattern is null or e.client_name ilike pattern or e.description ilike pattern or e.reference_no ilike pattern);
  elsif p_table = 'investments' then
    select coalesce(sum(amount), 0) into result from public.investments e
    where not e.is_deleted
      and (p_from is null or (e.invested_at at time zone p_tz)::date >= p_from)
      and (p_to is null or (e.invested_at at time zone p_tz)::date <= p_to)
      and (p_investor is null or e.investor_id = p_investor)
      and (p_method is null or e.payment_method = p_method)
      and (p_min is null or e.amount >= p_min)
      and (p_max is null or e.amount <= p_max)
      and (pattern is null or e.reference_no ilike pattern or e.notes ilike pattern);
  else
    raise exception 'Unknown table';
  end if;
  return result;
end $$;

revoke execute on function public.filtered_total(text, date, date, text, text, numeric, numeric, text, uuid, text) from public, anon;
grant execute on function public.filtered_total(text, date, date, text, text, numeric, numeric, text, uuid, text) to authenticated;

-- Everything the dashboard needs, in one round trip.
create or replace function public.dashboard_summary(
  p_from date default null,
  p_to date default null,
  p_tz text default 'Asia/Kolkata'
) returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  bounds as (
    select date_trunc('month', (now() at time zone p_tz))::date as month_start,
           (date_trunc('month', (now() at time zone p_tz)) + interval '1 month - 1 day')::date as month_end
  ),
  ex as (
    select expense_date as d, amount, category from public.expenses
    where not is_deleted
      and (p_from is null or expense_date >= p_from)
      and (p_to is null or expense_date <= p_to)
  ),
  ea as (
    select earning_date as d, amount, source from public.earnings
    where not is_deleted
      and (p_from is null or earning_date >= p_from)
      and (p_to is null or earning_date <= p_to)
  ),
  iv as (
    select (invested_at at time zone p_tz)::date as d, amount from public.investments
    where not is_deleted
      and (p_from is null or (invested_at at time zone p_tz)::date >= p_from)
      and (p_to is null or (invested_at at time zone p_tz)::date <= p_to)
  ),
  months as (
    select to_char(d, 'YYYY-MM') as m, sum(amount) filter (where kind = 'earning') as earnings,
           sum(amount) filter (where kind = 'expense') as spent,
           sum(amount) filter (where kind = 'investment') as invested
    from (
      select d, amount, 'expense' as kind from ex
      union all select d, amount, 'earning' from ea
      union all select d, amount, 'investment' from iv
    ) t
    group by 1
  )
  select jsonb_build_object(
    'total_earnings', (select coalesce(sum(amount), 0) from ea),
    'total_spent', (select coalesce(sum(amount), 0) from ex),
    'total_invested', (select coalesce(sum(amount), 0) from iv),
    'month_earnings', (select coalesce(sum(amount), 0) from public.earnings, bounds
                        where not is_deleted and earning_date between month_start and month_end),
    'month_spent', (select coalesce(sum(amount), 0) from public.expenses, bounds
                        where not is_deleted and expense_date between month_start and month_end),
    'month_invested', (select coalesce(sum(amount), 0) from public.investments, bounds
                        where not is_deleted and (invested_at at time zone p_tz)::date between month_start and month_end),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', category, 'value', total) order by total desc)
                     from (select category, sum(amount) as total from ex group by category) c), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('name', source, 'value', total) order by total desc)
                     from (select source, sum(amount) as total from ea group by source) s), '[]'::jsonb),
    'by_month', coalesce((select jsonb_agg(jsonb_build_object(
                     'month', m,
                     'earnings', coalesce(earnings, 0),
                     'spent', coalesce(spent, 0),
                     'invested', coalesce(invested, 0)) order by m)
                   from months), '[]'::jsonb)
  )
$$;

revoke execute on function public.dashboard_summary(date, date, text) from public, anon;
grant execute on function public.dashboard_summary(date, date, text) to authenticated;
