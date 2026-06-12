-- Nadogradnja dugovanja poklopci — pokreni u Supabase SQL Editor
-- Delimična plaćanja + izmena cene/količine na rezervaciji

alter table public.poklopci_rezervacije add column if not exists cena_po_komadu numeric(10,2);

create table if not exists public.poklopci_dugovanja_avans (
  kome text primary key,
  iznos numeric(12,2) not null default 0
);

create table if not exists public.poklopci_dugovanja_uplate (
  id uuid primary key default gen_random_uuid(),
  kome text not null,
  iznos numeric(10,2) not null,
  napomena text,
  uneto_od text,
  datum timestamptz not null default now()
);

alter table public.poklopci_dugovanja_avans enable row level security;
alter table public.poklopci_dugovanja_uplate enable row level security;

drop policy if exists "poklopci_dug_avans_all" on public.poklopci_dugovanja_avans;
drop policy if exists "poklopci_dug_uplate_all" on public.poklopci_dugovanja_uplate;

create policy "poklopci_dug_avans_all" on public.poklopci_dugovanja_avans for all using (true) with check (true);
create policy "poklopci_dug_uplate_all" on public.poklopci_dugovanja_uplate for all using (true) with check (true);
