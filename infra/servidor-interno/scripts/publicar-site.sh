#!/bin/sh
# ─── Gera o site e põe no ar ──────────────────────────────────
# Compila o app (prototype/) apontando para ESTE servidor e copia o
# resultado para ./site, que o Nginx serve. Roda o Node dentro de um
# container: o servidor não precisa ter Node instalado.
#
# Uso (na pasta infra/servidor-interno), depois de cada atualização do código:
#   sh scripts/publicar-site.sh
set -eu
cd "$(dirname "$0")/.."
raiz=$(cd ../.. && pwd)

ler() { sed -n "s/^$1=//p" .env | tail -1; }
endereco=$(ler ENDERECO)
anon=$(ler ANON_KEY)
[ -n "$endereco" ] && [ -n "$anon" ] || { echo "ENDERECO e ANON_KEY precisam estar no .env."; exit 1; }

# Copia o código para dentro do container (sem node_modules nem .git) e
# compila lá: a pasta do repositório não ganha arquivos do root nem
# dependências de outro sistema.
mkdir -p site
rm -rf site/novo && mkdir site/novo

# Proxy que inspeciona HTTPS (comum em empresas): aponte NODE_EXTRA_CA_CERTS
# para o certificado da CA dele antes de rodar o script, e o npm confia nele.
extra_ca=""
if [ -n "${NODE_EXTRA_CA_CERTS:-}" ] && [ -f "$NODE_EXTRA_CA_CERTS" ]; then
  extra_ca="-v $NODE_EXTRA_CA_CERTS:/ca-extra.crt:ro -e NODE_EXTRA_CA_CERTS=/ca-extra.crt"
fi
# --network host e as variáveis de proxy: se a empresa usa proxy para sair
# para a internet, o npm dentro do container passa por ele também.
docker run --rm --network host \
  -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e https_proxy -e http_proxy -e no_proxy \
  $extra_ca \
  -v "$raiz":/codigo:ro -v "$PWD/site/novo":/saida \
  -e DONO="$(id -u):$(id -g)" \
  -e VITE_DATA_SOURCE=supabase \
  -e VITE_SUPABASE_URL="$endereco" \
  -e VITE_SUPABASE_ANON_KEY="$anon" \
  node:22-alpine sh -euc '
    mkdir /app
    tar -C /codigo --exclude=./node_modules --exclude=./.git --exclude=./infra -cf - . | tar -C /app -xf -
    cd /app
    npm ci --no-audit --no-fund --loglevel=error
    npm run build
    cp -r prototype/dist/. /saida/
    chown -R "$DONO" /saida
  '

rm -rf site/anterior
[ -d site/Dashboard-Tomadas ] && mv site/Dashboard-Tomadas site/anterior
mv site/novo site/Dashboard-Tomadas
rm -rf site/anterior
echo "Site publicado em $endereco/Dashboard-Tomadas/"
