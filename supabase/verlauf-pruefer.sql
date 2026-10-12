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
