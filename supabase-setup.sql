-- TaxBook v2 relational schema
-- Supabase is the source of truth; GitHub Pages is frontend only.
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ban text,
  tax_mode text not null default 'unknown' check (tax_mode in ('small','invoice','unknown')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','accountant','editor','viewer')),
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table if not exists public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null check (kind in ('income','expense','asset','transfer')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,code)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,name)
);

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'other' check (type in ('cash','bank','credit_card','wallet','platform','personal_advance','other')),
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,name)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  date date not null,
  kind text not null check (kind in ('income','expense','asset','transfer')),
  book_scope text not null default 'both' check (book_scope in ('both','tax','internal','review')),
  account_code text,
  account_name text,
  internal_tag text,
  voucher_type text,
  voucher_no text,
  counterparty text,
  counterparty_ban text,
  category text,
  payment_method text,
  project text,
  net_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2) not null default 0,
  tax_deductible text not null default 'review' check (tax_deductible in ('yes','no','review')),
  voucher_status text not null default 'review',
  cash_status text not null default 'paid' check (cash_status in ('paid','receivable','payable','deposit')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  file_name text not null,
  mime_type text,
  storage_path text not null,
  file_size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_cash_flows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null default 0,
  status text not null default 'paid' check (status in ('paid','receivable','payable','deposit')),
  due_date date,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_company_members_user on public.company_members(user_id,company_id);
create index if not exists idx_transactions_company_date on public.transactions(company_id,date desc) where deleted_at is null;
create index if not exists idx_transactions_updated on public.transactions(company_id,updated_at desc);
create index if not exists idx_attachments_transaction on public.attachments(transaction_id);
create index if not exists idx_cashflows_company on public.transaction_cash_flows(company_id,transaction_id);

-- updated_at triggers
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists trg_cash_accounts_updated_at on public.cash_accounts;
create trigger trg_cash_accounts_updated_at before update on public.cash_accounts for each row execute function public.set_updated_at();
drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
drop trigger if exists trg_cashflows_updated_at on public.transaction_cash_flows;
create trigger trg_cashflows_updated_at before update on public.transaction_cash_flows for each row execute function public.set_updated_at();

-- helper functions avoid recursive RLS checks
create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_members cm where cm.company_id=target_company and cm.user_id=auth.uid());
$$;

create or replace function public.can_edit_company(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_members cm where cm.company_id=target_company and cm.user_id=auth.uid() and cm.role in ('owner','admin','accountant','editor'));
$$;

create or replace function public.can_admin_company(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_members cm where cm.company_id=target_company and cm.user_id=auth.uid() and cm.role in ('owner','admin'));
$$;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.can_edit_company(uuid) to authenticated;
grant execute on function public.can_admin_company(uuid) to authenticated;

-- onboarding RPC: atomically create company, owner membership, defaults
create or replace function public.create_company_with_defaults(p_name text, p_ban text default null, p_tax_mode text default 'unknown')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_company uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.companies(name,ban,tax_mode,owner_user_id)
  values (trim(p_name),nullif(trim(p_ban),''),p_tax_mode,auth.uid()) returning id into v_company;
  insert into public.company_members(company_id,user_id,role) values(v_company,auth.uid(),'owner');
  insert into public.cash_accounts(company_id,name,type) values
    (v_company,'現金','cash'),(v_company,'銀行帳戶','bank'),(v_company,'信用卡','credit_card'),
    (v_company,'LINE Pay','wallet'),(v_company,'平台代收','platform'),(v_company,'私人代墊','personal_advance');
  insert into public.projects(company_id,name) values (v_company,'一般營運'),(v_company,'待分類');
  insert into public.accounting_accounts(company_id,code,name,kind,is_system) values
    (v_company,'4110','銷貨收入','income',true),(v_company,'4120','勞務收入／課程收入','income',true),
    (v_company,'4130','顧問／設計服務收入','income',true),(v_company,'4140','活動／企業合作收入','income',true),
    (v_company,'4190','其他營業收入','income',true),(v_company,'5110','進貨／原物料成本','expense',true),
    (v_company,'5120','包材／容器成本','expense',true),(v_company,'5130','課程材料成本','expense',true),
    (v_company,'5140','商品進貨成本','expense',true),(v_company,'5210','薪資支出／外包勞務','expense',true),
    (v_company,'5220','租金支出','expense',true),(v_company,'5230','水電瓦斯費','expense',true),
    (v_company,'5240','郵電費／網路費','expense',true),(v_company,'5250','文具用品／辦公費','expense',true),
    (v_company,'5260','旅費／交通費','expense',true),(v_company,'5270','運費','expense',true),
    (v_company,'5280','廣告行銷費','expense',true),(v_company,'5290','平台手續費／刷卡手續費','expense',true),
    (v_company,'5310','修繕費','expense',true),(v_company,'5320','保險費','expense',true),
    (v_company,'5330','稅捐／規費','expense',true),(v_company,'5340','交際費','expense',true),
    (v_company,'5350','訓練費／進修費','expense',true),(v_company,'5360','雜項購置','expense',true),
    (v_company,'5390','其他費用','expense',true),(v_company,'1410','存貨','asset',true),
    (v_company,'1510','生財器具／設備','asset',true),(v_company,'1520','租賃改良／裝修','asset',true),
    (v_company,'1910','押金／保證金','asset',true),(v_company,'1110','現金','transfer',true),
    (v_company,'1120','銀行存款','transfer',true),(v_company,'2180','業主往來／代墊','transfer',true),
    (v_company,'2190','其他應付／內部移轉','transfer',true);
  return v_company;
end;
$$;
grant execute on function public.create_company_with_defaults(text,text,text) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.projects enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.attachments enable row level security;
alter table public.transaction_cash_flows enable row level security;

-- remove v2 policies before recreating
DO $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and policyname like 'taxbook_v2_%' loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy "taxbook_v2_profiles_select" on public.profiles for select to authenticated using (id=auth.uid());
create policy "taxbook_v2_profiles_insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "taxbook_v2_profiles_update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy "taxbook_v2_companies_select" on public.companies for select to authenticated using (public.is_company_member(id));
create policy "taxbook_v2_companies_update" on public.companies for update to authenticated using (public.can_admin_company(id)) with check (public.can_admin_company(id));

create policy "taxbook_v2_members_select" on public.company_members for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_members_insert" on public.company_members for insert to authenticated with check (public.can_admin_company(company_id));
create policy "taxbook_v2_members_update" on public.company_members for update to authenticated using (public.can_admin_company(company_id)) with check (public.can_admin_company(company_id));
create policy "taxbook_v2_members_delete" on public.company_members for delete to authenticated using (public.can_admin_company(company_id));

create policy "taxbook_v2_accounts_select" on public.accounting_accounts for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_accounts_write" on public.accounting_accounts for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "taxbook_v2_projects_select" on public.projects for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_projects_write" on public.projects for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "taxbook_v2_cash_accounts_select" on public.cash_accounts for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_cash_accounts_write" on public.cash_accounts for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "taxbook_v2_transactions_select" on public.transactions for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_transactions_insert" on public.transactions for insert to authenticated with check (public.can_edit_company(company_id) and user_id=auth.uid());
create policy "taxbook_v2_transactions_update" on public.transactions for update to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "taxbook_v2_transactions_delete" on public.transactions for delete to authenticated using (public.can_admin_company(company_id));
create policy "taxbook_v2_attachments_select" on public.attachments for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_attachments_write" on public.attachments for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));
create policy "taxbook_v2_cashflows_select" on public.transaction_cash_flows for select to authenticated using (public.is_company_member(company_id));
create policy "taxbook_v2_cashflows_write" on public.transaction_cash_flows for all to authenticated using (public.can_edit_company(company_id)) with check (public.can_edit_company(company_id));

-- private receipt bucket
insert into storage.buckets(id,name,public) values('receipts','receipts',false)
on conflict(id) do update set public=false;

drop policy if exists "taxbook_v2_receipts_select" on storage.objects;
drop policy if exists "taxbook_v2_receipts_insert" on storage.objects;
drop policy if exists "taxbook_v2_receipts_update" on storage.objects;
drop policy if exists "taxbook_v2_receipts_delete" on storage.objects;

-- path: company_id/user_id/transaction_id/file_name
create policy "taxbook_v2_receipts_select" on storage.objects for select to authenticated using (
  bucket_id='receipts' and public.is_company_member(((storage.foldername(name))[1])::uuid)
);
create policy "taxbook_v2_receipts_insert" on storage.objects for insert to authenticated with check (
  bucket_id='receipts' and public.can_edit_company(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2]=auth.uid()::text
);
create policy "taxbook_v2_receipts_update" on storage.objects for update to authenticated using (
  bucket_id='receipts' and public.can_edit_company(((storage.foldername(name))[1])::uuid)
) with check (
  bucket_id='receipts' and public.can_edit_company(((storage.foldername(name))[1])::uuid)
  and (storage.foldername(name))[2]=auth.uid()::text
);
create policy "taxbook_v2_receipts_delete" on storage.objects for delete to authenticated using (
  bucket_id='receipts' and public.can_edit_company(((storage.foldername(name))[1])::uuid)
);

-- Keep old taxbook_records table untouched for manual migration/rollback.
-- Do not delete it until v2 data has been verified.
