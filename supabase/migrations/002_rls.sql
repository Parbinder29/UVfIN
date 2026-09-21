-- 002_rls.sql
-- Row Level Security policies for UVfIN

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.earnings enable row level security;
alter table public.investors enable row level security;
alter table public.investments enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: users can read their own profile
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Expenses policies
create policy "read expenses: manager+director" on public.expenses
  for select to authenticated using (public.has_finance_access());

create policy "insert expenses: manager only" on public.expenses
  for insert to authenticated with check (public.is_finance_manager());

create policy "update expenses: manager only" on public.expenses
  for update to authenticated using (public.is_finance_manager())
  with check (public.is_finance_manager());

-- Earnings policies
create policy "read earnings: manager+director" on public.earnings
  for select to authenticated using (public.has_finance_access());

create policy "insert earnings: manager only" on public.earnings
  for insert to authenticated with check (public.is_finance_manager());

create policy "update earnings: manager only" on public.earnings
  for update to authenticated using (public.is_finance_manager())
  with check (public.is_finance_manager());

-- Investors policies
create policy "read investors: manager+director" on public.investors
  for select to authenticated using (public.has_finance_access());

create policy "insert investors: manager only" on public.investors
  for insert to authenticated with check (public.is_finance_manager());

create policy "update investors: manager only" on public.investors
  for update to authenticated using (public.is_finance_manager())
  with check (public.is_finance_manager());

-- Investments policies
create policy "read investments: manager+director" on public.investments
  for select to authenticated using (public.has_finance_access());

create policy "insert investments: manager only" on public.investments
  for insert to authenticated with check (public.is_finance_manager());

create policy "update investments: manager only" on public.investments
  for update to authenticated using (public.is_finance_manager())
  with check (public.is_finance_manager());

-- Audit log: read-only for both roles
create policy "read audit: manager+director" on public.audit_log
  for select to authenticated using (public.has_finance_access());

-- No insert/update/delete policies on audit_log (append-only via triggers)