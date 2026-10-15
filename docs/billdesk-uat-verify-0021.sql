-- READ ONLY. Do not run until separately approved.
-- Select intended project spice-and-soul-uat (alytmroxgxmybvjgevhn) in the dashboard.
-- No audit rows, tokens, customer data, or credential values are selected.
BEGIN READ ONLY;

SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history;

SELECT c.oid::regclass AS table_name,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
WHERE c.oid = to_regclass('public.billdesk_raw_audit_logs');

SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_class c
CROSS JOIN LATERAL aclexplode(
  coalesce(c.relacl, acldefault('r', c.relowner))
) a
WHERE c.oid = to_regclass('public.billdesk_raw_audit_logs');

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'billdesk_raw_audit_logs';

SELECT r.rolname,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS can_truncate
FROM pg_roles r CROSS JOIN pg_class c
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND c.oid = to_regclass('public.billdesk_raw_audit_logs');

SELECT p.oid::regprocedure AS signature,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       pg_get_function_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result,
       ARRAY(SELECT setting FROM unnest(p.proconfig) AS setting
             WHERE setting LIKE 'search_path=%') AS search_path_setting,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'billdesk_record_raw_audit';

SELECT p.oid::regprocedure AS signature,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC'
            ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(
  coalesce(p.proacl, acldefault('f', p.proowner))
) a
WHERE n.nspname = 'public' AND p.proname = 'billdesk_record_raw_audit';

SELECT r.rolname, p.oid::regprocedure AS signature,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS schema_usage,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_roles r CROSS JOIN pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND n.nspname = 'public' AND p.proname = 'billdesk_record_raw_audit';

ROLLBACK;

-- Run this separate read-only block ONLY if migration_history above is non-null.
-- Manual SQL Editor installation may not have recorded a migration entry.
-- BEGIN READ ONLY;
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
-- ROLLBACK;
