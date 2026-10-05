#!/bin/sh
# ─── Gera o .env com segredos novos ───────────────────────────
# Uso (na pasta infra/servidor-interno):
#   sh scripts/gerar-segredos.sh                          cria o .env
#   sh scripts/gerar-segredos.sh --certificado-provisorio também gera um
#                                                         certificado autoassinado
# Não sobrescreve um .env que já exista: trocar o JWT_SECRET de um banco em
# uso desloga todo mundo e invalida a chave publicada no site.
set -eu
cd "$(dirname "$0")/.."

command -v openssl >/dev/null || { echo "Falta o openssl (apt install openssl)."; exit 1; }

b64url() { openssl enc -base64 -A | tr '+/' '-_' | tr -d '='; }

jwt() { # $1 = papel (anon | service_role), $2 = segredo
  cabecalho=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
  agora=$(date +%s)
  validade=$((agora + 10 * 365 * 24 * 3600))   # 10 anos
  corpo=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$agora" "$validade" | b64url)
  assinatura=$(printf '%s' "$cabecalho.$corpo" | openssl dgst -binary -sha256 -hmac "$2" | b64url)
  printf '%s.%s.%s' "$cabecalho" "$corpo" "$assinatura"
}

if [ -f .env ]; then
  echo ".env já existe — nada foi alterado."
else
  # Só letras e números: a senha entra em URLs de conexão.
  senha_banco=$(openssl rand -hex 24)
  segredo_jwt=$(openssl rand -hex 32)
  anon=$(jwt anon "$segredo_jwt")
  servico=$(jwt service_role "$segredo_jwt")

  sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$senha_banco|" \
      -e "s|^JWT_SECRET=.*|JWT_SECRET=$segredo_jwt|" \
      -e "s|^ANON_KEY=.*|ANON_KEY=$anon|" \
      -e "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$servico|" \
      .env.exemplo > .env
  chmod 600 .env
  echo ".env criado com segredos novos. Agora edite: NOME_DO_SERVIDOR, ENDERECO e o bloco de e-mail."
fi

if [ "${1:-}" = "--certificado-provisorio" ]; then
  nome=$(sed -n 's/^NOME_DO_SERVIDOR=//p' .env)
  mkdir -p certificados
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout certificados/servidor.key -out certificados/servidor.crt \
    -subj "/CN=$nome" -addext "subjectAltName=DNS:$nome" 2>/dev/null
  chmod 600 certificados/servidor.key
  echo "Certificado PROVISÓRIO (autoassinado) para $nome criado em certificados/."
  echo "Os navegadores vão avisar que não é confiável. Troque pelo da CA da empresa."
fi
