# Dash de Produção — a interface

A interface web do **Dash de Produção**: apontamento de produção, metas, OPs e
acompanhamento da Seção Tomadas e Interruptores (WEG Itajaí). É a única
interface do sistema (D44, D56). Até 14/10/2026 esta pasta se chamava
`prototype/`, nome provisório que vinha do começo do projeto.

Vite, React 18 e TypeScript, com Tailwind sobre um sistema de tokens derivado do
Atlassian Design System (fundações → componentes → padrões) e a marca WEG. Usa os
`node_modules` e o `package.json` da raiz do repositório.

## De onde vêm os dados

A fonte é escolhida por `VITE_DATA_SOURCE`, no `.env.local` da **raiz** (o
`vite.config.ts` lê de lá):

| `VITE_DATA_SOURCE` | Fonte | Para quê |
| --- | --- | --- |
| *(vazio)* | **Demonstração**: dados fictícios gerados em `src/data/machines.ts` e contas de `features/access/demoClient.ts`, sem servidor | Abrir o app sem nada configurado, o HTML único e o teste de fumaça (`e2e/`) |
| `mock` | Contas de mentira da camada de dados (`src/lib/repositories/mock`, na raiz). Só em `npm run dev`; um build ignora | Construir telas da área de acesso sem banco |
| `supabase` | **O banco**, pela camada de dados de `src/lib/repositories/` (na raiz). Precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` | Uso real |

Com o banco, todas as telas do menu leem e gravam por ele:

- **Leitura:** `features/data/BackendGate.tsx` chama `loadBackendData()`
  (`src/data/fromBackend.ts`), que busca produção, máquinas, metas, histórico de
  metas e calendário e converte o contrato da camada de dados
  (`src/lib/repositories/types.ts`, na raiz) no formato das telas.
- **Escrita:** sempre pelo contrato (`saveEntries`, `updateEntry`, `saveMetas`,
  `workOrders.*`…), que chama as funções do banco. Depois de gravar, a tela chama
  `reloadBackendData()`.
- **Fica no navegador:** só as **Preferências** (`localStorage`, uma chave por
  pessoa), até o banco guardá-las na conta (nota de 13/10/2026 em
  `docs/database/notas/`).
- **Ainda não existe no banco:** material da OP, minutos por OP e a capacidade
  real por processo. As telas mostram `–` ou usam a planilha só na demonstração.

## Como rodar

Tudo da raiz do repositório:

```bash
npm ci
npm run dev              # http://localhost:8090 (demonstração: gestor@demo.weg / demo123)
npm run typecheck        # tipos (interface e camada de dados)
npm run lint
npm test                 # testes de unidade (camada de dados + interface)
npm run test:e2e         # fumaça no navegador, modo de demonstração (e2e/)
npm run build            # build em app/dist (o que vai para o GitHub Pages)
npm run build:html       # HTML único (CSS + JS embutidos) em app/dist/dash-producao.html
node app/scripts/capture.mjs   # regera app/screenshots (servidor rodando)
```

O build sai com o caminho base `/Dashboard-Tomadas/` (GitHub Pages e servidor
interno). O HTML único usa `./` e abre de qualquer pasta.

## Estrutura

```
app/
├── index.html, vite.config.ts, vitest.config.ts, tailwind.config.ts, tsconfig.json
├── public/                   ← favicon e robots.txt
├── scripts/                  ← capture.mjs (capturas) e single-file.mjs (HTML único)
├── screenshots/              ← capturas dos estados (claro, escuro, flyout, mobile…)
└── src/
    ├── main.tsx, App.tsx     ← entrada, menu, rotas por hash (#/dashboard…) e barra superior
    ├── styles/tokens.css     ← ÚNICA fonte de valores visuais (claro + escuro)
    ├── components/
    │   ├── layout/           ← AppRoot, TopNav, SideNav (item, seção, splitter, flyout), Main, Panel
    │   ├── data/             ← KpiStrip, DataTable, SegmentedBar, Sparkline, BarList, MonthCalendar…
    │   ├── echarts/          ← gráficos ECharts (carregados sob demanda) e o tema deles
    │   └── ui/               ← Button, Lozenge, Tag, Menu, Tooltip, Modal, TextField, Flag…
    ├── data/
    │   ├── machines.ts       ← modelo das telas e dados da demonstração (compartilhado com o banco)
    │   └── fromBackend.ts    ← adaptador: contrato da camada de dados → formato das telas
    ├── lib/                  ← utilitários, hooks, guarda de rotas e exportação xlsx
    └── features/             ← uma pasta por tela (tabela abaixo)
```

| Pasta em `features/` | Tela |
| --- | --- |
| `machines` | Dashboard, Linhas e Turnos (a mesma tela com recortes) |
| `entry` | Apontamento |
| `ops` | OPs e a conversa de cada OP |
| `history` | Histórico |
| `metas`, `capacity` | Metas e o simulador de capacidade |
| `calendar` | Calendário |
| `feedbacks` | Feedbacks |
| `reports` | Relatórios (CSV, XLSX, PDF) |
| `analysis` | Ranking e Retrabalho |
| `registry` | Cadastro de máquinas |
| `access` | Entrada, cadastro, recuperação de senha, Usuários e permissões |
| `preferences` | Perfil e Preferências |
| `tv` | Modo TV |
| `help` | Ajuda |
| `data` | `BackendGate`: carrega o banco antes de abrir as telas |

## Dados do simulador de capacidade

O repositório é público: `capacityBaseline.ts` traz valores **fictícios** com a mesma estrutura
da planilha. Para gerar um build privado com os números reais, crie
`src/features/capacity/capacityBaseline.local.ts` (ignorado pelo Git) e rode o build com
`CAPACITY_DATA=real`.

## Tokens

- Nomes ADS: `--ds-[property]-[role]-[emphasis]-[state]`,
  por exemplo `--ds-background-brand-bold-hovered`.
  Tokens específicos do app usam `--dash-*` (layout, tamanhos, camadas).
- No Tailwind, as classes leem como o token: `bg-brand-bold`, `hover:bg-neutral-subtle-hovered`,
  `text-subtlest`, `border-focused`, `p-200`, `gap-075`, `rounded-medium`,
  `shadow-overlay`, `font-heading-large`, `font-metric-medium`.
- A paleta, os espaçamentos, os raios e as fontes padrão do Tailwind **não existem** aqui:
  `bg-blue-500` ou `p-4` não geram CSS. Todo valor novo entra primeiro no `tokens.css`.
- Tema: `data-color-mode="light|dark"` no `<html>`. Os componentes nunca mudam.
  O escuro deriva do azul-marinho WEG, e as superfícies mais altas são mais claras.

## Páginas

Cada item do menu só aparece para quem tem a permissão dele.

| Menu | O que faz |
| --- | --- |
| Dashboard | Tela Máquinas (abas abaixo) |
| Apontamento | Data + turno, máquinas por linha, várias OPs por máquina (sugere as OPs liberadas; o número pode ficar em branco, D68), retrabalho com motivo, "Não produziu" com motivo da parada, nº de operadores, hora extra, observação, rascunho, validação e Ctrl+S |
| OPs | Toda ordem que entra no sistema: Aguardando liberação → Em produção ⇄ Pausada (com motivo) → Concluída. "Pronta para concluir" quando atinge a quantidade; uma pessoa confirma. Nova OP, liberar, pausar, retomar e concluir |
| Histórico | Calendário do mês no tom do status; corrigir um apontamento, mover, alterar turno e excluir (em lote), com Desfazer |
| Metas | Duas abas. **Metas vigentes**: meta por turno com vigência futura, base da meta (por máquina ou por pessoa) e histórico. **Simulador de capacidade**: modelo da planilha Capacidade vs Pessoas (jornada, peças/min, eficiência, regime, pessoas), meta por turno recalculada ao vivo e gráfico de capacidade por processo (ECharts) |
| Calendário | Feriados e paradas, de dia inteiro ou de um turno, em vários dias de uma vez. O turno anulado sai do atingimento |
| Feedbacks | Uma conversa por OP: observações dos operadores, respostas de líderes/gestor, respostas rápidas e avisos de etapa. Encerra quando a OP é concluída. Não lidas no contador do menu |
| Relatórios | Montador (tipo, período, máquinas, turnos, formato, seções) com pré-visualização; exporta CSV, XLSX e PDF |
| Linhas / Turnos | A tela Máquinas com recorte fixo por linha (Montagem, Embalagem, Granel) ou por turno |
| Ranking | Posição por atingimento, produção, apontamento ou retrabalho, com movimento da semana |
| Retrabalho | Taxa por máquina (limite de 10%), motivos e lista de OPs |
| Modo TV | Telão de chão de fábrica por área (`#/tv/montagem`…): placar dos turnos, ranking das máquinas, máquina a máquina, ritmo (OPs concluídas por dia, peças/min) e destaques. Compara turnos e máquinas, nunca pessoas; o Turno 3 (hora extra) fica fora da disputa |
| Ajuda | Perguntas frequentes com busca, atalhos, legenda de status e suporte |
| Usuários | Aprovar cadastros, ativar ou desativar contas, perfil-modelo e permissões por pessoa (`users.approve`) |
| Cadastro de máquinas | Criar e editar máquinas: linha, meta (0 = por demanda), base da meta e lotação (`machines.manage`) |
| Perfil / Preferências | No menu da conta: dados da pessoa, troca de senha pelo e-mail, tema, página inicial, barra lateral e rascunho do Apontamento |

## Abas da tela Máquinas

| Aba | O que mostra |
| --- | --- |
| Visão geral | KPIs e tabela por máquina: atingimento, tendência de 14 dias úteis e último apontamento |
| Detalhado | Grade máquina × dia útil no tom do status do dia; `–` marca dia sem apontamento. Alterna entre quantidade e % da meta diária |
| Turnos | Produção por turno (KPIs), tabela com a participação de cada turno e barra de distribuição |
| Gráficos | Acumulado vs meta (linha), produção diária (colunas) e atingimento por máquina (barras, clique abre o painel). Todos têm visão em tabela |

Decisões que valem para todas as abas:

- **Filtros acima de tudo.** A linha de filtros fica fora das abas e define o recorte de KPIs, tabelas e gráficos.
  Com um turno filtrado, cada máquina é recortada para aquele turno, contra a meta do turno; máquinas que não rodam no turno saem do recorte.
  A aba Turnos é a exceção: ela compara os três turnos e só destaca o turno escolhido.
- **Uma fonte de dados.** A sparkline, a grade diária, o painel e os gráficos leem as mesmas ordens
  de produção, então os números sempre concordam. Na demonstração, são 22 dias úteis de março/2026,
  com referência em 27/03.
- **Na demonstração: centros reais, números fictícios.** As 22 máquinas são os centros de trabalho da planilha
  (Montagem, Embalagem, Granel), com metas e produção inventadas. Os 10 centros por demanda (sem meta)
  aparecem no Apontamento, OPs e Feedbacks, mas não entram no atingimento.
- **Cor de turno fixa.** Azul, teal e magenta (`--ds-chart-categorical-1..3`) aparecem na navegação,
  nos KPIs, nas barras e nas legendas. A paleta foi validada nos dois temas (daltonismo, visão
  normal e contraste). A cor segue o turno, nunca a posição.
- **Recarregar mantém o quadro.** Numa troca de período, os gráficos continuam na tela esmaecidos.
  O skeleton aparece só no carregamento inicial.

## Comportamentos do layout

| Largura | Navegação lateral | Painel |
| --- | --- | --- |
| ≥ 1024px | Inline, redimensionável (240px até 50% da tela). Duplo clique no divisor recolhe. Recolhida, abre em flyout ao passar o mouse no botão. | Inline, 365px, redimensionável até 50% do conteúdo |
| 768–1023px | Recolhida; o botão abre em overlay | Sobrepõe o conteúdo |
| < 768px | Overlay com véu, largura `min(320px, 90vw)` | Sobrepõe o conteúdo |

Atalhos: `Ctrl+[` alterna a navegação, `/` foca a busca e `Esc` fecha flyout, overlay e painel.
Na tabela, `↑`/`↓` navegam pelas linhas e `Enter` abre o painel.

No modo de demonstração, o ícone de frasco na barra superior ("Estados de
demonstração") alterna os dados entre Normal, Carregando, Vazio e Erro. Com o
banco, ele some.

Na demonstração, os dados são fictícios (março de 2026). Produção e meta vêm do
briefing; dias, tendência e ordens são gerados de forma determinística.
