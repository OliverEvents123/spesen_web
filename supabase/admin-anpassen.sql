-- admin-anpassen.sql — Adminanpassungen an eingereichten und entschiedenen Belegen
--
-- Setzt live-gang.sql und user-zahlungen.sql voraus. Erst im Test-Projekt
-- ausführen, nach Olis OK im Live-Projekt. Supabase → SQL Editor → New
-- query → ganze Datei → Run. Mehrfaches Ausführen schadet nicht.
--
-- Ein Admin kann in der App mit „Adminanpassungen öffnen“ einen Beleg
-- ändern, der schon eingereicht oder entschieden ist: Betrag, MwSt, Datum,
-- Konto, KST (auch aufgeteilt), Bezahlt mit, Gerät, Kommentar. Status und
-- Entscheid bleiben — die Logik ist dieselbe wie beim Umkontieren (ein
-- eingereichter Beleg wird bei neuer KST/Konto neu zugeordnet).
-- Beispiel: Karte der KST 1212 versehentlich für KST 1213 verwendet — der
-- Admin stellt das Gerät richtig.
--
-- Der Verlauf hält jede Änderung mit dem Namen des Admins fest.

create or replace function public.beleg_admin_anpassen(p_id bigint, p_daten jsonb)
 returns void language plpgsql security definer set search_path = public as $function$
declare
  b           spesen_beleg;
  v_betrag    numeric := round((p_daten ->> 'betrag')::numeric, 2);
  v_mwst      numeric := (p_daten ->> 'mwst')::numeric;
  v_datum     date    := (p_daten ->> 'beleg_datum')::date;
  v_konto     text    := nullif(trim(coalesce(p_daten ->> 'konto_nummer', '')), '');
  v_auftrag   text    := nullif(trim(coalesce(p_daten ->> 'auftrag_nr', '')), '');
  v_zahlart   text    := p_daten ->> 'zahlart';
  v_geraet_id bigint  := nullif(p_daten ->> 'zahlgeraet_id', '')::bigint;
  v_pos       jsonb   := case when jsonb_typeof(p_daten -> 'positionen') = 'array'
                              and jsonb_array_length(p_daten -> 'positionen') > 1
                            then p_daten -> 'positionen' end;
  v_status    text;
begin
  if not ist_admin() then raise exception 'Nur Admins dürfen Belege anpassen.'; end if;
  select * into b from spesen_beleg where id = p_id for update;
  if not found then raise exception 'Beleg nicht gefunden.'; end if;

  if v_betrag is null or v_betrag <= 0 then raise exception 'Der Betrag muss grösser als 0 sein.'; end if;
  if v_mwst is null or v_mwst < 0 or v_mwst > 100 then raise exception 'Ungültiger MwSt-Satz.'; end if;
  if v_datum is null then raise exception 'Bitte ein Belegdatum angeben.'; end if;
  if v_konto is null or v_auftrag is null then raise exception 'Bitte Konto und KST angeben.'; end if;
  if v_zahlart is null or v_zahlart not in ('karte', 'bar', 'vorkasse') then
    raise exception 'Ungültige Zahlungsart.';
  end if;
  if v_pos is not null and abs((select sum((x ->> 'betrag')::numeric) from jsonb_array_elements(v_pos) x) - v_betrag) > 0.004 then
    raise exception 'Die Positionen ergeben nicht den Belegbetrag.';
  end if;

  -- Schon zurückbezahlt: Betrag und Zahlungsart bleiben, bis die Zahlung
  -- unter User-Zahlungen zurückgenommen ist
  if b.bezahlt_am is not null and (v_betrag <> b.betrag or v_zahlart <> b.zahlart) then
    raise exception 'Schon zurückbezahlt — Betrag und „Bezahlt mit“ erst nach dem Zurücknehmen der Zahlung ändern.';
  end if;

  -- Der Entscheid passt zur Zahlungsart: Kreditkarte/Bar „geprüft“,
  -- User-Zahlung „genehmigt“. Alles andere bleibt.
  v_status := case
    when v_zahlart = 'vorkasse' and b.status = 'geprueft'  then 'genehmigt'
    when v_zahlart <> 'vorkasse' and b.status = 'genehmigt' then 'geprueft'
    else b.status end;

  update spesen_beleg set
    beleg_datum      = v_datum,
    monat            = to_char(v_datum, 'YYYY-MM'),
    betrag           = v_betrag,
    mwst             = v_mwst,
    konto_nummer     = v_konto,
    auftrag_nr       = v_auftrag,
    positionen       = v_pos,
    zahlart          = v_zahlart,
    zahlgeraet_id    = case when v_zahlart = 'karte' then v_geraet_id end,
    kommentar        = nullif(trim(coalesce(p_daten ->> 'kommentar', '')), ''),
    status           = v_status,
    -- Was gebucht wird, folgt dem neuen Betrag (teilweise: höchstens er)
    genehmigt_betrag = case when b.genehmigt_betrag is null then null
                            when v_status = 'teilweise' then least(b.genehmigt_betrag, v_betrag)
                            when v_status = 'abgelehnt' then 0
                            else v_betrag end,
    geaendert        = now()
  where id = p_id;
end;
$function$;

revoke execute on function public.beleg_admin_anpassen(bigint, jsonb) from public, anon;
grant  execute on function public.beleg_admin_anpassen(bigint, jsonb) to authenticated;
