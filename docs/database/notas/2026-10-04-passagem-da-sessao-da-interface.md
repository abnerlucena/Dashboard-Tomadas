# Passagem da sessão da interface — para a próxima sessão continuar

> Data: 04/10/2026 · Escrito pela sessão da **interface** · Para a **próxima sessão da interface**
> (e, de quebra, para a sessão do banco saber onde a interface parou).

Leia primeiro o `CLAUDE.md` da raiz (divisão de pastas entre interface e banco) e as notas
de 03/10 desta pasta. Este arquivo resume o estado e o caminho.

## Onde está o trabalho

- **Branch:** `claude/metas-capacidade-lab-u3y2or`.
- **PR #29 aberta, não mesclada:** "Apontamento, Histórico e Metas gravam no banco". Não
  mesclar sem o usuário pedir.
- **Repositório:** o remoto é `abnerlucena/Dash-v2`, renomeado para `Dashboard-Tomadas`. As
  ferramentas do GitHub (MCP) aceitam `owner: abnerlucena`, `repo: dash-v2`.
- **Se a #29 for mesclada:** recomece o branch a partir da `main`, com o mesmo nome, antes de
  qualquer trabalho novo (`git fetch origin main && git checkout -B
  claude/metas-capacidade-lab-u3y2or origin/main`). PR nova para o trabalho novo.

## Estado do produto

- **A UI antiga foi aposentada** em 03/10. `prototype/` é a única interface (D44, D56) e é
  publicada na raiz do GitHub Pages (`deploy.yml`).
- **Liga o banco:** a variável do repositório `DATA_SOURCE=supabase`, mais os segredos
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **O banco do Supabase já é o de produção** (D55). Ele tem 2.712 apontamentos reais
  conferidos. Cuidado ao gravar (ver "Testar no banco real").

| Tela | Com o banco |
|---|---|
| Acesso, Usuários, permissões | lê e grava |
| Dashboard, linhas, turnos, Ranking, Retrabalho, Relatórios, Modo TV | lê (`src/data/fromBackend.ts` → `installBackendData` em `machines.ts`) |
| **Apontamento** | grava (`saveEntries`, uma máquina por chamada; acrescenta ordens, D30) |
| **Histórico** | grava: excluir, mover, trocar turno e observação, no apontamento inteiro. Corrigir quantidade/OP espera o `updateEntry` |
| **Metas** | grava (`saveMetas`, só as alteradas; vigência ≥ hoje) |
| OPs, Feedbacks | "ainda não ligada ao banco" (não há tabela de OP nem de conversa) |
| **Calendário** | grava (feito em 04/10, ver `2026-10-04-calendario-ligado.md`) |
| Máquinas (cadastro) | **tela ainda não existe** |

**Peças-chave:**
- `prototype/src/data/fromBackend.ts`: o adaptador de leitura.
- `prototype/src/features/data/BackendGate.tsx`: carrega os dados depois do login.
- `features/data/connection.ts`: lista as telas ainda não ligadas.
- `features/entry/payload.ts`: `planSaves`, com testes.
- `features/entry/dayTargets.ts`: a meta numa data, e uma cópia local de `exigeOperadores`.

## Próximos passos, em ordem

1. ~~**Calendário (tela nova).**~~ **Feito em 04/10** (`features/calendar/`, com testes e
   fumaça). O que segue era o plano. O gestor cadastra feriados de SC e de Itajaí e as paradas da
   fábrica pelo site.
   - Contrato: `calendar.getHolidays`, `addHoliday(date, label, type, session, shiftIds?)`,
     `removeHoliday(id)`.
   - Permissão: `calendar.manage`.
   - O banco já testou isso (suíte 08).
   - Limitações do contrato: toda data entra como "da empresa", e não há intervalo de datas
     (férias coletivas viram um cadastro por dia; a tela pode fazer o laço).
   - Depois de gravar, chamar `reloadBackendData`: os dias úteis vêm do calendário.
2. **Máquinas (tela nova):** cadastrar e desativar.
   - Contrato: `machines.addMachine(name, defaultMeta)`, `toggleMachine(id)`.
   - Permissão: `machines.manage`.
   - O banco tem `create_machine` com base e lotação (D53), mas o contrato só expõe nome e
     meta. Se a tela precisar, proponha o tipo em vez de inventar.
3. **Quando o branch do banco `claude/operadores-obrigatorios` chegar à `main`:**
   - trazer a `main`;
   - trocar a cópia de `exigeOperadores` (em `dayTargets.ts`) pelo import de
     `src/lib/metas.ts`;
   - trocar `lineOf` (dedução da linha pelo nome, em `fromBackend.ts`) por `Machine.process`
     (`assembly`/`packaging`; Granel continua agrupamento de tela).
4. **Quando o `updateEntry` entrar no contrato:** formato combinado na nota
   `2026-10-03-historico-e-updateentry.md`. O diálogo "Editar" do Histórico passa a editar
   o apontamento inteiro: lista de OPs, turno, regime, observação e nº de pessoas.
5. **Arestas que ficaram:**
   - o botão "Novo apontamento" do Dashboard leva ao Apontamento;
   - o histórico de metas não mostra mudança de base (pedido de `basis` no
     `TargetHistoryItem` feito ao banco);
   - o simulador de capacidade ainda usa valores de exemplo (D58: o banco vai entregar a
     capacidade real).

## Pendências do lado do banco (não esperar; só saber)

- `bulkMove` e `bulkEditTurno` não recalculam a meta ao mover (defeito achado por eles).
  Já estão ligados no Histórico.
- `updateEntry`, `basis` no histórico de metas e a capacidade real (D58).

## Como verificar (o que rodar antes de cada push)

```bash
npm run typecheck && npm run lint && npm test && npm run build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e   # 5 testes de fumaça
```

- `npm test` roda os testes da camada de dados (`src/test`, do banco) e os da interface
  (`prototype/src/**/*.test.ts`).
- O e2e sobe o próprio servidor na porta 8095, em modo de demonstração.

### Testar fluxos de gravação sem Supabase

Use `e2e/support/banco-falso.mjs`. Ele troca o módulo mock da camada de dados por um banco
em memória com dados realistas, e cada gravação fica em `window.__calls`. O uso está no
topo do arquivo. Servidor: `VITE_DATA_SOURCE=mock npx vite --config prototype/vite.config.ts`
(porta 8090). Login: `gestor@demo.local` / `123456`.

### Testar no banco real

O usuário está configurando o ambiente da sessão. Confirme antes de assumir que está
pronto:

- **Rede:** `*.supabase.co` liberado em Network access.
- **Variáveis de ambiente:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e, se houver,
  `TEST_MANAGER_EMAIL/PASSWORD` e `TEST_OPERATOR_EMAIL/PASSWORD` (contas de teste com perfil
  Gestor e Operador).
- **Para conferir:** `curl -sS -o /dev/null -w "%{http_code}" "$VITE_SUPABASE_URL/rest/v1/"`.
  Se der 000, a rede ainda bloqueia.
- **Para subir a interface no banco:** `VITE_DATA_SOURCE=supabase npm run dev`.
- **Regra combinada para gravar em produção:**
  - leitura à vontade;
  - gravação só na **máquina 18, em hora extra, no dia do teste**, apagada no fim do próprio
    teste. É a mesma regra de `src/test/integration/supabase.integration.ts`
    (`npm run test:integration`);
  - a auditoria guarda o rastro de que o teste existiu.
- **Nunca** colocar valores de credencial no repositório, em commit ou no chat.
- **Situação em 04/10, na máquina Windows do usuário:** a rede alcança o Supabase (Auth
  responde, a `anon key` é aceita, as tabelas recusam o anônimo, como manda o RLS). O
  `.env.local` da raiz do worktree tem URL e chave (ignorado pelo git). **Ainda faltam as
  contas de teste** (`TEST_MANAGER_*`, `TEST_OPERATOR_*`): sem elas, nada foi lido nem
  gravado no banco real. Para subir a interface no banco aqui: `preview_start dash-supabase`
  (usa `.env.supabase.local` com `VITE_DATA_SOURCE=supabase`).

## Armadilhas deste ambiente

- **Não use `pkill -f`** com um padrão que apareça na própria linha de comando: ele mata o
  shell (sai com 144). Para parar o Vite:
  `ps aux | grep "[n]ode.*vite --config prototype" | awk '{print $2}' | xargs -r kill`.
- **`grep` com acentos pode falhar** (o locale não é UTF-8). Para buscar texto em português,
  use Python.
- **Playwright:** use o Chromium da máquina (`executablePath: "/opt/pw-browsers/chromium"`,
  ou `PW_CHROMIUM_PATH`). Não rode `playwright install`.
- **Prettier:** vários arquivos antigos já estavam fora do formato. Formate só arquivos
  novos, e com `--print-width 140`, para não reformatar código alheio no diff.
- **Na máquina Windows (worktree dentro de `Dash-v2/.claude/worktrees/`):**
  - o `vitest` acha o `postcss.config.js` antigo do checkout principal, duas pastas acima, e
    falha com "Cannot find module 'tailwindcss'". O `npm run dev`, o `build` e o e2e não
    sofrem, porque a config da interface declara o PostCSS. Para os testes, use uma config
    temporária fora do repositório com `css: { postcss: { plugins: [] } }`;
  - não há Python: para editar texto com acento, use o Node ou o editor;
  - vários arquivos usam CRLF; substituições com `\n` no Node precisam normalizar antes;
  - o Playwright usa o Chromium já baixado em `%LOCALAPPDATA%/ms-playwright`
    (`npx playwright test` funciona direto).
- **`machines.ts` é compartilhado.** Mudança ali vai com aviso numa nota para o banco.
- **Não escreva migration nem mexa em `src/lib/**`:** é da sessão do banco. Se faltar algo,
  proponha o tipo em `src/lib/repositories/types.ts` numa nota.
- **O usuário fala português** e lê no app. Respostas curtas, sem jargão, dizendo o que foi
  testado e o que não foi.
