-- ════════════════════════════════════════════════════════════════════════════
-- Conferência da cópia: rode igual na NUVEM e no PostgreSQL novo, e compare (D68)
-- ════════════════════════════════════════════════════════════════════════════
-- Só lê; não altera nada. Pode rodar no banco de produção.
-- No pgAdmin: Query Tool → colar → Executar (F5). Sai uma tabela só, com
-- uma linha por item. As duas tabelas (nuvem e cópia) têm de ser IGUAIS,
-- exceto a linha "postgresql" se as versões menores forem diferentes.
--
--   linhas      quantidade de linhas da tabela
--   assinatura  resumo do conteúdo inteiro da tabela: se uma vírgula mudou
--               em qualquer linha, a assinatura muda
--
-- Se só as tabelas de produção divergirem, alguém gravou na nuvem depois do
-- backup: o ensaio vale assim mesmo; na troca de verdade, a nuvem tem de
-- estar parada (README.md, "A troca").
-- ════════════════════════════════════════════════════════════════════════════

with tabelas as (
  select n.nspname as esquema, c.relname as tabela
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
),
contagem as (
  select esquema, tabela,
         query_to_xml(format(
           'select count(*) as n,
                   left(md5(coalesce(string_agg(t::text, %L order by t::text collate "C"), %L)), 12) as h
              from %I.%I t', '|', '', esquema, tabela), false, true, '') as x
    from tabelas
)
select item, valor from (
  select 1 as ordem, 'postgresql' as item, current_setting('server_version') as valor
  union all
  select 2, 'fuso do banco', current_setting('TimeZone')
  union all
  select 3, 'versão do login (auth)', (select max(version)::text from auth.schema_migrations)
  union all
  select 4, 'objetos em public: tabelas · views · funções · gatilhos · regras de acesso · índices',
         concat_ws(' · ',
           (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r', 'p')),
           (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('v', 'm')),
           (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'),
           (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
              join pg_namespace n on n.oid = c.relnamespace
             where not t.tgisinternal and n.nspname in ('public', 'auth')),
           (select count(*) from pg_policies where schemaname = 'public'),
           (select count(*) from pg_indexes where schemaname = 'public'))
  union all
  select 5, esquema || '.' || tabela,
         (xpath('/row/n/text()', x))[1]::text || ' linhas · ' || (xpath('/row/h/text()', x))[1]::text
    from contagem
) r
order by ordem, item;
