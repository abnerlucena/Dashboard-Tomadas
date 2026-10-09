-- ════════════════════════════════════════════════════════════════════════════
-- Prepara um PostgreSQL comum para receber a cópia do banco da nuvem (D68)
-- ════════════════════════════════════════════════════════════════════════════
-- Onde rodar: no pgAdmin, no Query Tool do banco NOVO e VAZIO (por exemplo
-- dash_producao), conectado como postgres. Uma vez só, ANTES do Restore.
-- Passo a passo completo: README.md desta pasta.
--
-- O que faz, e por quê:
--   1. Confere que o banco está vazio. Se não estiver, para sem mexer em nada.
--   2. Cria os papéis que o Supabase tem e um PostgreSQL comum não tem. O
--      backup da nuvem dá permissões a eles (as regras de acesso, RLS, dizem
--      "to authenticated") e falha se não existirem. Ninguém entra com eles:
--      são todos NOLOGIN.
--   3. Cria o schema extensions, com pgcrypto e uuid-ossp, onde o Supabase
--      guarda as extensões.
--   4. Deixa o fuso do banco em UTC, como na nuvem. As funções que precisam
--      do horário de Brasília já convertem sozinhas; o resto (current_date,
--      now()::date) tem de se comportar igual nos dois lugares.
--   5. Apaga o schema public, que está vazio: o backup traz o próprio
--      "create schema public" e falharia com "already exists".
--
-- Se o Restore falhar (ele roda numa transação só e não deixa resto), corrija
-- o motivo e rode o Restore de novo. Este script não precisa ser repetido.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_papel text;
begin
  -- 1. O banco tem de estar vazio
  if not (select rolsuper from pg_roles where rolname = current_user) then
    raise exception 'Rode este script como postgres (superusuário). Usuário atual: %', current_user;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'auth') then
    raise exception 'O banco "%" já tem o schema auth: parece que já recebeu uma cópia. Use um banco novo.',
      current_database();
  end if;

  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public')
     or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')
     or exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public')
  then
    raise exception 'O banco "%" não está vazio (há objetos em public). Crie um banco novo para a cópia.',
      current_database();
  end if;

  -- 2. Papéis do Supabase (existem no servidor todo, não só neste banco)
  foreach v_papel in array array['anon', 'authenticated', 'service_role', 'authenticator',
                                 'supabase_admin', 'supabase_auth_admin', 'dashboard_user'] loop
    if not exists (select 1 from pg_roles where rolname = v_papel) then
      execute format('create role %I nologin', v_papel);
    end if;
  end loop;
  -- Como no Supabase: as permissões dos três papéis da API não se somam, e o
  -- service_role ignora as regras de acesso. O authenticator é quem a API
  -- (PostgREST) usaria para assumir cada um deles; aqui, só fica pronto.
  alter role anon noinherit;
  alter role authenticated noinherit;
  alter role service_role noinherit bypassrls;
  alter role authenticator noinherit;
  grant anon, authenticated, service_role to authenticator;

  -- 4. Fuso igual ao da nuvem (vale para as conexões novas, inclusive a do Restore)
  execute format('alter database %I set timezone to %L', current_database(), 'UTC');
end $$;

-- 3. Extensões no mesmo lugar que no Supabase
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- 5. O backup recria o public
drop schema public;

select 'Pronto. Agora faça o Restore do backup da nuvem neste banco (README.md, passo 4).' as proximo_passo;
