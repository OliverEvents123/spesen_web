-- live-gang.sql — alle Datenbank-Änderungen für den Live-Gang in einem Stück
--
-- NUR IM LIVE-PROJEKT (ieziwunnhyoiacleyspw) ausführen — im Test-Projekt ist
-- alles schon drin. Supabase → SQL Editor → New query → ganze Datei einfügen → Run.
--
-- Enthält in dieser Reihenfolge (unverändert zusammengesetzt):
--   1. etappe1-status.sql
--   2. etappe2-freigabe.sql
--   3. verlauf-pruefer.sql
--   4. kommentar-korrektur-personen.sql
--   5. geraete.sql
--   6. kst-auswahl.sql
--
-- Läuft in einer Transaktion: geht etwas schief, wird NICHTS geändert.
-- Mehrfaches Ausführen schadet nicht.
-- Danach: Edge Functions "benutzer" und "auftragsnummern" deployen,
-- erst dann kommt die neue App auf main.

begin;

-- =====================================================================
-- etappe1-status.sql
-- =====================================================================

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

-- =====================================================================
-- etappe2-freigabe.sql
-- =====================================================================

-- etappe2-freigabe.sql
-- Umbau Etappe 2 + 4: Projektleiter, Supervisor, Entscheide, Protokoll.
-- Setzt etappe1-status.sql voraus.
--
-- ZUERST im TEST-Projekt ausführen. Erst nach Olis OK im LIVE-Projekt.
-- Mehrfaches Ausführen schadet nicht.
--
-- Wer darf entscheiden?
--   - Admins: immer
--   - Projektleiter: Belege, deren Kostenstelle (KST) ihnen zugewiesen ist
--   - Supervisor: Belege, deren Konto ihnen zugewiesen ist — und alle Belege
--     von Usern mit "Prüfung einrichten"
--   Ein Projektleiter darf auch eigene Belege entscheiden. Der erste Entscheid gilt.
--
-- Status:
--   offen (= erfasst) → eingereicht → je nach Zahlungsart:
--     Kreditkarte / Bar:  geprueft | besprechung
--     Vorauskasse:        genehmigt | teilweise | abgelehnt
--   Ohne Prüfer (und ohne "Prüfung einrichten") geht ein Beleg beim
--   Einreichen direkt auf geprueft bzw. genehmigt, entscheid_von = 'automatisch'.
--
-- Entscheide laufen ausschliesslich über die Funktionen beleg_entscheiden,
-- beleg_umkontieren und beleg_zuruecksetzen. Direkt kann ein User nur
-- erfassen, ändern (solange erfasst oder abgelehnt) und einreichen.

-- ============================================================
-- Benutzer: neue Rollen, "Prüfung einrichten"
-- ============================================================

alter table public.spesen_benutzer add column if not exists pruefung boolean not null default false;

alter table public.spesen_benutzer drop constraint if exists spesen_benutzer_rolle_check;
alter table public.spesen_benutzer add constraint spesen_benutzer_rolle_check
  check (rolle in ('admin', 'supervisor', 'projektleiter', 'user'));

-- ============================================================
-- Zuweisungen
-- ============================================================

create table if not exists public.spesen_zuweisung (          -- Projektleiter × KST
  email      text not null,
  auftrag_nr text not null,
  erstellt   timestamptz not null default now(),
  primary key (email, auftrag_nr)
);

create table if not exists public.spesen_zuweisung_konto (    -- Supervisor × Konto
  email        text not null,
  konto_nummer text not null,
  erstellt     timestamptz not null default now(),
  primary key (email, konto_nummer)
);

alter table public.spesen_zuweisung       enable row level security;
alter table public.spesen_zuweisung_konto enable row level security;

drop policy if exists zuweisung_lesen on public.spesen_zuweisung;
create policy zuweisung_lesen on public.spesen_zuweisung
  for select to authenticated using (email = (auth.jwt() ->> 'email') or ist_admin());
drop policy if exists zuweisung_admin on public.spesen_zuweisung;
create policy zuweisung_admin on public.spesen_zuweisung
  for all to authenticated using (ist_admin()) with check (ist_admin());

drop policy if exists zuweisung_konto_lesen on public.spesen_zuweisung_konto;
create policy zuweisung_konto_lesen on public.spesen_zuweisung_konto
  for select to authenticated using (email = (auth.jwt() ->> 'email') or ist_admin());
drop policy if exists zuweisung_konto_admin on public.spesen_zuweisung_konto;
create policy zuweisung_konto_admin on public.spesen_zuweisung_konto
  for all to authenticated using (ist_admin()) with check (ist_admin());

grant select, insert, delete on public.spesen_zuweisung, public.spesen_zuweisung_konto
  to authenticated;

-- ============================================================
-- Beleg: Entscheid-Felder, Status
-- ============================================================

alter table public.spesen_beleg add column if not exists genehmigt_betrag numeric(10,2);
alter table public.spesen_beleg add column if not exists entscheid_grund  text;
alter table public.spesen_beleg add column if not exists entscheid_von    text;
alter table public.spesen_beleg add column if not exists entscheid_am     timestamptz;

alter table public.spesen_beleg drop constraint if exists spesen_beleg_status_pruefung;
alter table public.spesen_beleg add constraint spesen_beleg_status_pruefung
  check (status in ('offen', 'eingereicht', 'geprueft', 'besprechung',
                    'genehmigt', 'teilweise', 'abgelehnt', 'abgeschlossen')) not valid;

-- ============================================================
-- Hilfsfunktionen
-- ============================================================

-- Alle KST bzw. Konten eines Belegs — bei aufgeteilten aus jeder Position.
create or replace function public.beleg_kst(p_auftrag text, p_positionen jsonb)
 returns text[] language sql immutable as $$
  select array(select p_auftrag
               union
               select x ->> 'auftrag_nr'
               from jsonb_array_elements(coalesce(p_positionen, '[]'::jsonb)) x)
$$;

create or replace function public.beleg_konten(p_konto text, p_positionen jsonb)
 returns text[] language sql immutable as $$
  select array(select p_konto
               union
               select x ->> 'konto_nummer'
               from jsonb_array_elements(coalesce(p_positionen, '[]'::jsonb)) x)
$$;

-- Hat ein Beleg überhaupt jemanden, der ihn prüfen muss?
create or replace function public.beleg_hat_pruefer(p_geraet text, p_auftrag text,
                                                    p_konto text, p_positionen jsonb)
 returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from spesen_zuweisung z join spesen_benutzer u on u.email = z.email
                 where u.aktiv and z.auftrag_nr = any (beleg_kst(p_auftrag, p_positionen)))
      or exists (select 1 from spesen_zuweisung_konto z join spesen_benutzer u on u.email = z.email
                 where u.aktiv and z.konto_nummer = any (beleg_konten(p_konto, p_positionen)))
      or exists (select 1 from spesen_benutzer where email = p_geraet and pruefung)
$$;

-- Darf die angemeldete Person diesen Beleg sehen und entscheiden?
create or replace function public.darf_entscheiden(p_geraet text, p_auftrag text,
                                                   p_konto text, p_positionen jsonb)
 returns boolean language sql stable security definer set search_path = public as $$
  select ist_admin()
      or exists (select 1 from spesen_zuweisung
                 where email = auth.jwt() ->> 'email'
                   and auftrag_nr = any (beleg_kst(p_auftrag, p_positionen)))
      or exists (select 1 from spesen_zuweisung_konto
                 where email = auth.jwt() ->> 'email'
                   and konto_nummer = any (beleg_konten(p_konto, p_positionen)))
      or (exists (select 1 from spesen_benutzer
                  where email = auth.jwt() ->> 'email' and rolle = 'supervisor' and aktiv)
          and exists (select 1 from spesen_benutzer where email = p_geraet and pruefung))
$$;

-- Ist die angemeldete Person überhaupt Prüfer? (für den Reiter "Zur Freigabe")
create or replace function public.ist_pruefer()
 returns boolean language sql stable security definer set search_path = public as $$
  select ist_admin()
      or exists (select 1 from spesen_zuweisung       where email = auth.jwt() ->> 'email')
      or exists (select 1 from spesen_zuweisung_konto where email = auth.jwt() ->> 'email')
      or exists (select 1 from spesen_benutzer
                 where email = auth.jwt() ->> 'email' and rolle = 'supervisor' and aktiv)
$$;

-- ============================================================
-- Regeln beim Ändern eines Belegs (ersetzt beleg_status_zeit aus Etappe 1)
-- ============================================================

drop trigger if exists beleg_status_zeit_trigger on public.spesen_beleg;
drop function if exists public.beleg_status_zeit();

create or replace function public.beleg_regeln()
 returns trigger language plpgsql as $function$
declare
  -- Direkt aus der App (Rolle authenticated) oder über eine der Funktionen
  -- unten bzw. den SQL Editor (andere Rolle)?
  direkt boolean := current_user in ('authenticated', 'anon');
begin
  if direkt then
    -- Direkt darf nur erfasst und eingereicht werden. Entscheide nie.
    if new.status not in ('offen', 'eingereicht') then
      raise exception 'Status "%" kann nur über die Freigabe gesetzt werden.', new.status;
    end if;
    new.genehmigt_betrag := old.genehmigt_betrag;
    new.entscheid_grund  := old.entscheid_grund;
    new.entscheid_von    := old.entscheid_von;
    new.entscheid_am     := old.entscheid_am;
  end if;

  if new.status = 'offen' then
    new.eingereicht_am := null;
    if old.status <> 'abgelehnt' or not direkt then
      new.genehmigt_betrag := null; new.entscheid_von := null; new.entscheid_am := null;
      new.entscheid_grund := null;
    end if;

  elsif new.status = 'eingereicht'
        and (old.status is distinct from 'eingereicht'
             or new.auftrag_nr   is distinct from old.auftrag_nr
             or new.konto_nummer is distinct from old.konto_nummer
             or new.positionen   is distinct from old.positionen) then
    -- (Neu) eingereicht oder umkontiert: alter Entscheid fällt weg, neu zuordnen.
    if old.status is distinct from 'eingereicht' then new.eingereicht_am := now(); end if;
    new.genehmigt_betrag := null; new.entscheid_grund := null;
    new.entscheid_von := null;    new.entscheid_am := null;

    if not beleg_hat_pruefer(new.geraet, new.auftrag_nr, new.konto_nummer, new.positionen) then
      new.status := case when new.zahlart = 'vorkasse' then 'genehmigt' else 'geprueft' end;
      new.genehmigt_betrag := new.betrag;
      new.entscheid_von    := 'automatisch';
      new.entscheid_am     := now();
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists beleg_regeln_trigger on public.spesen_beleg;
create trigger beleg_regeln_trigger
  before update on public.spesen_beleg
  for each row execute function public.beleg_regeln();

-- ============================================================
-- Zugriffsregeln für Belege
-- ============================================================

drop policy if exists beleg_lesen on public.spesen_beleg;
create policy beleg_lesen on public.spesen_beleg
  for select to authenticated
  using ((geraet = (auth.jwt() ->> 'email'))
         or darf_entscheiden(geraet, auftrag_nr, konto_nummer, positionen));

-- Ändern: eigene (oder Admin), solange erfasst oder abgelehnt.
drop policy if exists beleg_aendern on public.spesen_beleg;
create policy beleg_aendern on public.spesen_beleg
  for update to authenticated
  using      (((geraet = (auth.jwt() ->> 'email')) or ist_admin())
              and (status in ('offen', 'abgelehnt')))
  with check ((geraet = (auth.jwt() ->> 'email')) or ist_admin());

-- Der Admin-Rückweg aus Etappe 1 läuft jetzt über beleg_zuruecksetzen.
drop policy if exists beleg_admin_eingereicht on public.spesen_beleg;

-- Löschen: eigene, solange erfasst oder abgelehnt.
drop policy if exists beleg_loeschen on public.spesen_beleg;
create policy beleg_loeschen on public.spesen_beleg
  for delete to authenticated
  using ((geraet = (auth.jwt() ->> 'email')) and (status in ('offen', 'abgelehnt')));

-- Prüfer sehen auch die Belegdateien ihrer Belege.
drop policy if exists beleg_datei_lesen on storage.objects;
create policy beleg_datei_lesen on storage.objects
  for select to authenticated
  using ((bucket_id = 'belege') and (
    ((storage.foldername(name))[1] =
       replace(replace((auth.jwt() ->> 'email'), '@', '_'), '.', '_'))
    or ist_admin()
    or exists (select 1 from public.spesen_beleg b
               where b.datei_pfad = storage.objects.name
                 and public.darf_entscheiden(b.geraet, b.auftrag_nr,
                                             b.konto_nummer, b.positionen))));

-- ============================================================
-- Entscheiden, umkontieren, zurücksetzen
-- ============================================================

create or replace function public.beleg_entscheiden(p_id bigint, p_status text,
                                                    p_betrag numeric default null,
                                                    p_grund text default null)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b spesen_beleg;
  grund text := nullif(trim(coalesce(p_grund, '')), '');
begin
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if not darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer, b.positionen) then
    raise exception 'Für diesen Beleg bist du nicht zuständig.';
  end if;
  if b.status <> 'eingereicht' then
    raise exception 'Der Beleg ist nicht mehr zur Prüfung offen — schon entschieden?';
  end if;

  if b.zahlart = 'vorkasse' then
    if p_status not in ('genehmigt', 'teilweise', 'abgelehnt') then
      raise exception 'Vorauskasse: genehmigen, teilweise genehmigen oder ablehnen.';
    end if;
  elsif p_status not in ('geprueft', 'besprechung') then
    raise exception 'Kreditkarte und Bar: prüfen oder zur Besprechung vermerken.';
  end if;

  if p_status in ('besprechung', 'teilweise', 'abgelehnt') and grund is null then
    raise exception 'Bitte einen Kommentar angeben.';
  end if;
  if p_status = 'teilweise'
     and (p_betrag is null or p_betrag <= 0 or p_betrag >= b.betrag) then
    raise exception 'Der genehmigte Betrag muss zwischen 0 und % liegen.', b.betrag;
  end if;

  update spesen_beleg set
    status           = p_status,
    genehmigt_betrag = case p_status when 'teilweise' then round(p_betrag, 2)
                                     when 'abgelehnt' then 0
                                     else b.betrag end,
    entscheid_grund  = grund,
    entscheid_von    = auth.jwt() ->> 'email',
    entscheid_am     = now()
  where id = p_id;
end;
$function$;

-- Kontierung korrigieren. Wechselt die KST, landet der Beleg beim
-- zuständigen Prüfer der neuen KST — wieder ungeprüft.
create or replace function public.beleg_umkontieren(p_id bigint, p_konto text, p_auftrag text)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b spesen_beleg;
begin
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if not darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer, b.positionen) then
    raise exception 'Für diesen Beleg bist du nicht zuständig.';
  end if;
  if b.status <> 'eingereicht' then
    raise exception 'Nur eingereichte Belege lassen sich umkontieren.';
  end if;
  if jsonb_array_length(coalesce(b.positionen, '[]'::jsonb)) > 1 then
    raise exception 'Aufgeteilte Belege bitte ablehnen und vom Erfasser korrigieren lassen.';
  end if;
  if not exists (select 1 from spesen_konto where nummer = p_konto) then
    raise exception 'Konto % gibt es nicht.', p_konto;
  end if;
  update spesen_beleg set konto_nummer = p_konto, auftrag_nr = p_auftrag,
                          positionen = null, geaendert = now()
  where id = p_id;
end;
$function$;

-- Rückweg für Admins: auf "erfasst" (Erfasser kann wieder ändern) oder
-- auf "eingereicht" (Entscheid zurücknehmen, neu prüfen).
create or replace function public.beleg_zuruecksetzen(p_id bigint, p_ziel text)
 returns void language plpgsql security definer set search_path = public as $function$
begin
  if not ist_admin() then raise exception 'Nur Admins dürfen zurücksetzen.'; end if;
  if p_ziel not in ('offen', 'eingereicht') then raise exception 'Ungültiges Ziel.'; end if;
  -- Erst auf offen, damit "eingereicht" neu zugeordnet wird.
  update spesen_beleg set status = 'offen' where id = p_id;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if p_ziel = 'eingereicht' then
    update spesen_beleg set status = 'eingereicht' where id = p_id;
  end if;
end;
$function$;

-- Alles, was die angemeldete Person gerade entscheiden muss.
create or replace function public.freigabe_liste()
 returns setof public.spesen_beleg language sql stable set search_path = public as $$
  select * from spesen_beleg
  where status = 'eingereicht'
    and darf_entscheiden(geraet, auftrag_nr, konto_nummer, positionen)
  order by eingereicht_am, id
$$;

revoke execute on function public.beleg_entscheiden(bigint, text, numeric, text) from public, anon;
revoke execute on function public.beleg_umkontieren(bigint, text, text)          from public, anon;
revoke execute on function public.beleg_zuruecksetzen(bigint, text)              from public, anon;
grant  execute on function public.beleg_entscheiden(bigint, text, numeric, text) to authenticated;
grant  execute on function public.beleg_umkontieren(bigint, text, text)          to authenticated;
grant  execute on function public.beleg_zuruecksetzen(bigint, text)              to authenticated;
grant  execute on function public.freigabe_liste()                               to authenticated;
grant  execute on function public.ist_pruefer()                                  to authenticated;

-- ============================================================
-- Protokoll: jeder Schritt mit Person und Zeitpunkt
-- ============================================================

create table if not exists public.spesen_verlauf (
  id       bigint generated by default as identity primary key,
  beleg_id bigint not null,
  wann     timestamptz not null default now(),
  wer      text,
  aktion   text not null,
  status   text,
  details  jsonb
);
create index if not exists spesen_verlauf_beleg_idx on public.spesen_verlauf (beleg_id);

alter table public.spesen_verlauf enable row level security;
drop policy if exists verlauf_lesen on public.spesen_verlauf;
create policy verlauf_lesen on public.spesen_verlauf
  for select to authenticated using (ist_admin());
grant select on public.spesen_verlauf to authenticated;

create or replace function public.beleg_protokoll()
 returns trigger language plpgsql security definer set search_path = public as $function$
declare
  wer text := coalesce(auth.jwt() ->> 'email', current_user);
  diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into spesen_verlauf (beleg_id, wer, aktion, status, details)
    values (new.id, wer, 'angelegt', new.status, to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into spesen_verlauf (beleg_id, wer, aktion, status, details)
    values (old.id, wer, 'gelöscht', old.status, to_jsonb(old));
    return old;
  end if;

  select jsonb_object_agg(n.key, jsonb_build_object('alt', o.value, 'neu', n.value))
    into diff
  from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value and n.key <> 'geaendert';
  if diff is null then return new; end if;

  insert into spesen_verlauf (beleg_id, wer, aktion, status, details)
  values (new.id, wer,
          case when new.status is distinct from old.status then 'status' else 'geändert' end,
          new.status, diff);
  return new;
end;
$function$;

drop trigger if exists beleg_protokoll_trigger on public.spesen_beleg;
create trigger beleg_protokoll_trigger
  after insert or update or delete on public.spesen_beleg
  for each row execute function public.beleg_protokoll();

-- =====================================================================
-- verlauf-pruefer.sql
-- =====================================================================

-- verlauf-pruefer.sql — Verlauf für Prüfer, Namen in Listen (neues Aussehen, 12.10.2026)
--
-- Erst im Test-Projekt ausführen, nach dem OK im Live-Projekt — dort NACH
-- etappe1-status.sql und etappe2-freigabe.sql. Mehrfach ausführen schadet nicht.
--
-- Ohne diese Datei läuft die App trotzdem: Projektleiter sehen dann einfach
-- keinen Verlauf, und in Listen steht die E-Mail statt des Namens.

-- 1) Verlauf lesen
--    Admin: alles.
--    Projektleiter / Supervisor: den Verlauf der Belege, die sie sehen dürfen —
--    also ihrer Kostenstellen bzw. Konten — und ihrer eigenen Belege.
--    Die Abfrage auf spesen_beleg läuft mit den Rechten der angemeldeten
--    Person; sie sieht dort genau diese Belege (Regel beleg_lesen).
drop policy if exists verlauf_lesen on public.spesen_verlauf;
create policy verlauf_lesen on public.spesen_verlauf
  for select to authenticated
  using (ist_admin()
         or (ist_pruefer()
             and exists (select 1 from public.spesen_beleg b where b.id = spesen_verlauf.beleg_id)));

-- 2) Namen statt E-Mail in Listen, Freigabe und Verlauf.
--    Gibt nur E-Mail und Name heraus — keine Rollen, keine Sperren.
create or replace function public.benutzer_namen()
 returns table (email text, name text)
 language sql stable security definer set search_path = public as $$
  select email, name from spesen_benutzer where coalesce(name, '') <> ''
$$;
revoke all on function public.benutzer_namen() from public, anon;
grant execute on function public.benutzer_namen() to authenticated;

-- =====================================================================
-- kommentar-korrektur-personen.sql
-- =====================================================================

-- kommentar-korrektur-personen.sql — Anpassungen nach dem ersten Test des neuen Aussehens
--
-- Setzt etappe1-status.sql und etappe2-freigabe.sql voraus.
-- Erst im Test-Projekt ausführen, nach Olis OK im Live-Projekt.
-- Mehrfaches Ausführen schadet nicht.
--
-- 1) Beleg: optionaler Kommentar (Spalte kommentar)
-- 2) Prüfer korrigieren bei Kreditkarte/Bar Betrag, MwSt und Datum
--    (Funktion beleg_korrigieren) — bei User-Zahlungen geht das wie bisher
--    über "teilweise genehmigen"
-- 3) Supervisor × Person: User-Zahlungen (Zahlart vorkasse) dieser Personen
--    brauchen die Genehmigung des Supervisors (Tabelle spesen_zuweisung_person)
--    Wie überall gilt: wer zuerst entscheidet — PL, Supervisor oder Admin.
-- 4) Texte: "Vorauskasse" heisst in der App jetzt "User-Zahlung".
--    In der Datenbank bleibt der Wert zahlart = 'vorkasse'.

-- ============================================================
-- 1) Kommentar
-- ============================================================

alter table public.spesen_beleg add column if not exists kommentar text;

-- ============================================================
-- 3) Supervisor × Person
-- ============================================================

create table if not exists public.spesen_zuweisung_person (
  email    text not null,   -- Supervisor
  person   text not null,   -- E-Mail der Person, deren User-Zahlungen er genehmigt
  erstellt timestamptz not null default now(),
  primary key (email, person)
);

alter table public.spesen_zuweisung_person enable row level security;

drop policy if exists zuweisung_person_lesen on public.spesen_zuweisung_person;
create policy zuweisung_person_lesen on public.spesen_zuweisung_person
  for select to authenticated using (email = (auth.jwt() ->> 'email') or ist_admin());
drop policy if exists zuweisung_person_admin on public.spesen_zuweisung_person;
create policy zuweisung_person_admin on public.spesen_zuweisung_person
  for all to authenticated using (ist_admin()) with check (ist_admin());

grant select, insert, delete on public.spesen_zuweisung_person to authenticated;

-- Hat ein Beleg jemanden, der ihn prüfen muss? Wie bisher — und dazu:
-- User-Zahlungen einer Person mit zugewiesenem Supervisor.
create or replace function public.beleg_hat_pruefer(p_geraet text, p_auftrag text,
                                                    p_konto text, p_positionen jsonb,
                                                    p_zahlart text)
 returns boolean language sql stable security definer set search_path = public as $$
  select beleg_hat_pruefer(p_geraet, p_auftrag, p_konto, p_positionen)
      or (p_zahlart = 'vorkasse'
          and exists (select 1 from spesen_zuweisung_person z join spesen_benutzer u on u.email = z.email
                      where z.person = p_geraet and u.aktiv))
$$;

-- Darf die angemeldete Person diesen Beleg sehen und entscheiden? Wie bisher —
-- und dazu: Supervisor bei User-Zahlungen der ihm zugewiesenen Personen.
create or replace function public.darf_entscheiden(p_geraet text, p_auftrag text,
                                                   p_konto text, p_positionen jsonb,
                                                   p_zahlart text)
 returns boolean language sql stable security definer set search_path = public as $$
  select darf_entscheiden(p_geraet, p_auftrag, p_konto, p_positionen)
      or (p_zahlart = 'vorkasse'
          and exists (select 1 from spesen_zuweisung_person
                      where email = auth.jwt() ->> 'email' and person = p_geraet))
$$;

create or replace function public.ist_pruefer()
 returns boolean language sql stable security definer set search_path = public as $$
  select ist_admin()
      or exists (select 1 from spesen_zuweisung        where email = auth.jwt() ->> 'email')
      or exists (select 1 from spesen_zuweisung_konto  where email = auth.jwt() ->> 'email')
      or exists (select 1 from spesen_zuweisung_person where email = auth.jwt() ->> 'email')
      or exists (select 1 from spesen_benutzer
                 where email = auth.jwt() ->> 'email' and rolle = 'supervisor' and aktiv)
$$;

-- Regeln beim Ändern: wie in etappe2, nur mit der Zahlart bei der Frage,
-- ob jemand prüfen muss.
create or replace function public.beleg_regeln()
 returns trigger language plpgsql as $function$
declare
  direkt boolean := current_user in ('authenticated', 'anon');
begin
  if direkt then
    if new.status not in ('offen', 'eingereicht') then
      raise exception 'Status "%" kann nur über die Freigabe gesetzt werden.', new.status;
    end if;
    new.genehmigt_betrag := old.genehmigt_betrag;
    new.entscheid_grund  := old.entscheid_grund;
    new.entscheid_von    := old.entscheid_von;
    new.entscheid_am     := old.entscheid_am;
  end if;

  if new.status = 'offen' then
    new.eingereicht_am := null;
    if old.status <> 'abgelehnt' or not direkt then
      new.genehmigt_betrag := null; new.entscheid_von := null; new.entscheid_am := null;
      new.entscheid_grund := null;
    end if;

  elsif new.status = 'eingereicht'
        and (old.status is distinct from 'eingereicht'
             or new.auftrag_nr   is distinct from old.auftrag_nr
             or new.konto_nummer is distinct from old.konto_nummer
             or new.positionen   is distinct from old.positionen) then
    if old.status is distinct from 'eingereicht' then new.eingereicht_am := now(); end if;
    new.genehmigt_betrag := null; new.entscheid_grund := null;
    new.entscheid_von := null;    new.entscheid_am := null;

    if not beleg_hat_pruefer(new.geraet, new.auftrag_nr, new.konto_nummer,
                             new.positionen, new.zahlart) then
      new.status := case when new.zahlart = 'vorkasse' then 'genehmigt' else 'geprueft' end;
      new.genehmigt_betrag := new.betrag;
      new.entscheid_von    := 'automatisch';
      new.entscheid_am     := now();
    end if;
  end if;
  return new;
end;
$function$;

-- Lesen: eigene oder die, über die man entscheiden darf (jetzt mit Zahlart)
drop policy if exists beleg_lesen on public.spesen_beleg;
create policy beleg_lesen on public.spesen_beleg
  for select to authenticated
  using ((geraet = (auth.jwt() ->> 'email'))
         or darf_entscheiden(geraet, auftrag_nr, konto_nummer, positionen, zahlart));

drop policy if exists beleg_datei_lesen on storage.objects;
create policy beleg_datei_lesen on storage.objects
  for select to authenticated
  using ((bucket_id = 'belege') and (
    ((storage.foldername(name))[1] =
       replace(replace((auth.jwt() ->> 'email'), '@', '_'), '.', '_'))
    or ist_admin()
    or exists (select 1 from public.spesen_beleg b
               where b.datei_pfad = storage.objects.name
                 and public.darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer,
                                             b.positionen, b.zahlart))));

create or replace function public.freigabe_liste()
 returns setof public.spesen_beleg language sql stable set search_path = public as $$
  select * from spesen_beleg
  where status = 'eingereicht'
    and darf_entscheiden(geraet, auftrag_nr, konto_nummer, positionen, zahlart)
  order by eingereicht_am, id
$$;

-- ============================================================
-- Entscheiden und umkontieren (wie etappe2, mit Zahlart und neuen Texten)
-- ============================================================

create or replace function public.beleg_entscheiden(p_id bigint, p_status text,
                                                    p_betrag numeric default null,
                                                    p_grund text default null)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b spesen_beleg;
  grund text := nullif(trim(coalesce(p_grund, '')), '');
begin
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if not darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer, b.positionen, b.zahlart) then
    raise exception 'Für diesen Beleg bist du nicht zuständig.';
  end if;
  if b.status <> 'eingereicht' then
    raise exception 'Der Beleg ist nicht mehr zur Prüfung offen — schon entschieden?';
  end if;

  if b.zahlart = 'vorkasse' then
    if p_status not in ('genehmigt', 'teilweise', 'abgelehnt') then
      raise exception 'User-Zahlung: genehmigen, teilweise genehmigen oder ablehnen.';
    end if;
  elsif p_status not in ('geprueft', 'besprechung') then
    raise exception 'Kreditkarte und Bar: prüfen oder zur Besprechung vermerken.';
  end if;

  if p_status in ('besprechung', 'teilweise', 'abgelehnt') and grund is null then
    raise exception 'Bitte einen Kommentar angeben.';
  end if;
  if p_status = 'teilweise'
     and (p_betrag is null or p_betrag <= 0 or p_betrag >= b.betrag) then
    raise exception 'Der genehmigte Betrag muss zwischen 0 und % liegen.', b.betrag;
  end if;

  update spesen_beleg set
    status           = p_status,
    genehmigt_betrag = case p_status when 'teilweise' then round(p_betrag, 2)
                                     when 'abgelehnt' then 0
                                     else b.betrag end,
    entscheid_grund  = grund,
    entscheid_von    = auth.jwt() ->> 'email',
    entscheid_am     = now()
  where id = p_id;
end;
$function$;

create or replace function public.beleg_umkontieren(p_id bigint, p_konto text, p_auftrag text)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b spesen_beleg;
begin
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if not darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer, b.positionen, b.zahlart) then
    raise exception 'Für diesen Beleg bist du nicht zuständig.';
  end if;
  if b.status <> 'eingereicht' then
    raise exception 'Nur eingereichte Belege lassen sich umkontieren.';
  end if;
  if jsonb_array_length(coalesce(b.positionen, '[]'::jsonb)) > 1 then
    raise exception 'Aufgeteilte Belege bitte ablehnen und vom Erfasser korrigieren lassen.';
  end if;
  if not exists (select 1 from spesen_konto where nummer = p_konto) then
    raise exception 'Konto % gibt es nicht.', p_konto;
  end if;
  update spesen_beleg set konto_nummer = p_konto, auftrag_nr = p_auftrag,
                          positionen = null, geaendert = now()
  where id = p_id;
end;
$function$;

-- ============================================================
-- 2) Korrigieren: Betrag, MwSt und Datum bei Kreditkarte/Bar
-- ============================================================

create or replace function public.beleg_korrigieren(p_id bigint, p_betrag numeric,
                                                    p_mwst numeric, p_datum date)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b spesen_beleg;
begin
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;
  if not darf_entscheiden(b.geraet, b.auftrag_nr, b.konto_nummer, b.positionen, b.zahlart) then
    raise exception 'Für diesen Beleg bist du nicht zuständig.';
  end if;
  if b.status <> 'eingereicht' then
    raise exception 'Nur eingereichte Belege lassen sich korrigieren.';
  end if;
  if b.zahlart = 'vorkasse' then
    raise exception 'Bei User-Zahlungen den Betrag über „teilweise genehmigen" anpassen.';
  end if;
  if jsonb_array_length(coalesce(b.positionen, '[]'::jsonb)) > 1 then
    raise exception 'Aufgeteilte Belege bitte ablehnen und vom Erfasser korrigieren lassen.';
  end if;
  if p_betrag is null or p_betrag <= 0 then
    raise exception 'Der Betrag muss grösser als 0 sein.';
  end if;
  if p_mwst is null or p_mwst < 0 or p_mwst > 100 then
    raise exception 'Ungültiger MwSt-Satz.';
  end if;
  if p_datum is null then raise exception 'Bitte ein Belegdatum angeben.'; end if;

  -- Betrag und Satz stehen bei einfachen Belegen auch in der einen Position.
  update spesen_beleg set
    betrag      = round(p_betrag, 2),
    mwst        = p_mwst,
    beleg_datum = p_datum,
    monat       = to_char(p_datum, 'YYYY-MM'),
    positionen  = case when positionen is null then null
                       else jsonb_build_array(jsonb_set(jsonb_set(positionen -> 0,
                              '{betrag}', to_jsonb(round(p_betrag, 2))), '{mwst}', to_jsonb(p_mwst))) end,
    geaendert   = now()
  where id = p_id;
end;
$function$;

revoke execute on function public.beleg_korrigieren(bigint, numeric, numeric, date) from public, anon;
grant  execute on function public.beleg_korrigieren(bigint, numeric, numeric, date) to authenticated;
grant  execute on function public.ist_pruefer() to authenticated;
grant  execute on function public.freigabe_liste() to authenticated;

-- =====================================================================
-- geraete.sql
-- =====================================================================

-- geraete.sql — Geräte (z. B. Kreditkarten-Geräte) je Kostenstelle
--
-- Setzt etappe1-status.sql, etappe2-freigabe.sql und
-- kommentar-korrektur-personen.sql voraus.
-- Erst im Test-Projekt ausführen, nach Olis OK im Live-Projekt.
-- Mehrfaches Ausführen schadet nicht.
--
-- Der Admin legt Geräte an, gibt ihnen einen Namen und eine KST.
-- Wer auf diese KST mit Kreditkarte bucht, wählt das Gerät aus
-- (gibt es nur eines, ist es vorgewählt). In der Übersicht lässt sich
-- danach filtern — der Export läuft pro Gerät.
--
-- Achtung Namen: die alte Spalte spesen_beleg.geraet ist die E-Mail der
-- erfassenden Person. Die neuen Geräte heissen in der Datenbank darum
-- "zahlgeraet", in der App "Gerät".

create table if not exists public.spesen_zahlgeraet (
  id         bigint generated by default as identity primary key,
  name       text not null,
  auftrag_nr text not null,                 -- KST, auf die das Gerät gehört
  aktiv      boolean not null default true, -- inaktiv: nicht mehr wählbar, alte Belege behalten es
  erstellt   timestamptz not null default now()
);

alter table public.spesen_zahlgeraet enable row level security;

-- Lesen: alle Angemeldeten (für die Auswahl beim Erfassen und für die Namen)
drop policy if exists zahlgeraet_lesen on public.spesen_zahlgeraet;
create policy zahlgeraet_lesen on public.spesen_zahlgeraet
  for select to authenticated using (true);
-- Anlegen, ändern, löschen: nur Admin
drop policy if exists zahlgeraet_admin on public.spesen_zahlgeraet;
create policy zahlgeraet_admin on public.spesen_zahlgeraet
  for all to authenticated using (ist_admin()) with check (ist_admin());

grant select, insert, update, delete on public.spesen_zahlgeraet to authenticated;

-- Beleg: welches Gerät? Löschen eines Geräts, das in Belegen steckt,
-- verweigert die Datenbank (dann inaktiv setzen).
alter table public.spesen_beleg
  add column if not exists zahlgeraet_id bigint references public.spesen_zahlgeraet (id);
create index if not exists spesen_beleg_zahlgeraet_idx on public.spesen_beleg (zahlgeraet_id);

-- =====================================================================
-- kst-auswahl.sql
-- =====================================================================

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

commit;

-- Kontrolle: muss u. a. spesen_zuweisung, spesen_verlauf, spesen_zahlgeraet, spesen_kst_jahr zeigen
select table_name from information_schema.tables where table_schema = 'public' and table_name like 'spesen_%' order by 1;
