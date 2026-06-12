-- Prijem robe (ulaz u magacin) — pokreni u Supabase SQL Editor

create table if not exists public.prijemi (
  id uuid primary key default gen_random_uuid(),
  artikal_id uuid not null references public.artikli(id) on delete restrict,
  kolicina integer not null check (kolicina > 0),
  cena_po_komadu numeric(10,2) not null default 0,
  dobavljac text,
  napomena text,
  uneto_od text,
  datum timestamptz not null default now()
);

create index if not exists prijemi_artikal_id_idx on public.prijemi(artikal_id);
create index if not exists prijemi_datum_idx on public.prijemi(datum desc);

alter table public.prijemi enable row level security;

drop policy if exists "prijemi_all" on public.prijemi;
create policy "prijemi_all" on public.prijemi for all using (true) with check (true);
