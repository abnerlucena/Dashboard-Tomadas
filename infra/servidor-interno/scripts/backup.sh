#!/bin/sh
# ─── Backup diário do banco ───────────────────────────────────
# Gera backups/dash-AAAA-MM-DD_HHMMSS.dump (formato do pg_dump, compactado)
# e apaga os com mais de DIAS dias. Copie a pasta backups/ para OUTRA
# máquina: backup no mesmo disco não sobrevive a um disco queimado.
#
# Uso: sh scripts/backup.sh        (o README mostra como agendar no cron)
set -eu
cd "$(dirname "$0")/.."
DIAS=${DIAS:-30}

mkdir -p backups
arquivo="backups/dash-$(date +%Y-%m-%d_%H%M%S).dump"

# public (os dados), auth (contas e senhas criptografadas) e
# supabase_migrations (o que já foi aplicado). Como supabase_admin, o dono
# real dos schemas do Supabase: o usuário postgres não lê tudo do auth.
docker compose exec -T db pg_dump -U supabase_admin -d postgres -Fc \
  --schema=public --schema=auth --schema=supabase_migrations > "$arquivo.parcial"
mv "$arquivo.parcial" "$arquivo"
chmod 600 "$arquivo"

find backups -name 'dash-*.dump' -mtime +"$DIAS" -delete
echo "Backup: $arquivo ($(du -h "$arquivo" | cut -f1))"
