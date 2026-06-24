-- Run this in Supabase SQL Editor.
-- Then create a public/private storage bucket named: receipts

create extension if not exists "pgcrypto";

create table if not exists public.app_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

insert into public.app_sections (name, slug, sort_order)
values ('Receipts', 'receipts', 1), ('Cart', 'cart', 2)
on conflict (slug) do nothing;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  store_name text,
  receipt_date date,
  total numeric(10,2),
  payment_method text,
  notes text,
  source_type text default 'upload', -- upload, email, screenshot, pdf, manual
  file_path text,
  email_message_id text,
  raw_text text,
  parse_status text default 'not_parsed', -- not_parsed, pending, parsed, failed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid references public.receipts(id) on delete cascade,
  raw_name text,
  normalized_name text,
  quantity numeric default 1,
  unit_price numeric(10,2),
  total_price numeric(10,2),
  category text,
  confidence numeric,
  inventory_item_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.item_name_mappings (
  id uuid primary key default gen_random_uuid(),
  raw_name text not null,
  normalized_name text not null,
  category text,
  created_at timestamptz default now(),
  unique(raw_name)
);

alter table public.app_sections enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.item_name_mappings enable row level security;

-- For a private app, replace these policies with authenticated-user policies after login is added.
create policy "Allow public read sections" on public.app_sections for select using (true);
create policy "Allow public insert sections" on public.app_sections for insert with check (true);

create policy "Allow public read receipts" on public.receipts for select using (true);
create policy "Allow public insert receipts" on public.receipts for insert with check (true);
create policy "Allow public update receipts" on public.receipts for update using (true);

create policy "Allow public read receipt items" on public.receipt_items for select using (true);
create policy "Allow public insert receipt items" on public.receipt_items for insert with check (true);
create policy "Allow public update receipt items" on public.receipt_items for update using (true);

create policy "Allow public read mappings" on public.item_name_mappings for select using (true);
create policy "Allow public insert mappings" on public.item_name_mappings for insert with check (true);
create policy "Allow public update mappings" on public.item_name_mappings for update using (true);
