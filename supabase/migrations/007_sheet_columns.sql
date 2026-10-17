-- 007: Money Spent gets the remaining columns of the company's accounts sheet.
--   Paid By        -> paid_by    (who paid, e.g. Vinay)
--   Credit Ledger  -> paid_from  (where the money came from, e.g. Bank - UPI Wallet)
--   Status         -> status     (e.g. Existing, New - Provisional)
-- (Item / Party, Date, Amount, Paid Via, Debit Ledger and Note already exist as
-- payee, expense_date, amount, payment_method, category and description.)
--
-- Run once in the Supabase SQL Editor. Safe to run again.

alter table public.expenses add column if not exists paid_by text;
alter table public.expenses add column if not exists paid_from text;
alter table public.expenses add column if not exists status text;

alter table public.expenses drop constraint if exists expenses_paid_by_len;
alter table public.expenses add constraint expenses_paid_by_len check (char_length(paid_by) <= 100);
alter table public.expenses drop constraint if exists expenses_paid_from_len;
alter table public.expenses add constraint expenses_paid_from_len check (char_length(paid_from) <= 200);
alter table public.expenses drop constraint if exists expenses_status_len;
alter table public.expenses add constraint expenses_status_len check (char_length(status) <= 50);
