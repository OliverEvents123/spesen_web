-- kst-auswahl.sql — Welche Kostenstellen (Auftragsnummern) erscheinen in der Auswahl?
--
-- Erst im Test-Projekt ausführen, nach Olis OK im Live-Projekt.
-- Mehrfaches Ausführen schadet nicht (vorhandene Einstellungen bleiben).
--
-- Bisher: laufendes Jahr + Vorjahr aus FileMaker, dazu eine feste Liste
-- jahresübergreifender Nummern im Code der Edge Function.
-- Neu stellt das der Admin in der App ein (Verwaltung → Kostenstellen):
--   spesen_kst_jahr   — welche Jahre angezeigt werden (Haken)
--   spesen_kst_regel  — einzelne KST: sichtbar = true  → immer anzeigen
--                                      sichtbar = false → ausblenden
-- Damit die "immer anzeigen"-Nummern aus ausgeblendeten Jahren kommen,
-- braucht es die neue Fassung der Edge Function auftragsnummern.

create table if not exists public.spesen_kst_jahr (
  jahr     integer primary key check (jahr between 2000 and 2100),
  sichtbar boolean not null default true,
  erstellt timestamptz not null default now()
);

create table if not exists public.spesen_kst_regel (
  auftrag_nr text primary key,
  sichtbar   boolean not null,          -- true: immer anzeigen, false: ausblenden
  erstellt   timestamptz not null default now()
);

alter table public.spesen_kst_jahr  enable row level security;
alter table public.spesen_kst_regel enable row level security;

-- Lesen: alle Angemeldeten (die App braucht es beim Laden); ändern: Admin
drop policy if exists kst_jahr_lesen on public.spesen_kst_jahr;
create policy kst_jahr_lesen on public.spesen_kst_jahr for select to authenticated using (true);
drop policy if exists kst_jahr_admin on public.spesen_kst_jahr;
create policy kst_jahr_admin on public.spesen_kst_jahr
  for all to authenticated using (ist_admin()) with check (ist_admin());

drop policy if exists kst_regel_lesen on public.spesen_kst_regel;
create policy kst_regel_lesen on public.spesen_kst_regel for select to authenticated using (true);
drop policy if exists kst_regel_admin on public.spesen_kst_regel;
create policy kst_regel_admin on public.spesen_kst_regel
  for all to authenticated using (ist_admin()) with check (ist_admin());

grant select, insert, update, delete on public.spesen_kst_jahr  to authenticated;
grant select, insert, update, delete on public.spesen_kst_regel to authenticated;

-- Startwerte wie bisher: laufendes Jahr und Vorjahr ...
insert into public.spesen_kst_jahr (jahr, sichtbar)
values (extract(year from now())::int, true), (extract(year from now())::int - 1, true)
on conflict (jahr) do nothing;

-- ... und die bisher fest eingebauten jahresübergreifenden Nummern
insert into public.spesen_kst_regel (auftrag_nr, sichtbar)
select nr, true from unnest(array[
  '97', '98', '99',                     -- Ausbildung / Lehrlingsarbeiten
  '200', '201',                         -- Tit-Pit allgemein
  '221', '223', '224', '225',           -- Eventmitarbeiter, SMS-Konto, Preisdruck, Solvent
  '325',                                -- Sprintservice
  '615',                                -- swiss Athletics
  '900', '901', '902', '903',           -- 3D & Rendering, Nähen, StageCrew, Internet
  '905', '906', '907', '909', '911'     -- Fahrzeuge, Recycling, Grafik, Kleider, Hauswartung
]) as nr
on conflict (auftrag_nr) do nothing;
