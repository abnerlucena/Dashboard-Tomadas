# Adaptador de leitura da UI nova — o que a interface vai fazer e o que pede ao banco

> Data: 01/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde ao item 2 da ordem sugerida em
> [`2026-10-01-direcionamento-para-a-ui.md`](2026-10-01-direcionamento-para-a-ui.md) (§ 8)
> e continua [`2026-10-01-previa-da-ui-nova-no-pages.md`](2026-10-01-previa-da-ui-nova-no-pages.md).

## Em uma linha

A UI nova passa a ler os dados reais pela camada de vocês (`data.production.getAll`,
`machines.getMachines`, `targets.getMetas`/`getHistory`, `calendar.getHolidays`).
Nesta fase ela **só lê**. A prévia em `/nova/` poderá mostrar o banco de verdade
assim que o gestor ligar uma variável no GitHub.

## O que a interface faz (nada disso toca `src/lib/` nem `supabase/`)

| Onde | O quê |
|---|---|
| `prototype/src/data/fromBackend.ts` (novo) | Converte `ProdRecord`, `Machine`, metas e feriados no formato das telas |
| `prototype/src/data/machines.ts` (**compartilhado**) | Os dados gerados viram o conjunto padrão. Depois do login, o conjunto real o substitui (detalhes abaixo) |
| `prototype/src/App.tsx` e telas | Carregam os dados depois do login. As telas que ainda não estão ligadas mostram um aviso em vez de números inventados |

### Mudanças em `machines.ts`, que é compartilhado: preciso do de acordo de vocês

1. **As constantes viram `export let`**, mais uma `instalarDados()`. Mesmo truque
   da `data` em `repositories/index.ts`: a importação é uma ligação viva. As telas
   não mudam de assinatura.
2. **Retrabalho fora da produção** (§ 4.1 da nota de 27/09). `scopeMachine` e o
   `produced` passam a somar só `!o.rework`. Isso também corrige os números da
   demonstração.
3. **`dayKey` ganha o ano.** Com dados de mais de um ano, 05/03/2025 e 05/03/2026
   colidiam.
4. **A meta de um recorte é soma, não multiplicação** (D08, nota de 27/09, § 3).
   - Com dados reais, a meta de cada máquina no período é
     `Σ targetQuantity where countsTowardTarget`, e o atingimento é
     `Σ goodQuantity / Σ targetQuantity`.
   - A meta por dia, usada só para a linha de ritmo dos gráficos, sai de
     `metaDoTurno` (`src/lib/metas.ts`) com a lotação padrão. Não há conta própria.

### Como cada campo é preenchido

| Tela precisa de | Vem de | Observação |
|---|---|---|
| Produção | `goodQuantity` | retrabalho fica em `reworkQuantity` |
| Meta do apontamento | `targetQuantity` quando `countsTowardTarget` | hora extra e dia anulado ficam fora |
| OP do apontamento | `ordensProducao[].ordemId` | os importados aparecem como `IMPORTADO` |
| Quem registrou | `savedBy` / `savedAt` | importados sem autor aparecem como "Importado" |
| Linha (Montagem/Embalagem/Granel) | **não está no contrato** | por enquanto, pelo nome do centro (ver pedido 3) |
| Regime (2 ou 3 turnos) | deduzido: 3 se há apontamento regular no T3 | não existe coluna (lacuna 5) |
| Dias úteis | seg–sex menos os feriados de dia inteiro de `getHolidays` | |
| Janela de dados | menor e maior `date` dos apontamentos | |
| Material, motivo de retrabalho, minutos por OP | **não existem** | as telas mostram "–" (lacunas 1, 2 e 4) |

### Telas ligadas nesta fase e telas que esperam

- **Ligadas, só leitura:** Dashboard, linhas, turnos, Ranking, Retrabalho (sem
  motivo), Histórico (sem edição), Relatórios, Modo TV, Usuários (esta já estava
  ligada).
- **Mostram "ainda não ligada ao banco":**
  - Apontamento: gravar é a próxima etapa (`saveEntries` com `operatorCount`).
  - Metas: metas reais com `basis` e `getMetasEm`, etapa seguinte.
  - OPs e Feedbacks: não há tabela de OP nem de mensagens (lacuna 3).

### Sessão separada do app antigo

No Pages os dois apps ficam na mesma origem (`/` e `/nova/`). Até a virada, o antigo fala
com o Apps Script. Por isso a UI nova **deixou de usar `prod_session_v3`** e guarda a sessão
em `dash-proto.session.<fonte>`. Com a mesma chave, entrar num app derrubava a sessão do
outro.

O login do Supabase em si (`sb-…-auth-token`, do supabase-js) continua compartilhado, e
isso é coerente: mesmo banco, mesma pessoa. Fica um efeito colateral pequeno do lado de
vocês, sem pressa. `supabase/helpers.ts` e `recovery.ts` chamam `clearSession()`, que
apaga a chave do app antigo mesmo quando quem chamou foi a UI nova. Antes da virada isso
pode tirar alguém do app antigo, caso dê erro de token na prévia. Se quiserem, a função
pode receber a chave como parâmetro.

## O que a interface pede ao banco

1. **De acordo com as mudanças em `machines.ts`** (itens 1 a 4 acima). Se preferirem
   outro caminho, respondam numa nota antes do merge. A PR é a mesma da prévia.
2. **Redirect URL do Auth.** A recuperação de senha precisa aceitar
   `https://abnerlucena.github.io/Dashboard-Tomadas/nova/`. Se o padrão
   `…/Dashboard-Tomadas/*` da D45 já está cadastrado em *Authentication → URL
   Configuration*, a prévia já está coberta. Só confirmem.
3. **Proposta de contrato, sem pressa:** `process?: "assembly" | "packaging"` em
   `Machine` (`src/lib/api.ts`), vindo de `machines.process`.
   - A UI agrupa por linha, e hoje adivinha pelo nome.
   - A UI trata "Granel" como agrupamento de tela, como vocês sugeriram na nota de
     27/09, então não precisa de coluna nova para ele.
4. **Confirmar a RLS para quem não entrou.** A prévia fica num endereço público, com a
   `anon key` no pacote (como todo app Supabase). A UI só busca dados **depois do
   login**. Mesmo assim, peço que confirmem que `production_summary`,
   `production_orders` e `profiles` não devolvem nada ao papel `anon`.
5. **Mais tarde:** um `getAll` por período (`from`/`to`). Hoje vêm todos os
   apontamentos. Com cerca de 2.500 linhas isso serve, mas vai pesar com um ano
   de dados. Não bloqueia nada agora.

## Como a prévia liga o banco (sem segredo no repositório)

O workflow da prévia lê três itens do GitHub (*Settings → Secrets and variables →
Actions*), que o gestor cadastra:

| Nome | Tipo | Valor |
|---|---|---|
| `NOVA_DATA_SOURCE` | variável | `supabase` (vazio = demonstração) |
| `VITE_SUPABASE_URL` | segredo | URL do projeto |
| `VITE_SUPABASE_ANON_KEY` | segredo | `anon key` |

O app antigo continua sem essas variáveis, como hoje. Na virada, vocês decidem como
ligá-lo. Se usarem os mesmos segredos, nada muda para a prévia.
