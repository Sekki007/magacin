-- Poklopci modul — nezavisne tabele od glavnog magacina
-- Pokreni u Supabase SQL Editor

create table if not exists public.poklopci_artikli (
  id uuid primary key default gen_random_uuid(),
  naziv text not null,
  model text,
  kolicina integer not null default 0,
  nabavna_cena numeric(10,2) not null default 0,
  prodajna_cena numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.poklopci_rezervacije (
  id uuid primary key default gen_random_uuid(),
  artikal_id uuid not null references public.poklopci_artikli(id) on delete restrict,
  kolicina integer not null,
  kome text not null,
  napomena text,
  datum_rezervacije timestamptz not null default now(),
  razduzeno boolean not null default false
);

create table if not exists public.poklopci_prodaje (
  id uuid primary key default gen_random_uuid(),
  artikal_id uuid not null references public.poklopci_artikli(id) on delete restrict,
  kolicina_prodato integer not null,
  cena_po_komadu numeric(10,2) not null,
  ukupna_zarada numeric(10,2) not null,
  prodavac_username text,
  datum timestamptz not null default now()
);

create table if not exists public.poklopci_kasa (
  id integer primary key default 1,
  stanje_zarada numeric(12,2) not null default 0,
  constraint poklopci_kasa_single_row check (id = 1)
);

insert into public.poklopci_kasa (id, stanje_zarada)
values (1, 0)
on conflict (id) do nothing;

-- Dozvoli pristup aplikaciji (prilagodi ako koristiš RLS na ostalim tabelama)
alter table public.poklopci_artikli enable row level security;
alter table public.poklopci_rezervacije enable row level security;
alter table public.poklopci_prodaje enable row level security;
alter table public.poklopci_kasa enable row level security;

create policy "poklopci_artikli_all" on public.poklopci_artikli for all using (true) with check (true);
create policy "poklopci_rezervacije_all" on public.poklopci_rezervacije for all using (true) with check (true);
create policy "poklopci_prodaje_all" on public.poklopci_prodaje for all using (true) with check (true);
create policy "poklopci_kasa_all" on public.poklopci_kasa for all using (true) with check (true);
