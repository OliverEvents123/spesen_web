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
