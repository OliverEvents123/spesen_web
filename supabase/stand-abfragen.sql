-- Holt den kompletten Aufbau der Spesen-Datenbank in EINER Tabelle:
-- Spalten, Zugriffsregeln (auch Storage), Funktionen, Trigger, Indizes,
-- Einschränkungen, Rechte, RLS-Schalter und Buckets.
--
-- Liest nur, ändert nichts. Im Supabase SQL Editor ausführen,
-- Ergebnis als CSV herunterladen und an Claude geben.

select 'spalte' as art, table_name::text as objekt, column_name::text as name,
       concat_ws(' | ', data_type::text, 'null=' || is_nullable,
                 'default=' || column_default) as details
from information_schema.columns
where table_schema = 'public' and table_name like 'spesen%'

union all
select 'policy', (schemaname || '.' || tablename)::text, policyname::text,
       concat_ws(' | ', cmd, array_to_string(roles, ','),
                 'using=' || qual, 'check=' || with_check)
from pg_policies
where schemaname in ('public', 'storage')

union all
select 'funktion', 'public', p.proname::text, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'

union all
select 'trigger', c.relname::text, t.tgname::text, pg_get_triggerdef(t.oid)
from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname = 'public'

union all
select 'index', tablename::text, indexname::text, indexdef
from pg_indexes
where schemaname = 'public' and tablename like 'spesen%'

union all
select 'constraint', conrelid::regclass::text, conname::text, pg_get_constraintdef(oid)
from pg_constraint
where connamespace = 'public'::regnamespace

union all
select 'recht', table_name::text, grantee::text,
       string_agg(privilege_type::text, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'spesen%'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee

union all
select 'rls', relname::text, '', case when relrowsecurity then 'an' else 'AUS' end
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'

union all
select 'bucket', 'storage', name::text,
       concat_ws(' | ', 'public=' || public, 'limit=' || file_size_limit,
                 'typen=' || array_to_string(allowed_mime_types, ','))
from storage.buckets

order by 1, 2, 3;
