-- user-zahlungen.sql — User-Zahlungen zurückbezahlen: "bezahlt am"
--
-- Setzt live-gang.sql voraus. Erst im Test-Projekt ausführen, nach Olis OK
-- im Live-Projekt. Supabase → SQL Editor → New query → ganze Datei → Run.
-- Mehrfaches Ausführen schadet nicht.
--
-- Admins halten in der App unter Administration → User-Zahlungen fest,
-- welche genehmigten User-Zahlungen sie der Person zurückbezahlt haben
-- (Datum und wer). Das geht nur über die Funktion belege_bezahlt — direkt
-- aus der App lassen sich die zwei Spalten nicht ändern, auch nicht vom
-- Erfasser selbst.
--
-- Ohne diese Datei läuft die App weiter; die Seite User-Zahlungen zeigt
-- dann nur die Liste, ohne "bezahlt".

begin;

-- 1) Zwei Spalten am Beleg
alter table public.spesen_beleg add column if not exists bezahlt_am  date;   -- zurückbezahlt am
alter table public.spesen_beleg add column if not exists bezahlt_von text;   -- E-Mail des Admins

create index if not exists spesen_beleg_vorkasse_idx
  on public.spesen_beleg (bezahlt_am) where zahlart = 'vorkasse';

-- 2) Schutz: direkt aus der App (Rolle authenticated/anon) bleiben die
--    Spalten, wie sie sind. Nur die Funktion unten (andere Rolle) ändert sie.
create or replace function public.beleg_bezahlt_schutz()
 returns trigger language plpgsql as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.bezahlt_am := null;
      new.bezahlt_von := null;
    else
      new.bezahlt_am := old.bezahlt_am;
      new.bezahlt_von := old.bezahlt_von;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists beleg_bezahlt_schutz_trigger on public.spesen_beleg;
create trigger beleg_bezahlt_schutz_trigger
  before insert or update on public.spesen_beleg
  for each row execute function public.beleg_bezahlt_schutz();

-- 3) Als bezahlt markieren (p_datum = Zahltag) oder zurücknehmen (p_datum null).
--    Nur Admins. Bezahlt werden kann nur eine genehmigte User-Zahlung
--    (ganz oder teilweise), die noch nicht bezahlt ist.
--    Gibt zurück, wie viele Belege es wirklich betraf.
create or replace function public.belege_bezahlt(p_ids bigint[], p_datum date)
 returns integer language plpgsql security definer set search_path = public as $function$
declare
  anzahl integer;
begin
  if not ist_admin() then raise exception 'Nur Admins können Zahlungen erfassen.'; end if;
  if p_datum is null then
    update spesen_beleg set bezahlt_am = null, bezahlt_von = null
     where id = any (p_ids) and bezahlt_am is not null;
  else
    update spesen_beleg set bezahlt_am = p_datum, bezahlt_von = auth.jwt() ->> 'email'
     where id = any (p_ids) and zahlart = 'vorkasse'
       and status in ('genehmigt', 'teilweise') and bezahlt_am is null;
  end if;
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$function$;

revoke execute on function public.belege_bezahlt(bigint[], date) from public, anon;
grant  execute on function public.belege_bezahlt(bigint[], date) to authenticated;

-- 4) Zurücksetzen (Admin): ein schon bezahlter Beleg nicht — sonst könnte
--    der Betrag nach der Auszahlung noch ändern. Zuerst die Zahlung
--    zurücknehmen. Sonst wie bisher (live-gang.sql).
create or replace function public.beleg_zuruecksetzen(p_id bigint, p_ziel text)
 returns void language plpgsql security definer set search_path = public as $function$
begin
  if not ist_admin() then raise exception 'Nur Admins dürfen zurücksetzen.'; end if;
  if p_ziel not in ('offen', 'eingereicht') then raise exception 'Ungültiges Ziel.'; end if;
  if exists (select 1 from spesen_beleg where id = p_id and bezahlt_am is not null) then
    raise exception 'Schon zurückbezahlt — zuerst unter User-Zahlungen die Zahlung zurücknehmen.';
  end if;
  -- Erst auf offen, damit "eingereicht" neu zugeordnet wird.
  update spesen_beleg set status = 'offen' where id = p_id;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if p_ziel = 'eingereicht' then
    update spesen_beleg set status = 'eingereicht' where id = p_id;
  end if;
end;
$function$;

commit;
