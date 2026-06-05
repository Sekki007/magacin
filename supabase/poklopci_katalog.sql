-- Pokreni POSLE poklopci_schema.sql
-- Katalog modela i boja + kolona boja na artiklima

create table if not exists public.poklopci_modeli (
  id uuid primary key default gen_random_uuid(),
  naziv text unique not null,
  redosled integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.poklopci_boje (
  id uuid primary key default gen_random_uuid(),
  naziv text unique not null,
  redosled integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.poklopci_artikli add column if not exists boja text;

alter table public.poklopci_modeli enable row level security;
alter table public.poklopci_boje enable row level security;

create policy "poklopci_modeli_all" on public.poklopci_modeli for all using (true) with check (true);
create policy "poklopci_boje_all" on public.poklopci_boje for all using (true) with check (true);

-- Modeli iPhone 11 → 17 Pro Max
insert into public.poklopci_modeli (naziv, redosled) values
  ('iPhone 11', 10), ('iPhone 11 Pro', 11), ('iPhone 11 Pro Max', 12),
  ('iPhone 12 mini', 20), ('iPhone 12', 21), ('iPhone 12 Pro', 22), ('iPhone 12 Pro Max', 23),
  ('iPhone 13 mini', 30), ('iPhone 13', 31), ('iPhone 13 Pro', 32), ('iPhone 13 Pro Max', 33),
  ('iPhone 14', 40), ('iPhone 14 Plus', 41), ('iPhone 14 Pro', 42), ('iPhone 14 Pro Max', 43),
  ('iPhone 15', 50), ('iPhone 15 Plus', 51), ('iPhone 15 Pro', 52), ('iPhone 15 Pro Max', 53),
  ('iPhone 16', 60), ('iPhone 16 Plus', 61), ('iPhone 16 Pro', 62), ('iPhone 16 Pro Max', 63), ('iPhone 16e', 64),
  ('iPhone 17', 70), ('iPhone 17 Air', 71), ('iPhone 17 Pro', 72), ('iPhone 17 Pro Max', 73)
on conflict (naziv) do nothing;

-- Boje na tržištu
insert into public.poklopci_boje (naziv, redosled) values
  ('Crna', 1), ('Bela', 2), ('Transparentna', 3), ('Providna (mat)', 4),
  ('Plava', 10), ('Tamno plava', 11), ('Svetlo plava', 12), ('Morsko plava', 13),
  ('Crvena', 20), ('Tamno crvena', 21), ('Roze', 22), ('Svetlo roze', 23),
  ('Ljubičasta', 30), ('Deep Purple', 31),
  ('Zelena', 40), ('Tamno zelena', 41), ('Mint zelena', 42),
  ('Narandžasta', 50), ('Žuta', 51),
  ('Zlatna', 60), ('Srebrna', 61), ('Siva', 62), ('Tamno siva', 63), ('Grafit', 64),
  ('Bež', 70), ('Braon', 71), ('Champagne', 72), ('Tirkizna', 73),
  ('Midnight', 80), ('Starlight', 81),
  ('Natural Titanium', 90), ('Blue Titanium', 91), ('White Titanium', 92), ('Black Titanium', 93)
on conflict (naziv) do nothing;
