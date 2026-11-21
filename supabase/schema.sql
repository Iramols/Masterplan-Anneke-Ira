-- Masterplan Anneke & Ira -- cloud schema
-- Eenmalig uitvoeren in de SQL Editor van het (nieuwe) Supabase-project.
-- Daarna de Project URL + anon key invullen in js/supabase-config.js.

-- ========== MASTERPLAN_DATA ==========
-- Eén rij per onderdeel (key/value met JSON): 'einddoel', 'masterplan',
-- 'deelplannen', 'acties'. Beide accounts (Ira & Anneke) delen dezelfde
-- data -- geen aparte rollen, geen scheiding tussen gebruikers.
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

-- ========== De twee accounts aanmaken ==========
-- Supabase dashboard -> Authentication -> Add user, voor beide:
--   ira@masterplan.local      (of je eigen echte e-mailadres)
--   anneke@masterplan.local
-- Kies zelf een wachtwoord per account. Op het inlogscherm van de site
-- kan dan met alleen "ira" / "anneke" (zonder @...) ingelogd worden,
-- of met het volledige e-mailadres.
