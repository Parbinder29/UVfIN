-- supabase/seed.sql
-- Template for creating the 3 user profiles after auth users are created in Supabase dashboard
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > Authentication > Users > "Add user"
-- 2. Create 3 users with email/password, tick "Auto confirm user"
-- 3. Copy each user's UUID from the auth.users table
-- 4. Replace the placeholder UUIDs below with the actual UUIDs
-- 5. Run this script in Supabase SQL Editor

-- Finance Manager 1
-- insert into public.profiles (id, full_name, role)
-- values (
--   '<FINANCE_MANAGER_1_AUTH_UUID>',
--   'Finance Manager 1',
--   'finance_manager'
-- );

-- Finance Manager 2
-- insert into public.profiles (id, full_name, role)
-- values (
--   '<FINANCE_MANAGER_2_AUTH_UUID>',
--   'Finance Manager 2',
--   'finance_manager'
-- );

-- Director
-- insert into public.profiles (id, full_name, role)
-- values (
--   '<DIRECTOR_AUTH_UUID>',
--   'Director Name',
--   'director'
-- );

-- Optional: Sample categories for expenses (for reference)
-- These are defined in the app constants, not in the database
-- Salaries, Rent, Utilities, Marketing, Software & Tools, Travel, Office Supplies, Taxes, Vendor Payments, Maintenance, Miscellaneous

-- Optional: Sample sources for earnings (for reference)
-- Product Sales, Services, Client Projects, Commissions, Interest, Other