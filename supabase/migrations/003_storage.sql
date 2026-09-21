-- 003_storage.sql
-- Supabase Storage bucket and policies for attachments

-- Create private attachments bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Policies for attachments bucket
-- Both roles can read (view/download) attachments
create policy "read attachments: manager+director" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments' and
    public.has_finance_access()
  );

-- Only finance_manager can upload attachments
create policy "upload attachments: manager only" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments' and
    public.is_finance_manager()
  );

-- Only finance_manager can update attachments (replace)
create policy "update attachments: manager only" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments' and
    public.is_finance_manager()
  )
  with check (
    bucket_id = 'attachments' and
    public.is_finance_manager()
  );

-- Only finance_manager can delete attachments
create policy "delete attachments: manager only" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments' and
    public.is_finance_manager()
  );