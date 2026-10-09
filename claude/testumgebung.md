# Testumgebung einrichten

**Eingerichtet am 09.10.2026:** Projekt `jqegbngpuflymvpuvvvf`
(https://jqegbngpuflymvpuvvvf.supabase.co), eigene Organisation.
Edge Functions mit „Verify JWT with legacy secret" **aus** — sie prüfen die
Anmeldung selbst, und neue Projekte signieren nicht mehr mit dem alten Secret.

Ziel: `spesen.tit-pit.ch/test/` läuft auf einem eigenen Supabase-Projekt.
Was dort passiert, berührt die echten Belege nicht.

## Einmalig einrichten

1. **Projekt anlegen** — supabase.com → New project. Name `Spesentool-Test`,
   Region Central EU (Frankfurt), Datenbank-Passwort sicher ablegen.
   (Free-Plan: höchstens zwei aktive Projekte. Ist das Limit erreicht, eines
   pausieren oder Plan wechseln.)
2. **Datenbank aufbauen** — im neuen Projekt SQL Editor → New query →
   Inhalt von `supabase/schema.sql` → Run. Legt Tabellen, Regeln, Trigger,
   Rechte und den Bucket `belege` an.
3. **Anmeldung einstellen** — Authentication → Sign In / Providers:
   „Allow new users to sign up" **aus**, „Confirm email" **aus**,
   anonyme Anmeldung **aus**.
4. **Edge Functions** — Edge Functions → Deploy a new function → Via Editor:
   - `auftragsnummern` mit dem Code aus `supabase/functions/auftragsnummern/index.ts`
   - `benutzer` mit dem Code aus `supabase/functions/benutzer/index.ts`
   - Edge Functions → Secrets: `FM_HOST`, `FM_DATABASE`, `FM_LAYOUT`,
     `FM_USER`, `FM_PASSWORD` wie im Live-Projekt. Danach beide Functions
     **neu deployen**.
5. **Erste Benutzer** — Authentication → Users → Add user → Create new user,
   „Auto Confirm User" an: `oliver@eventorganisation.ch` und
   `admin@eventorganisation.ch`. Dann `supabase/test-admin.sql` im SQL Editor
   ausführen — macht beide zu Admins.
6. **Kontenplan kopieren** — `supabase/konten-kopieren.sql` im **Live**-Projekt
   ausführen, die eine Ergebniszelle kopieren und im **Test**-Projekt ausführen.
7. **App umstellen** — Project Settings → API Keys: URL und *publishable* Key
   (nicht den secret/service_role!) an Claude geben. Claude trägt sie in
   `test/konfig.js` ein und passt das Banner an.

## Danach: so wird gebaut

1. Claude baut in `test/` und bringt es nach `main` → sichtbar unter `/test/`,
   die echte App bleibt unberührt.
2. Oli testet unter `/test/`.
3. Oli sagt „live" → Claude übernimmt die Dateien aus `test/` in die
   Hauptdateien (ohne `test/index.html` und `test/konfig.js`).
4. Datenbankänderungen kommen als `.sql`-Datei: erst im Test-Projekt
   ausführen, nach dem OK dieselbe Datei im Live-Projekt. `schema.sql` wird
   jeweils mitgeführt, damit sie den aktuellen Stand beschreibt.
