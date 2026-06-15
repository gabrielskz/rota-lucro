-- Execute este arquivo no SQL Editor do Supabase.
create table if not exists public.daily_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  gross_revenue numeric(12, 2) not null check (gross_revenue >= 0),
  kilometers numeric(10, 2) not null check (kilometers > 0),
  fuel_efficiency numeric(8, 2) not null check (fuel_efficiency > 0),
  fuel_price numeric(8, 3) not null check (fuel_price > 0),
  fuel_cost numeric(12, 2) not null check (fuel_cost >= 0),
  net_profit numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_entries_user_date_idx
  on public.daily_entries (user_id, entry_date desc);

alter table public.daily_entries enable row level security;

drop policy if exists "Users can read their own entries" on public.daily_entries;
create policy "Users can read their own entries"
  on public.daily_entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own entries" on public.daily_entries;
create policy "Users can create their own entries"
  on public.daily_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own entries" on public.daily_entries;
create policy "Users can update their own entries"
  on public.daily_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own entries" on public.daily_entries;
create policy "Users can delete their own entries"
  on public.daily_entries for delete
  using (auth.uid() = user_id);
