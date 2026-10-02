-- 005_search_path.sql
-- Pin the search_path of the last function that didn't have one, so it can't
-- be pointed at look-alike objects. Clears Supabase's Security Advisor warning
-- "Function Search Path Mutable". Safe to run more than once.

alter function public.set_updated_at() set search_path = public;
