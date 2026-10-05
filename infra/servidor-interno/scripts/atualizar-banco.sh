#!/bin/sh
# ─── Monta o banco do zero, ou aplica as migrations novas ─────
# Serve para a instalação e para cada atualização do código: aplica só o
# que ainda não foi aplicado, em ordem de nome, e anota cada passo em
# supabase_migrations.schema_migrations — a mesma tabela que a CLI do
# Supabase usa. As migrations NÃO podem rodar duas vezes (a primeira já
# falha com "relation already exists"), por isso a anotação.
#
# Ordem (supabase/INSTALAR.md): o seed estrutural entra logo depois da
# migration 20260925100000, antes das demais. Aqui ele vira um passo da
# lista, com versão 20260925100001, e é aplicado no lugar certo.
#
# Cada passo roda numa transação só, junto com a anotação: se falhar,
# nada dele fica no banco e o script para ali.
#
# Uso (na pasta infra/servidor-interno, com os containers no ar):
#   sh scripts/atualizar-banco.sh
set -eu
cd "$(dirname "$0")/.."
raiz=$(cd ../.. && pwd)
supa="$raiz/supabase"
SEED_VERSAO=20260925100001

psql_db() { docker compose exec -T db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 "$@"; }

psql_db -c "
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  name text,
  statements text[]
);" > /dev/null

aplicadas=$(psql_db -At -c "select version from supabase_migrations.schema_migrations")

{
  for f in "$supa"/migrations/*.sql; do echo "$(basename "$f" | cut -c1-14) $f"; done
  echo "$SEED_VERSAO $supa/seed/01_estrutural.sql"
} | sort | while read -r versao arquivo; do
  echo "$aplicadas" | grep -qx "$versao" && continue
  nome=$(basename "$arquivo" .sql)
  echo "→ ${arquivo#"$raiz"/}"
  { cat "$arquivo"
    printf '\n;\ninsert into supabase_migrations.schema_migrations (version, name) values (%s, %s);\n' \
      "'$versao'" "'$nome'"
  } | psql_db -1 -f - > /dev/null
done

# Idempotente por construção (índice único); roda sempre, para pegar anos novos.
echo "→ supabase/calendario/feriados.sql"
psql_db -f - < "$supa/calendario/feriados.sql" > /dev/null

# O PostgREST relê o schema: funções e views novas aparecem na API na hora.
psql_db -c "notify pgrst, 'reload schema';"

echo
echo "Conferência (INSTALAR.md): máquinas ativas, permissões, perfis, turnos"
psql_db -c "
select (select count(*) from public.machines where status = 'active') as maquinas,
       (select count(*) from public.permissions)                       as permissoes,
       (select count(*) from public.roles)                             as perfis,
       (select count(*) from public.shifts)                            as turnos,
       (select count(*) from supabase_migrations.schema_migrations)    as passos_aplicados;"
