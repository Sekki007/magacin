-- Nadogradnja dugovanja — pokreni u Supabase SQL Editor
-- 1) Cena po komadu na rezervaciji (izmena u modulu dugovanja)
-- 2) Delimična plaćanja (avans koji umanjuje preostali dug)

alter table public.rezervacije add column if not exists cena_po_komadu numeric(10,2);

create table if not exists public.dugovanja_avans (
  kome text primary key,
  iznos numeric(12,2) not null default 0
);

create table if not exists public.dugovanja_uplate (
  id uuid primary key default gen_random_uuid(),
  kome text not null,
  iznos numeric(10,2) not null,
  napomena text,
  uneto_od text,
  datum timestamptz not null default now()
);

alter table public.dugovanja_avans enable row level security;
alter table public.dugovanja_uplate enable row level security;

drop policy if exists "dugovanja_avans_all" on public.dugovanja_avans;
drop policy if exists "dugovanja_uplate_all" on public.dugovanja_uplate;

create policy "dugovanja_avans_all" on public.dugovanja_avans for all using (true) with check (true);
create policy "dugovanja_uplate_all" on public.dugovanja_uplate for all using (true) with check (true);
