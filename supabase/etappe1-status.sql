-- etappe1-status.sql
-- Umbau Etappe 1: Status am Beleg ("Zur Prüfung freigeben").
--
-- ZUERST im TEST-Projekt ausführen. Erst nach Olis OK dieselbe Datei im
-- LIVE-Projekt. Mehrfaches Ausführen schadet nicht.
--
-- Status:
--   offen        = erfasst, der User darf alles ändern und löschen
--   eingereicht  = zur Prüfung freigegeben, für den User gesperrt
--   abgeschlossen = Altwert, bleibt erlaubt
-- Weitere Werte (geprüft, genehmigt, …) kommen mit Etappe 2.

-- ---------- Spalte für den Zeitpunkt der Freigabe ----------
alter table public.spesen_beleg add column if not exists eingereicht_am timestamptz;

-- ---------- Nur bekannte Statuswerte ----------
-- "not valid": bestehende Zeilen werden nicht nachgeprüft, nur neue und geänderte.
alter table public.spesen_beleg drop constraint if exists spesen_beleg_status_pruefung;
alter table public.spesen_beleg add constraint spesen_beleg_status_pruefung
  check (status in ('offen', 'eingereicht', 'abgeschlossen')) not valid;

-- ---------- Zeitpunkt setzt die Datenbank, nicht das Handy ----------
create or replace function public.beleg_status_zeit()
 returns trigger
 language plpgsql
as $function$
begin
  if new.status = 'eingereicht' and old.status is distinct from 'eingereicht' then
    new.eingereicht_am := now();
  elsif new.status = 'offen' then
    new.eingereicht_am := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists beleg_status_zeit_trigger on public.spesen_beleg;
create trigger beleg_status_zeit_trigger
  before update on public.spesen_beleg
  for each row execute function public.beleg_status_zeit();

-- ---------- Zugriffsregeln ----------
-- Ändern wie bisher nur, solange der Beleg offen ist. Neu: dabei darf er auf
-- "eingereicht" gesetzt werden. Danach greift das "status = 'offen'" im using —
-- der User kommt nicht mehr dran.
drop policy if exists beleg_aendern on public.spesen_beleg;
create policy beleg_aendern on public.spesen_beleg
  for update to authenticated
  using      (((geraet = (auth.jwt() ->> 'email')) or ist_admin()) and (status = 'offen'))
  with check (((geraet = (auth.jwt() ->> 'email')) or ist_admin())
              and (status in ('offen', 'eingereicht')));

-- Rückweg für Versehen: ein Admin darf einen eingereichten Beleg zurück auf
-- offen setzen (oder ändern). Der User selbst nicht.
drop policy if exists beleg_admin_eingereicht on public.spesen_beleg;
create policy beleg_admin_eingereicht on public.spesen_beleg
  for update to authenticated
  using      (ist_admin() and (status = 'eingereicht'))
  with check (ist_admin() and (status in ('offen', 'eingereicht')));

-- Anlegen (nur offen) und Löschen (nur offen) bleiben unverändert.
