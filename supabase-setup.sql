-- Supabase setup for 此域｜報稅記帳簿
-- Run this in Supabase SQL Editor after creating a project.

create table if not exists public.taxbook_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.taxbook_records enable row level security;

drop policy if exists "taxbook select own" on public.taxbook_records;
drop policy if exists "taxbook insert own" on public.taxbook_records;
drop policy if exists "taxbook update own" on public.taxbook_records;
drop policy if exists "taxbook delete own" on public.taxbook_records;

create policy "taxbook select own"
on public.taxbook_records for select
to authenticated
using (auth.uid() = user_id);

create policy "taxbook insert own"
on public.taxbook_records for insert
to authenticated
with check (auth.uid() = user_id);

create policy "taxbook update own"
on public.taxbook_records for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "taxbook delete own"
on public.taxbook_records for delete
to authenticated
using (auth.uid() = user_id);

-- Create or keep a private Storage bucket for receipts.
-- If this insert is blocked by project permissions, create it in Dashboard:
-- Storage > New bucket > Name: receipts > Public bucket: OFF
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update
set public = false;

-- Storage object policies for private receipt files.
-- File paths are written as: user_id / entry_id / filename
-- Example: 00000000-0000-0000-0000-000000000000/entry-id/receipt.jpg

drop policy if exists "receipts select own" on storage.objects;
drop policy if exists "receipts insert own" on storage.objects;
drop policy if exists "receipts update own" on storage.objects;
drop policy if exists "receipts delete own" on storage.objects;

create policy "receipts select own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(string_to_array(name, '/'), 1) >= 3
);

create policy "receipts insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(string_to_array(name, '/'), 1) >= 3
);

create policy "receipts update own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(string_to_array(name, '/'), 1) >= 3
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(string_to_array(name, '/'), 1) >= 3
);

create policy "receipts delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
  and array_length(string_to_array(name, '/'), 1) >= 3
);
