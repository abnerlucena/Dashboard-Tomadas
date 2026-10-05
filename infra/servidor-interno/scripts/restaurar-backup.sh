#!/bin/sh
# ─── Restaura um backup ───────────────────────────────────────
# APAGA o que está no banco agora e põe no lugar o conteúdo do backup
# (dados, contas e o registro de migrations aplicadas).
#
# Uso (na pasta infra/servidor-interno):
#   sh scripts/restaurar-backup.sh backups/dash-2026-10-05_020000.dump
#
# Depois, se o código estiver mais novo que o backup:
#   sh scripts/atualizar-banco.sh
set -eu
cd "$(dirname "$0")/.."

arquivo=${1:-}
[ -f "$arquivo" ] || { echo "Uso: sh scripts/restaurar-backup.sh <arquivo .dump>"; exit 1; }

echo "Isto APAGA o banco atual e o substitui por: $arquivo"
printf 'Digite RESTAURAR para continuar: '
read -r resposta
[ "$resposta" = RESTAURAR ] || { echo "Cancelado."; exit 1; }

# Um backup de segurança do estado atual, antes de apagar.
sh scripts/backup.sh

# Login e API fora do ar enquanto o banco é trocado.
docker compose stop auth rest
docker compose exec -T db pg_restore -U supabase_admin -d postgres --clean --if-exists < "$arquivo"
docker compose start auth rest

echo "Restaurado. Confira entrando no app."
