-- benutzer-loeschen.sql — Benutzer endgültig löschen (Altlasten)
--
-- Im LIVE-Projekt, SQL Editor. Zwei Schritte — einzeln ausführen:
--   Schritt 1 nur markieren und Run: zeigt, was zu diesen Benutzern gespeichert ist.
--   Schritt 2 markieren und Run: löscht. Hat ein Benutzer noch Belege, bricht
--   Schritt 2 ab und löscht NICHTS — es sei denn, belege_mitloeschen = true.
--
-- Gelöscht werden: Anmeldung (auth.users), Eintrag in spesen_benutzer,
-- Favoriten, gespeicherte Zeiträume, Zuweisungen (als Prüfer und als Person)
-- — und mit belege_mitloeschen = true auch die Belege samt Verlauf.
-- Die Belegdateien (Fotos/PDF) lassen sich nicht per SQL löschen: im
-- Supabase-Dashboard unter Storage → belege den Ordner der Person löschen
-- (z. B. finn1_eventorganisation_ch).

-- ============================================================
-- Schritt 1: nur ansehen
-- ============================================================
with weg(email) as (values
  ('finn1@eventorganisation.ch'), ('finn2@eventorganisation.ch'),
  ('finn3@eventorganisation.ch'), ('msd@eventorganisation.ch'))
select w.email,
  (select count(*) from auth.users u                     where lower(u.email) = w.email) as anmeldung,
  (select count(*) from public.spesen_benutzer b         where lower(b.email) = w.email) as benutzer,
  (select count(*) from public.spesen_beleg b            where lower(b.geraet) = w.email) as belege,
  (select count(*) from public.spesen_favorit f          where lower(f.geraet) = w.email) as favoriten,
  (select count(*) from public.spesen_periode p          where lower(p.geraet) = w.email) as zeitraeume,
  (select count(*) from public.spesen_zuweisung z        where lower(z.email) = w.email)
  + (select count(*) from public.spesen_zuweisung_konto z  where lower(z.email) = w.email)
  + (select count(*) from public.spesen_zuweisung_person z where lower(z.email) = w.email or lower(z.person) = w.email)
    as zuweisungen
from weg w order by w.email;

-- ============================================================
-- Schritt 2: löschen
-- ============================================================
do $$
declare
  weg text[] := array['finn1@eventorganisation.ch', 'finn2@eventorganisation.ch',
                      'finn3@eventorganisation.ch', 'msd@eventorganisation.ch'];
  belege_mitloeschen boolean := false;   -- auf true setzen, wenn auch ihre Belege weg sollen
  ids bigint[];
  n int;
begin
  select coalesce(array_agg(id), '{}') into ids from public.spesen_beleg where lower(geraet) = any (weg);
  n := coalesce(array_length(ids, 1), 0);

  if n > 0 and not belege_mitloeschen then
    raise exception 'Diese Benutzer haben noch % Belege — es wurde NICHTS gelöscht. Wenn die Belege auch weg sollen: oben belege_mitloeschen := true setzen und Schritt 2 nochmals ausführen.', n;
  end if;

  if n > 0 then
    delete from public.spesen_beleg   where id = any (ids);
    delete from public.spesen_verlauf where beleg_id = any (ids);   -- inkl. der eben entstandenen "gelöscht"-Einträge
  end if;

  delete from public.spesen_favorit          where lower(geraet) = any (weg);
  delete from public.spesen_periode          where lower(geraet) = any (weg);
  delete from public.spesen_zuweisung        where lower(email)  = any (weg);
  delete from public.spesen_zuweisung_konto  where lower(email)  = any (weg);
  delete from public.spesen_zuweisung_person where lower(email)  = any (weg) or lower(person) = any (weg);
  delete from public.spesen_benutzer         where lower(email)  = any (weg);
  delete from auth.users                     where lower(email)  = any (weg);

  raise notice 'Gelöscht: % Benutzer, % Belege.', array_length(weg, 1), n;
end $$;
