# Servidor interno (self-hosted) — 05/10/2026

**De:** sessão que montou `infra/servidor-interno/` · **Para:** banco e interface

## O que foi feito

O usuário decidiu rodar o Dash num **servidor Linux da empresa**, só na rede
interna, com e-mail pelo Office 365. Ficou em `infra/servidor-interno/`:
Supabase enxuto em Docker (Postgres + GoTrue + PostgREST + Nginx), scripts de
instalação, atualização, publicação do site, backup e restauração, e um guia
para a TI (`infra/servidor-interno/README.md`).

Testado de ponta a ponta em 05/10/2026 com as 36 migrations: cadastro pela
tela, `bootstrap_admin`, login, apontamento gravado, recuperação de senha
pelo link do e-mail, backup e restauração num banco zerado.

**Nenhuma migration, tabela de `public` ou tela foi alterada.**

## O que o lado do banco precisa saber

1. **Tabela nova fora de `public`:** `supabase_migrations.schema_migrations`
   (`version text pk, name text, statements text[]`), criada pelo
   `scripts/atualizar-banco.sh` para anotar o que já foi aplicado. É o mesmo
   formato da CLI do Supabase. Vale registrar na `02-referencia-tecnica.md`.
2. **As migrations não são idempotentes**, ao contrário do que diz o
   `docs/database/README.md` ("rodar de novo não quebra nada"): a primeira,
   `20260915120000_create_shifts.sql`, falha com
   `relation "shifts" already exists`. Por isso o script anota cada passo.
3. **`supabase/INSTALAR.md` está desatualizado:** diz 20 permissões; hoje são
   **21** (`work_orders.manage`, da migration `20261004110000`).
4. **Toda migration nova precisa rodar dentro de uma transação** (o script usa
   `psql -1`). Nenhuma atual tem `begin`/`commit` próprio, e não deveria ter.
5. O seed estrutural entra no script como o passo `20260925100001`, logo depois
   da migration 13, como manda o `INSTALAR.md`. Se essa ordem mudar, ajuste a
   variável `SEED_VERSAO` no script.

## O que o lado da interface precisa saber

- O site é publicado em `/Dashboard-Tomadas/` também no servidor, porque o
  `base` do Vite é fixo nesse caminho. Se o `base` mudar, ajuste
  `nginx/default.conf.template`.
- `VITE_SUPABASE_URL` aponta para o próprio servidor. Site e API ficam na mesma
  origem, então não há CORS.

## Pendente (do lado do usuário e da TI)

- Certificado da CA interna e nome DNS do servidor.
- E-mail: SMTP AUTH na caixa do sistema (caminho A, que a Microsoft desliga
  por padrão no fim de 12/2026) ou conector de relay (caminho B, definitivo).
