-- =============================================================================
-- UVfIN: managing who can sign in
-- =============================================================================
-- Copy ONE section at a time into Supabase → SQL Editor → New query, change
-- the values marked  <-- , and click Run.
--
-- Two things decide what a person gets:
--   role         what they can DO
--                  'finance_manager' = add, edit, import and delete entries
--                  'director'        = view only
--   designation  their title, shown in the dashboard (any text, max 60 chars)
--
-- Common combinations:
--   Owner / Admin    → role 'finance_manager', designation 'Owner' or 'Admin'
--   Finance Manager  → role 'finance_manager', designation 'Finance Manager'
--   Director         → role 'director',        designation 'Director'
--   Investor         → role 'director',        designation 'Investor'
-- View-only users can see ALL figures, including every investor's contributions.
--
-- Needs migration 006_designation.sql to have been run once.
--
-- !! Never save a real password in this file or commit it to GitHub. Type it
--    into the SQL Editor only, then clear the query tab after running it.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. ADD A NEW USER (or, if the email already exists, reset their password)
-- -----------------------------------------------------------------------------
do $$
declare
  v_email       text := 'newperson@example.com';      -- <-- their email
  v_password    text := 'Change-Me-Strong-Pass1!';    -- <-- at least 12 characters
  v_name        text := 'Full Name';                  -- <-- shown as "Added By"
  v_role        public.app_role := 'finance_manager'; -- <-- 'finance_manager' or 'director'
  v_designation text := 'Finance Manager';            -- <-- e.g. Owner, Admin, Investor
  v_id          uuid;
begin
  v_email := lower(trim(v_email));
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_name), now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );

    raise notice 'Created account for %', v_email;
  else
    update auth.users
    set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_id;

    raise notice 'Account already existed. Password reset for %', v_email;
  end if;

  insert into public.profiles (id, full_name, role, designation)
  values (v_id, v_name, v_role, v_designation)
  on conflict (id) do update
    set full_name = excluded.full_name, role = excluded.role, designation = excluded.designation;
end $$;


-- -----------------------------------------------------------------------------
-- 2. MAKE SOMEONE OWNER / ADMIN  (full access)
-- -----------------------------------------------------------------------------
update public.profiles
set role = 'finance_manager', designation = 'Owner'           -- <-- or 'Admin'
where id = (select id from auth.users where email = 'person@example.com');  -- <-- their email


-- -----------------------------------------------------------------------------
-- 3. MAKE SOMEONE FINANCE MANAGER  (can add, edit, import and delete)
-- -----------------------------------------------------------------------------
update public.profiles
set role = 'finance_manager', designation = 'Finance Manager'
where id = (select id from auth.users where email = 'person@example.com');  -- <-- their email


-- -----------------------------------------------------------------------------
-- 4. MAKE SOMEONE VIEW ONLY  (Investor, Director, Auditor …)
-- -----------------------------------------------------------------------------
update public.profiles
set role = 'director', designation = 'Investor'              -- <-- or 'Director', 'Auditor' …
where id = (select id from auth.users where email = 'person@example.com');  -- <-- their email


-- -----------------------------------------------------------------------------
-- 5. CHANGE SOMEONE'S PASSWORD
-- -----------------------------------------------------------------------------
update auth.users
set encrypted_password = extensions.crypt('New-Strong-Pass1!', extensions.gen_salt('bf')),  -- <-- new password
    updated_at = now()
where email = 'person@example.com';                           -- <-- their email


-- -----------------------------------------------------------------------------
-- 6. LIST EVERYONE AND WHAT THEY CAN DO
-- -----------------------------------------------------------------------------
select u.email,
       p.full_name,
       p.designation,
       case p.role when 'finance_manager' then 'Can edit' when 'director' then 'View only' else 'NO ACCESS' end as access,
       u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
order by p.role nulls last, p.full_name;


-- -----------------------------------------------------------------------------
-- 7. REMOVE SOMEONE'S ACCESS  (they can still sign in but see "No access yet"
--    and no data; entries they added stay, but "Added By" shows a dash)
-- -----------------------------------------------------------------------------
delete from public.profiles
where id = (select id from auth.users where email = 'person@example.com');  -- <-- their email
