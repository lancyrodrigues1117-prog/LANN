-- Run this once in the Supabase SQL editor, then set the two NEXT_PUBLIC_
-- variables in Vercel. The app switches over on the next deploy.

create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  ref          text        not null default '',
  customer     text        not null default '',
  salesperson  text        not null default '',
  notes        text        not null default '',
  target       numeric     not null default 70,
  target_mode  text        not null default 'margin',
  lines        jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists quotes_updated_at_idx on public.quotes (updated_at desc);
create index if not exists quotes_customer_idx   on public.quotes (customer);

alter table public.quotes enable row level security;

-- WARNING, READ THIS BEFORE YOU GO LIVE
-- These policies let anyone holding the anon key read and write every quote,
-- and the anon key ships to the browser. That is fine while the app is behind a
-- Vercel preview URL you keep to yourself. Before real use, add Supabase Auth
-- and replace the four policies below with ones scoped to auth.uid().
drop policy if exists quotes_anon_select on public.quotes;
drop policy if exists quotes_anon_insert on public.quotes;
drop policy if exists quotes_anon_update on public.quotes;
drop policy if exists quotes_anon_delete on public.quotes;

create policy quotes_anon_select on public.quotes for select using (true);
create policy quotes_anon_insert on public.quotes for insert with check (true);
create policy quotes_anon_update on public.quotes for update using (true);
create policy quotes_anon_delete on public.quotes for delete using (true);
