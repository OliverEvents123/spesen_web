-- eigene-kreditkarte.sql — eigene Kreditkarte einer Person
--
-- Setzt geraete.sql voraus (im Live-Projekt mit live-gang.sql schon da).
-- Erst im Test-Projekt ausführen, nach Olis OK im Live-Projekt.
-- Mehrfaches Ausführen schadet nicht.
--
-- Ein Gerät gehört entweder zu einer KST (wie bisher) oder zu einer Person
-- (eigene Kreditkarte, beim Benutzer anzuhaken). Die eigene Karte erscheint
-- bei dieser Person beim Erfassen mit Kreditkarte immer in der
-- Geräte-Auswahl — egal, auf welche KST sie bucht. Prüfung und Freigabe
-- bleiben gleich, es geht nur um die Auswahl.
--
-- Lesen und Schreiben regeln die Policies aus geraete.sql (lesen alle
-- Angemeldeten, schreiben nur Admin) — hier ändert sich daran nichts.

alter table public.spesen_zahlgeraet
  add column if not exists person text;     -- E-Mail: eigene Karte dieser Person

-- Eigene Karten haben keine KST
alter table public.spesen_zahlgeraet alter column auftrag_nr drop not null;

alter table public.spesen_zahlgeraet drop constraint if exists spesen_zahlgeraet_zuordnung;
alter table public.spesen_zahlgeraet add constraint spesen_zahlgeraet_zuordnung
  check (auftrag_nr is not null or person is not null);

create index if not exists spesen_zahlgeraet_person_idx on public.spesen_zahlgeraet (person);
