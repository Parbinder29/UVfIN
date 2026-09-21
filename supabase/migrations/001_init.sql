-- 001_init.sql
-- Core schema for UVfIN finance dashboard

-- Custom types
create type public.app_role as enum ('finance_manager', 'director');

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

-- Helper functions (security definer so RLS policies can call them safely)
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_finance_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'finance_manager' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_finance_access()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- MONEY SPENT (expenses)
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  category text not null,
  payee text not null,
  description text,
  payment_method text,
  reference_no text,
  attachment_path text,
  is_deleted boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- EARNINGS
create table public.earnings (
  id uuid primary key default gen_random_uuid(),
  earning_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  source text not null,
  client_name text,
  description text,
  payment_method text,
  reference_no text,
  attachment_path text,
  is_deleted boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INVESTORS (the "members")
create table public.investors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- INVESTMENTS (each row = one contribution by an investor)
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id),
  amount numeric(14,2) not null check (amount > 0),
  invested_at timestamptz not null default now(),
  payment_method text,
  reference_no text,
  notes text,
  is_deleted boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AUDIT LOG (written only by trigger, never by users)
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- Audit trigger function for tables with is_deleted column
create or replace function public.log_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    act := 'INSERT';
    insert into public.audit_log(table_name, record_id, action, new_data, changed_by)
    values (tg_table_name, new.id, act, to_jsonb(new), auth.uid());
    return new;
  else
    act := case when new.is_deleted is true and old.is_deleted is false then 'SOFT_DELETE' else 'UPDATE' end;
    insert into public.audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, new.id, act, to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  end if;
end $$;

-- Audit trigger function for investors table (uses is_active instead of is_deleted)
create or replace function public.log_changes_investors()
returns trigger language plpgsql security definer set search_path = public as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    act := 'INSERT';
    insert into public.audit_log(table_name, record_id, action, new_data, changed_by)
    values (tg_table_name, new.id, act, to_jsonb(new), auth.uid());
    return new;
  else
    act := case when new.is_active is false and old.is_active is true then 'SOFT_DELETE' else 'UPDATE' end;
    insert into public.audit_log(table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, new.id, act, to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  end if;
end $$;

-- Attach updated_at triggers
create trigger set_updated_at_expenses
  before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger set_updated_at_earnings
  before update on public.earnings
  for each row execute function public.set_updated_at();

create trigger set_updated_at_investors
  before update on public.investors
  for each row execute function public.set_updated_at();

create trigger set_updated_at_investments
  before update on public.investments
  for each row execute function public.set_updated_at();

-- Attach audit triggers
create trigger audit_expenses
  after insert or update on public.expenses
  for each row execute function public.log_changes();

create trigger audit_earnings
  after insert or update on public.earnings
  for each row execute function public.log_changes();

create trigger audit_investors
  after insert or update on public.investors
  for each row execute function public.log_changes_investors();

create trigger audit_investments
  after insert or update on public.investments
  for each row execute function public.log_changes();

-- Indexes for performance
create index idx_expenses_expense_date on public.expenses(expense_date);
create index idx_expenses_category on public.expenses(category);
create index idx_expenses_created_by on public.expenses(created_by);
create index idx_earnings_earning_date on public.earnings(earning_date);
create index idx_earnings_source on public.earnings(source);
create index idx_earnings_created_by on public.earnings(created_by);
create index idx_investors_is_active on public.investors(is_active);
create index idx_investments_investor_id on public.investments(investor_id);
create index idx_investments_invested_at on public.investments(invested_at);
create index idx_audit_log_changed_at on public.audit_log(changed_at desc);
create index idx_audit_log_table_record on public.audit_log(table_name, record_id);