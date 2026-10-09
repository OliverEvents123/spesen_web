-- konten-kopieren.sql
-- Damit die Testdatenbank denselben Kontenplan hat.
--
-- Schritt 1: im LIVE-Projekt ausführen. Liest nur, ändert nichts.
--            Das Ergebnis ist eine einzige Zelle mit fertigem SQL.
-- Schritt 2: diese Zelle kopieren und im TEST-Projekt ausführen.

select 'insert into public.spesen_konto '
    || '(nummer, bezeichnung, mwst, sortierung, aktiv, auftrag_modus, auftrag_liste) values '
    || string_agg(format('(%L, %L, %s, %s, %L, %L, %L)',
                         nummer, bezeichnung, mwst, sortierung, aktiv,
                         auftrag_modus, auftrag_liste),
                  ', ' order by sortierung, nummer)
    || ';' as sql_fuer_test
from public.spesen_konto;
