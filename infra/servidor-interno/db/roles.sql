-- Roda uma vez, na primeira subida do banco (pasta de dados vazia).
-- Dá às contas internas do Supabase a senha do .env (POSTGRES_PASSWORD).
-- Adaptado do arquivo oficial do Supabase self-hosted: lá também existe a
-- supabase_functions_admin, que só nasce com as Edge Functions — fora daqui.
-- Por isso cada conta só é alterada se existir; um erro nesta etapa
-- interromperia a montagem do banco inteira.
\set pgpass `echo "$POSTGRES_PASSWORD"`

select format('alter user %I with password %L', nome, :'pgpass')
  from unnest(array['authenticator', 'pgbouncer', 'supabase_auth_admin', 'supabase_storage_admin']) as nome
 where exists (select 1 from pg_roles where rolname = nome)
\gexec
