# Dash de Produção — WEG Itajaí

Apontamento de produção e acompanhamento de metas da Seção Tomadas e
Interruptores. Vite + React + TypeScript.

> **Repositório público.** Nenhum dado real de produção, senha, chave ou
> connection string entra aqui. A URL do projeto Supabase e a `anon key` ficam só
> no `.env.local`; os números que aparecem no código de demonstração são
> fictícios.

## O que existe neste repositório

| Pasta | O que é |
|---|---|
| `prototype/` | **A interface** do sistema (o nome da pasta é provisório, ver D44). Publicada no GitHub Pages |
| `src/lib/` | A **camada de dados** (`repositories/`, `supabase.ts`, `metas.ts`…), que a interface usa para falar com o Supabase |
| `src/test/` | Testes de unidade da camada de dados |
| `e2e/` | Teste de fumaça no navegador (Playwright), no modo de demonstração |
| `supabase/` | Migrations, seeds, testes SQL, importação da planilha e calendário |
| `docs/database/` | **Fonte da verdade sobre o banco**: visão geral, referência técnica, decisões (ADR) e ata de mudanças |

A UI antiga (telas de `src/`) foi aposentada em 03/10/2026, antes de ir para
produção: a interface de `prototype/` é a única. O Google Apps Script
(`Main.gs`) foi aposentado em 05/10/2026 e saiu do repositório (D64). Até a
virada, a fábrica registra a produção à mão na planilha `.xlsx`, que entra no
banco pelo extrator de `supabase/import/`.

## Como rodar

```bash
npm ci
npm run dev            # interface → http://localhost:8090/
```

Sem configuração, a interface abre no **modo de demonstração**: dados e contas
fictícios, sem servidor (`gestor@demo.weg`, senha `demo123`, e as outras contas
listadas na tela de entrada).

Para falar com o Supabase, crie um `.env.local` na raiz (não versionado):

```
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Para construir telas contra a **área de acesso da camada de dados** sem banco,
use `VITE_DATA_SOURCE=mock` (só em `npm run dev`; um build ignora). As contas
estão em `src/lib/repositories/mock/contas.ts`, com a senha `123456`.

## Publicação

O GitHub Pages publica a interface a cada push na `main`
(`.github/workflows/deploy.yml`). Ela sai em modo de demonstração, a menos que a
variável do repositório `DATA_SOURCE` valha `supabase` e existam os segredos
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (*Settings → Secrets and variables
→ Actions*). Cada PR passa por tipos, lint, testes e build (`ci.yml`).

## Verificação

```bash
npm run typecheck      # tipos (interface e camada de dados)
npm run lint           # eslint
npm test               # testes de unidade (vitest)
npm run test:e2e       # fumaça no navegador (Playwright)
npm run build          # build da interface → prototype/dist
npm run test:integration   # camada de dados contra o Supabase (precisa de .env.local)
```

## Antes de mexer no banco

Leia [`docs/database/README.md`](docs/database/README.md). A regra do
[`CLAUDE.md`](CLAUDE.md) vale para pessoas e para o Claude Code: **toda mudança
no banco atualiza `docs/database/` no mesmo commit**, e a ata
([`CHANGELOG.md`](docs/database/CHANGELOG.md)) sempre. Um workflow do GitHub
reprova o PR que mexer em `supabase/migrations/` sem entrada na ata.
