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
