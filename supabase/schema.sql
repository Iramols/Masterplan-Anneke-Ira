-- Masterplan Anneke & Ira -- cloud schema
-- Eenmalig uitvoeren in de SQL Editor van het (nieuwe) Supabase-project.
-- Daarna de Project URL + anon key invullen in js/supabase-config.js.

-- ========== MASTERPLAN_DATA ==========
-- Eén rij per onderdeel (key/value met JSON): 'einddoel', 'masterplan',
-- 'deelplannen', 'acties'. Ira en Anneke loggen allebei in met hetzelfde
-- gedeelde account en zien/bewerken dezelfde data.
create table if not exists masterplan_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text default ''
);

alter table masterplan_data enable row level security;

-- Elke ingelogde gebruiker (alleen Ira & Anneke hebben een account) mag
-- alles lezen en schrijven -- het is gedeelde data, geen privé per account.
create policy "masterplan_data: ingelogd leest alles" on masterplan_data
  for select using (auth.uid() is not null);

create policy "masterplan_data: ingelogd voegt toe" on masterplan_data
  for insert with check (auth.uid() is not null);

create policy "masterplan_data: ingelogd werkt bij" on masterplan_data
  for update using (auth.uid() is not null);

-- RLS-policies bepalen WELKE rijen een rol mag zien/wijzigen, maar de rol
-- heeft ook simpelweg het basisrecht (GRANT) nodig om INSERT/UPDATE/DELETE
-- op de tabel uit te mogen voeren -- zonder dit geeft Postgres "permission
-- denied for table" nog vóór de policies iets bekijken.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table masterplan_data to authenticated;

-- ========== STORAGE: Excel-upload ==========
-- Eén bucket voor het Excel-planbestand (niet-publiek, alleen voor
-- ingelogde gebruikers). Een nieuwe upload overschrijft altijd hetzelfde
-- pad (zie EXCEL_PAD in js/app.js) -- geen historie, gewoon de laatste versie.
insert into storage.buckets (id, name, public)
values ('masterplan-bestanden', 'masterplan-bestanden', false)
on conflict (id) do nothing;

create policy "masterplan-bestanden: ingelogd leest" on storage.objects
  for select using (bucket_id = 'masterplan-bestanden' and auth.role() = 'authenticated');

create policy "masterplan-bestanden: ingelogd uploadt" on storage.objects
  for insert with check (bucket_id = 'masterplan-bestanden' and auth.role() = 'authenticated');

create policy "masterplan-bestanden: ingelogd overschrijft" on storage.objects
  for update using (bucket_id = 'masterplan-bestanden' and auth.role() = 'authenticated');

create policy "masterplan-bestanden: ingelogd verwijdert" on storage.objects
  for delete using (bucket_id = 'masterplan-bestanden' and auth.role() = 'authenticated');

-- ========== Het gedeelde account aanmaken ==========
-- Supabase dashboard -> Authentication -> Add user:
--   masterplan@masterplan.local   (of jullie eigen echte e-mailadres)
-- Kies een wachtwoord dat jullie beiden gebruiken. Op het inlogscherm van
-- de site kan met alleen "masterplan" (zonder @...) ingelogd worden, of
-- met het volledige e-mailadres.
