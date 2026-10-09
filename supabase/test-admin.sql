-- test-admin.sql
-- Im TEST-Projekt ausführen, NACHDEM die Anmeldekonten unter
-- Authentication → Users → Add user angelegt sind (mit "Auto Confirm User").
-- Macht sie zu Admins der App. Danach lassen sich alle weiteren Benutzer
-- in der App selbst unter Admin → Benutzer anlegen.

insert into public.spesen_benutzer (email, name, rolle) values
  ('oliver@eventorganisation.ch', 'Oliver', 'admin'),
  ('admin@eventorganisation.ch',  'Notfall-Admin', 'admin')
on conflict (email) do update set rolle = 'admin', aktiv = true;
