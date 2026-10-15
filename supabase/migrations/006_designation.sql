-- 006: a job title ("designation") for each user, shown in the dashboard.
--
-- It is a label only. What a person can do still comes from `role`:
--   finance_manager = can add, edit, import and delete
--   director        = view only
-- e.g. an Owner or Admin is a finance_manager, an Investor is a director.
--
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.profiles add column if not exists designation text;

alter table public.profiles drop constraint if exists profiles_designation_check;
alter table public.profiles add constraint profiles_designation_check
  check (designation is null or char_length(designation) between 1 and 60);

-- Existing users get the title that matches their role.
update public.profiles
set designation = case role when 'finance_manager' then 'Finance Manager' else 'Director' end
where designation is null;
