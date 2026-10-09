# Documentação do Banco de Dados — Dash de Produção

Esta pasta é a **fonte oficial** sobre o banco de dados do Dash de Produção (Supabase / PostgreSQL).
Ela registra **o que existe, como funciona, por que foi decidido assim e o que mudou**.

> **Estado atual do schema:** `v0.30.0` — **implementado** no Supabase, no projeto que virou o de
> produção (D55), com o histórico real carregado: 2.712 apontamentos de 20/12/2025 a 30/09/2026.
> A interface oficial é a de `prototype/` (D56). O Google Apps Script foi aposentado em 05/10/2026
> (D64): até a virada, a produção é registrada à mão na planilha `.xlsx`, que entra no banco pelo
> extrator de `supabase/import/`. O histórico de cada versão está no `CHANGELOG.md`.
> **Onde roda (D65):** a produção começa no Supabase da nuvem; depois, o mesmo banco
> passa para um servidor interno da WEG, sem pressa e com ensaio antes.

## Os documentos

| Arquivo | Para quem | Conteúdo |
|---|---|---|
| [01-visao-geral.md](01-visao-geral.md) | Gestão, apresentações, novos membros | Lógica do sistema em linguagem simples, com diagramas |
| [02-referencia-tecnica.md](02-referencia-tecnica.md) | Desenvolvedores, TI, DBA | Dicionário de dados, constraints, índices, triggers, funções, RLS |
| [03-decisoes.md](03-decisoes.md) | Todos | Registro de decisões (ADR): contexto, escolha e consequências |
| [CHANGELOG.md](CHANGELOG.md) | Todos | Ata de mudanças do schema, versão por versão |
| [cadernos/](cadernos/README.md) | Quem quer entender sem ser técnico | Seis PDFs curtos com analogias e diagramas, uma área do banco por caderno |

## Como montar um projeto novo

Rode, no SQL Editor do Supabase:

1. **as migrations de `supabase/migrations/`, em ordem de nome.** O nome começa
   com a data e a hora justamente para a ordem ser óbvia. **Cada uma roda uma vez
   só:** elas não são idempotentes, e a primeira já falha com `relation "shifts"
   already exists` se for rodada de novo. Quem aplica precisa anotar o que já
   aplicou (é o que o `atualizar-banco.sh` do servidor interno faz, D65). A
   ordem exata, com o seed no meio, está em [`supabase/INSTALAR.md`](../../supabase/INSTALAR.md).
2. **`supabase/seed/01_estrutural.sql`** — papéis, permissões, turnos, os 22
   centros de trabalho e as metas reais.
3. **`select public.bootstrap_admin('seu.email@empresa.com');`** depois de se
   cadastrar pela tela, para existir o primeiro administrador. Sem isso não há
   quem aprove ninguém.

> **Não existe mais um arquivo único com o schema inteiro.** O
> `_consolidado.sql` foi aposentado em 30/09/2026 (**D51**): ele prometia ser o
> schema completo e tinha parado seis versões atrás, o que é pior do que não
> existir — quem confiasse nele montaria um banco errado achando que estava certo.

## Normas de manutenção

Estas regras valem para pessoas **e** para o Claude Code (ver `CLAUDE.md` na raiz).

1. **Toda mudança no banco gera documentação no mesmo commit/PR.** Uma migration em
   `supabase/migrations/` sem entrada correspondente no `CHANGELOG.md` está incompleta.
2. **O que atualizar em cada mudança:**
   - `CHANGELOG.md` — sempre: nova entrada com versão, data, o que mudou e referência ao commit/PR.
   - `02-referencia-tecnica.md` — sempre que mudar tabela, coluna, tipo, regra, índice, trigger, função ou política.
   - `01-visao-geral.md` — quando a mudança altera algo que um usuário ou gestor perceberia.
   - `03-decisoes.md` — quando houve uma escolha com alternativas (nova decisão ou revisão de uma antiga).
3. **Decisões não são apagadas.** Uma decisão revista recebe status `Substituída por DXX`, e a nova é adicionada.
4. **Versão do schema** segue `MAJOR.MINOR.PATCH`:
   - `MAJOR` — mudança que quebra o frontend ou exige migração de dados (remover/renomear coluna ou tabela).
   - `MINOR` — adição compatível (nova tabela, nova coluna opcional, nova função).
   - `PATCH` — ajuste sem efeito estrutural (comentário, índice, correção de regra).
5. **Nunca registrar segredos aqui:** nada de senhas, `service_role key`, tokens ou dados pessoais.
   A `anon key` e a URL do projeto também ficam fora — elas vivem no `.env.local`.

## Como o app usa o banco

- `VITE_DATA_SOURCE` = `supabase` (padrão) ou `mock` (dados de mentira, só em desenvolvimento). Ver `src/lib/repositories/index.ts`. Até 05/10/2026 havia também `gas`, o Apps Script, aposentado (D64).
- `src/lib/repositories/` — o contrato (`types.ts`) e as fontes: `supabase/` usa as views e RPCs deste schema; `mock/` é a demonstração. Adaptadores em `supabase/adapters.ts` (produção boa como produção, meta zerada para hora extra e dia anulado).
- `src/lib/database.types.ts` — tipos do schema. **Regenerar após cada migration** (`npx supabase gen types typescript --project-id <ref>`, com login na CLI; ou o script de introspecção usado em 20/09/2026, que tem o mesmo formato).
- Pastas do banco: `supabase/migrations/`, `supabase/seed/`, `supabase/tests/` (verificação SQL com `rollback`), `supabase/import/`.
- Teste de ponta a ponta da camada: `npm run test:integration` (precisa de `.env.local` e das variáveis `TEST_*` de usuários de teste).

## Convenções de nomenclatura (resumo)

- Nomes de tabelas e colunas em **inglês**, `snake_case`, sem acentos.
- Tabelas no plural (`machines`), foreign keys com sufixo `_id` (`machine_id`).
- Data+hora terminam em `_at` (`created_at`); data pura não leva sufixo (`production_date`).
- Textos exibidos ao usuário ficam em português no frontend, nunca no nome da coluna.
