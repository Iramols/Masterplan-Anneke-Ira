# Masterplan Anneke & Ira

Private planningssite voor het opzetten van het leefstijlbedrijf: einddoel, deelplannen en acties. Gedeeld tussen Ira en Anneke, achter een login.

## Opzetten

1. Maak een nieuw, apart Supabase-project aan op [supabase.com](https://supabase.com) (gratis tier).
2. Open de SQL Editor en voer [`supabase/schema.sql`](supabase/schema.sql) uit.
3. Maak het gedeelde account aan via Authentication -> Add user (zie onderaan `schema.sql`).
4. Vul in [`js/supabase-config.js`](js/supabase-config.js) de Project URL en anon public key in (Project Settings -> API).
5. Publiceer via GitHub Pages (Settings -> Pages -> Deploy from branch -> main / root).

## Structuur

- **Doelen 2030** — het eindbeeld van het bedrijf over een aantal jaar
- **Tussentijdse doelen 2027-2029** — de losse bouwstenen (aanbod, marketing, financiën, ...)
- **Acties** — concrete stappen

Alle data staat in Supabase (tabel `masterplan_data`), niet in deze repo — de site zelf mag dus public zijn zonder dat het masterplan zichtbaar wordt voor anderen.
