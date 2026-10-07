# Auditoria do front-end — 07/10/2026

> Sessão de **interface**. Escopo: `prototype/` (a única interface), modo de
> demonstração. Nada em `supabase/`, `docs/database/`, `src/lib/` ou `src/test/`
> foi tocado. `prototype/src/data/machines.ts` (compartilhado) também não.

## Como foi feita

- **Navegador:** Playwright + Chromium, logado como gestor. Todas as rotas do menu,
  as quatro abas do Dashboard, o painel da máquina, a conversa de Feedbacks, o
  simulador de capacidade, os estados *Carregando*, *Vazio* e *Erro* e uma rota
  inexistente, em **1440px, 1024px e 390px**, nos temas **claro e escuro**
  (168 capturas). Modo TV em **1920×1080**, os seis slides, na fábrica inteira e
  na Montagem (12). Tela de entrar em 1440 e 390 (4).
- **Checagens automáticas em cada captura:** rolagem horizontal da página, texto
  saindo da caixa, `NaN`/`undefined`/`Infinity` na tela, erros no console e
  **axe-core** (WCAG 2 A/AA) em 1440px.
- **Leitura do código** de todas as features e de `components/` (ui, data,
  echarts, layout). Os números divergentes foram confirmados com um teste
  temporário sobre os dados de demonstração.
- **Base antes de mexer:** `typecheck`, `lint`, 49 testes de unidade e 7 testes
  e2e, todos verdes.

Capturas citadas abaixo: `auditoria-2026-10-07/antes/*.jpg` (e as de depois na
[galeria](auditoria-2026-10-07/galeria.md)).

## Resumo

| Severidade | Total | Correção segura | Decisão de produto |
|---|---:|---:|---:|
| Crítico | 4 | 4 | 0 |
| Alto | 11 | 7 | 4 |
| Médio | 23 | 18 | 5 |
| Baixo | 28 | 25 | 3 |
| **Total** | **66** | **54** | **12** |

(Rw2 conta como segura: digo o período agora; o filtro de período fica como
decisão à parte. T19 apareceu durante as correções.)

**Situação em 07/10/2026:** as 54 correções seguras estão feitas, em 9 commits
temáticos neste branch; as 12 decisões de produto esperam aprovação (lista no
fim). Nenhum item foi adiado ou recusado.

Testes novos (falham na `main`, passam aqui): `insights.test.ts` (Gráficos e
TV), `ranking.test.ts`, `panelDays.test.ts` e `dayProgress.test.ts` — 13
casos de Vitest — e o e2e "nenhuma tela rola de lado no celular" (na `main`,
o Cadastro rola 181px). Depois de cada bloco: `typecheck`, `lint`, `npm test`
(107 da camada de dados + 62 da interface) e `test:e2e` (8), todos verdes.

O que mais pesa: **o mesmo número sai diferente em telas diferentes.** A taxa de
retrabalho tem duas contas no app; a aba Gráficos, o painel da máquina e a
pré-visualização de Relatórios somam o retrabalho como produção; o Histórico
compara a produção dos centros por demanda com a meta só das máquinas com meta;
o Ranking divide o apontamento por dias que ainda não chegaram. Tudo isso é
correção segura (a regra já está decidida em D11 e no próprio Dashboard).

Legenda — **Tipo:** *Segura* (bug, overflow, token, acessibilidade, texto
factualmente errado) ou *Decisão* (remover algo, mudar fluxo, mudar texto de
negócio). **Status:** *Corrigido*, *Aguardando decisão*, *Adiado* ou *Recusado*.

---

## Transversal (componentes e regras que valem para várias telas)

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| T1 | Retrabalho, Gráficos, Ranking, TV, Relatórios | **Taxa de retrabalho com duas contas.** Retrabalho, aba Gráficos e as planilhas fazem retrabalho ÷ (boa + retrabalho); Ranking, Modo TV, PDF e a pré-visualização de Relatórios fazem retrabalho ÷ boa. Composé nº 1 em março: **10,1%** na tela Retrabalho, **11,2%** no Ranking. | Crítico | `RankingPage.tsx:49-50`, `tvMetrics.ts:86`, `reportPdf.ts:153,248`, `ReportsPage.tsx:443` × `ReworkPage.tsx:27,42-48`, `insights.ts:89` | Uma função só (`reworkRate`) com a conta das planilhas e da tela Retrabalho (peças apontadas como retrabalho ÷ total apontado), usada em todas as telas. Teste. | Segura | Corrigido (`1acb999`) |
| T2 | Ranking, Relatórios | **Formato de % diferente para o mesmo número.** Atingimento é inteiro no Dashboard (87%) e com decimal no Ranking (86,9%); retrabalho tem decimal em quase tudo e é inteiro no PDF e na pré-visualização (4%). | Médio | `RankingPage.tsx:54`, `reportPdf.ts:62,248`, `ReportsPage.tsx:443` | Atingimento e taxa de apontamento inteiros; taxas de retrabalho com uma casa. | Segura | Corrigido (`163d8da · 1acb999`) |
| T3 | Todas | **KPIs quebram em 3 + 1.** Em 1024px e com o painel aberto, o 4º KPI cai sozinho numa linha e estica na largura toda. | Médio | `KpiStrip.tsx:37`; `antes/dashboard-1024-light.jpg`, `antes/dashboard-painel-1440-light.jpg` | Faixas de até 4 KPIs: todos numa linha ou 2 × 2, nunca 3 + 1. | Segura | Corrigido (`07ea509`) |
| T4 | Dashboard, Retrabalho | **Estado vazio e de erro dentro da tabela larga.** No celular a mensagem fica centralizada na largura da tabela (1.157px) e sai da tela: "Nenhum apontam…", botão cortado. | Alto | `DataTable.tsx:384-396`; `antes/dashboard-vazio-390-light.jpg` | A mensagem sai da área que rola de lado e ocupa a largura visível do cartão. | Segura | Corrigido (`07ea509`) |
| T5 | OPs, Relatórios | **Rodapé vazio.** A tabela sempre desenha o rodapé cinza, mesmo sem totais (OPs). | Baixo | `DataTable.tsx:296`; `antes/ops-1440-light.jpg` | Só desenha o rodapé quando há o que mostrar. | Segura | Corrigido (`07ea509`) |
| T6 | Dashboard (painel) | **Título do painel cortado sem dica.** "Bancada de embalagem a ..." — o nome da máquina some. | Médio | `Panel.tsx:77`; `antes/dashboard-painel-1440-light.jpg` | O título quebra em até duas linhas. | Segura | Corrigido (`54ba87f`) |
| T7 | Celular (todas) | **Área de toque de 32px** em botões e ícones; o mínimo no celular é 44px. | Médio | `Button.tsx:62,115`; tokens `--dash-size-control` | Em tela de toque, a área clicável cresce até 44px por um pseudo-elemento, sem mudar o desenho. | Segura | Corrigido (`e2c8a8c`) |
| T8 | Histórico | **`aria-label` em `span` sem papel** (célula de turno): proibido pela especificação; leitores de tela ignoram. 58 ocorrências. | Médio | `HistoryPage.tsx:276` (axe `aria-prohibited-attr`) | Texto `sr-only` no lugar do `aria-label`. | Segura | Corrigido (`6baff33`) |
| T9 | Dashboard, OPs, Relatórios, Cadastro | **Contraste da etiqueta Granel (teal) 4,02:1** no tema claro (mínimo 4,5:1). | Médio | `tokens.css:370` (axe `color-contrast`) | Texto teal um tom mais escuro (`hsl(185 70% 28%)`, 5,0:1), como já é feito no verde-limão, amarelo e laranja. | Segura | Corrigido (`e2c8a8c`) |
| T10 | Histórico | **Dias de fim de semana e futuros com 2,77:1** (cor de desabilitado em botão que funciona). | Baixo | `MonthCalendar.tsx:122` (axe) | `text-subtlest` no lugar de `text-disabled`. | Segura | Corrigido (`6baff33`) |
| T11 | Dashboard (painel) | **Painel sem acesso pelo teclado à rolagem** e `<dl>` com filho inválido. | Baixo | `Panel.tsx:86`, `MachinePanel.tsx:48-55` (axe `scrollable-region-focusable`, `definition-list`) | Área de rolagem focável; a linha de status sai do `<dl>`. | Segura | Corrigido (`54ba87f`) |
| T12 | Menu do usuário | **"Perfil" e "Preferências" não fazem nada.** | Alto | `App.tsx:645-646` | Tirar os dois itens (ou criar as telas). | Decisão | Aguardando decisão |
| T13 | Barra superior | **Aviso de feedbacks com horário inventado** ("há 1 h"), também com o banco. | Médio | `App.tsx:536` | Tirar o horário falso desse aviso. | Segura | Corrigido (`7a99f1a`) |
| T14 | Todas | **Notificação (flag) reinicia o tempo a cada renderização** da tela: com "Desfazer", o aviso pode ficar mais ou menos que os 5 s. | Baixo | `Feedback.tsx:82-85`, `App.tsx` (`onDismiss` novo a cada render) | Tempo preso ao aviso, não à renderização. | Segura | Corrigido (`7a99f1a`) |
| T15 | Várias | **Plural errado:** "1 OPs", "1 dias sem apontamento", "12 máquinas" fixo. | Baixo | `ReworkPage.tsx:234`, `Sparkline.tsx:32`, `MetasPage.tsx:490`, `ReportsPage.tsx:545` | `plural()` em todos. | Segura | Corrigido (`1acb999 · 07ea509 · 5c98644`) |
| T16 | Metas, Exportar | **Código de decisão na tela:** "(D31)" numa notificação, "(D38)" na planilha. | Baixo | `MetasPage.tsx:342`, `dashboardReport.ts:235` | Tirar o código; o texto já explica. | Segura | Corrigido (`07ea509`) |
| T17 | Histórico, Cadastro | **Valores fora dos tokens** (`basis-[9rem]`, `w-[8.5rem]`, `mt-[1.375rem]`, `min-w-[640px]`). | Baixo | `EditRecordDialog.tsx:103,114,117,128`, `MachineRegistryPage.tsx:177` | Tokens novos em `tokens.css`. | Segura | Corrigido (`07ea509`) |
| T18 | Código | **Import no meio do arquivo.** | Baixo | `MachinesPage.tsx:53` | Subir para o topo. | Segura | Corrigido (`07ea509`) |
| T19 | Barra superior (demonstração) | **Aviso de exemplo contradiz o Dashboard:** "Atingimento geral em 49%" com o Dashboard em 76%. | Baixo | `App.tsx:518` | Texto do aviso com o atingimento calculado. | Segura | Corrigido (`7a99f1a`) |

## Dashboard — tela Máquinas (e Linhas, Turnos)

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| M1 | Painel da máquina | **Total do dia soma o retrabalho** e as linhas de retrabalho não têm marca. Composé nº 1 em 27/03: **10.480 un.** no painel, **5.918** na aba Detalhado. | Crítico | `MachinePanel.tsx:83` | Total do dia só com a produção boa (D11); linha de retrabalho com a etiqueta "Retrabalho". Teste. | Segura | Corrigido (`54ba87f`) |
| M2 | Aba Gráficos | **Retrabalho contado como produção.** KPI "Ritmo médio": "3.947.900 peças" com a Produção em 3.798.315; "Produção por turno" (181.414 em 27/03) não bate com "Produção diária" (176.852); peças/min geral com retrabalho e por máquina sem. | Crítico | `insights.ts:27,35,88`; `antes/dashboard-graficos-1440-light.jpg` | Produção, turnos e ritmo só com a produção boa; o retrabalho continua no gráfico de qualidade. Teste. | Segura | Corrigido (`1acb999`) |
| M3 | Visão geral | **A tabela não cabe em 1440px** com a navegação aberta: 1.157px de conteúdo para 1.054px. "Último apontamento" aparece cortado e o menu de ações (⋯) fica fora da tela. | Alto | `machineColumns.tsx`; `antes/dashboard-1440-light.jpg` | Duas opções, juntas cabem: **(a)** tirar a coluna de seleção (ver M4); **(b)** deixar o nome da máquina quebrar em duas linhas, como já fazem Histórico e Metas. | Decisão | Aguardando decisão |
| M4 | Visão geral | **Seleção de linhas sem uso.** Marcar máquinas só mostra "N de 12 selecionadas"; Exportar ignora a seleção. | Médio | `MachinesPage.tsx:140,495-501` | Tirar a seleção, ou fazer o Exportar levar só as marcadas. | Decisão | Aguardando decisão |
| M5 | Cabeçalho | **"Em produção" verde fixo** ao lado do título, até nos estados de erro e vazio. Não informa nada. | Médio | `MachinesPage.tsx:406-410`; `antes/dashboard-erro-1440-light.jpg` | Tirar a etiqueta (Linhas e Turnos continuam com o horário do turno). | Decisão | Aguardando decisão |
| M6 | Menu da linha e painel | **"Histórico da máquina" e "Histórico completo" não levam a lugar nenhum:** mostram "Ainda não existe uma tela só da máquina". | Alto | `MachinesPage.tsx:275`, `machineColumns.tsx:144`, `MachinePanel.tsx:56` | Levar ao Histórico (que hoje não filtra por máquina) ou tirar os dois botões até existir o filtro. | Decisão | Aguardando decisão |
| M7 | Estado de erro | **"Ver status do sistema"** mostra um aviso inventado ("instável"). Só aparece na demonstração. | Baixo | `MachinesPage.tsx:330` | Tirar o botão. | Decisão | Aguardando decisão |
| M8 | Rodapé da tabela | **"Média 76%"** é o atingimento geral (produção total ÷ meta total), não a média das máquinas (que daria outro número). | Médio | `machineColumns.tsx:85` | "Geral 76%". | Segura | Corrigido (`07ea509`) |
| M9 | Coluna Atingimento | **"102%" sai da caixa** de 32px e desalinha a coluna quando passa de 99%. | Baixo | `machineColumns.tsx:77` (+9px), também `MetasPage.tsx:286` | Caixa do número com a largura de quatro algarismos. | Segura | Corrigido (`07ea509`) |
| M10 | Gráficos (celular) | **Motivos de retrabalho:** rótulos partidos no meio da palavra ("Reba / rba / na / peça") e cortados. | Médio | `Charts.tsx:735-745`; `antes/dashboard-graficos-390-pareto.jpg` | Sem espaço para a palavra inteira, o rótulo termina em "…" (o nome completo fica no tooltip). | Segura | Corrigido (`5c98644`) |
| M11 | Gráficos (celular) | **Atingimento por máquina:** nomes cortados com 12 letras ("Embaladora v…"), todos iguais. | Baixo | `Charts.tsx:311` | Mais espaço para o nome em telas estreitas (30% → 42%). | Segura | Corrigido (`5c98644`) |
| M12 | Detalhado e gráficos | **Divisão por meta zero** vira "Infinity%" (máquina sem meta diária no recorte, com o banco). | Baixo | `HeatCell.tsx:39`, `Charts.tsx:60,184`, `ChartsView.tsx:192,213` | Sem meta, mostra só a quantidade, em tom neutro. | Segura | Corrigido (`5c98644`) |
| M13 | Painel | **Dias agrupados em UTC** (`toISOString`) e sem ordem garantida. | Baixo | `MachinePanel.tsx:111` | Chave pelo dia local; do mais recente para o mais antigo. | Segura | Corrigido (`54ba87f`) |

## Apontamento

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| A1 | Lista de máquinas | **Ajuda do "Nº de operadores" repetida nas 22 máquinas** ("Só registra a presença: …"), mais "O que lançar abaixo soma a isso." em cada uma. Os cartões ficam altos e a tela, cansativa. | Médio | `EntryPage.tsx:527-535,563,624`; `antes/apontamento-1440-light.jpg` | Mostrar a ajuda só quando ela muda algo (meta por pessoa ou pela lotação) e explicar o resto uma vez no topo. | Decisão | Aguardando decisão |
| A2 | Linha de OP | **"Remover OP da linha 1"** igual em todas as máquinas: o leitor de tela não diz de qual. | Baixo | `EntryPage.tsx:677` | Incluir o nome da máquina. | Segura | Corrigido (`7a99f1a`) |
| A3 | Cabeçalho | **"Descartar alterações" apaga tudo sem confirmar.** | Médio | `EntryPage.tsx:316-323` | Pedir confirmação, como já acontece ao trocar data ou turno. | Decisão | Aguardando decisão |

## OPs

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| O1 | Filtros | **Busca corta o próprio exemplo** ("OP, material ou máquir"). | Baixo | `OpsPage.tsx:297`; `antes/ops-1440-light.jpg` | Campo mais largo. | Segura | Corrigido (`07ea509`) |
| O2 | KPIs | **"Concluídas no mês" conta todas as concluídas**, de qualquer mês. | Médio | `OpsPage.tsx:113` | Contar só as concluídas no mês dos dados. | Segura | Corrigido (`7a99f1a`) |
| O3 | Tabela | **"Ações" lido duas vezes** (cabeçalho visível + texto de leitor de tela); nas outras tabelas a coluna não tem título visível. | Baixo | `OpsPage.tsx:203-204` | Mesmo padrão das outras tabelas. | Segura | Corrigido (`07ea509`) |

## Histórico

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| H1 | Calendário e dia | **% da meta diária soma os centros por demanda** contra a meta só das máquinas com meta. 27/03 aparece **89%** (202.289 ÷ 226.600); só com as máquinas com meta, **78%** (176.852). O tom do dia no calendário também sai errado. | Crítico | `HistoryPage.tsx:102-106,442-447`; `antes/historico-1440-light.jpg` | Percentual só com a produção das máquinas com meta (como o Dashboard e o PDF). O total de unidades do dia continua com todas. Teste. | Segura | Corrigido (`6baff33`) |
| H2 | Tabela do dia | **Total da coluna Quantidade não bate com a coluna:** a soma das linhas inclui o retrabalho (206.851), o rodapé não (202.289), sem dizer. | Médio | `HistoryPage.tsx:304` | Rodapé "Produção 202.289" (o retrabalho segue listado com a etiqueta). | Segura | Corrigido (`6baff33`) |
| H3 | Descrição | Texto cita "o sistema atual" para correções — o sistema antigo foi aposentado (D64). | Baixo | `HistoryPage.tsx:401` | Tirar a menção. | Segura | Corrigido (`6baff33`) |

## Metas

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| Me1 | Topo da aba | **Fórmula sempre visível** ("Meta por dia = meta do turno (pela base…) × …") ocupa o topo da tela para quem só consulta. | Baixo | `MetasPage.tsx:382-386` | Levar a fórmula para a Ajuda ou para o modo de edição. | Decisão | Aguardando decisão |

(Os itens "(D31)", "102%" e o plural "12 máquinas" de Metas estão em T16, M9 e T15.)

## Calendário

Sem achados próprios além de T10 (cores dos dias). Fluxo de cadastrar e remover
completo, com confirmação e mensagens claras.

## Feedbacks

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| F1 | Conversa | **Quebra de linha perdida:** a tela diz "Shift + Enter quebra a linha", mas o balão junta tudo numa linha; palavra longa (link) pode estourar o balão. | Médio | `FeedbacksPage.tsx:482-489` | Respeitar as quebras e partir palavras longas. | Segura | Corrigido (`7a99f1a`) |
| F2 | Cabeçalho | **Descrição de três linhas + linha de permissão** antes da caixa de entrada. | Baixo | `FeedbacksPage.tsx:90-96`; `antes/feedbacks-conversa-1440-light.jpg` | Encurtar para uma linha ("Conversa de cada OP. Encerra quando a OP é concluída.") e tirar a linha de permissão. | Decisão | Aguardando decisão |

## Relatórios

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| R1 | Pré-visualização | **Tabela por máquina soma o retrabalho:** Composé nº 1 aparece com **174.240**; no Dashboard, 156.644. | Alto | `ReportsPage.tsx:466`; `antes/relatorios-1440-light.jpg` | Só a produção boa. (Retrabalho do bloco de indicadores: T1.) | Segura | Corrigido (`1acb999`) |
| R2 | Formato Excel | **Texto desatualizado:** "uma linha por OP, com separador ';' para abrir direto no Excel" é do CSV; hoje sai um .xlsx com resumo, gráficos e abas. | Médio | `ReportsPage.tsx:414` | Descrever a planilha atual. | Segura | Corrigido (`1acb999`) |
| R3 | Resumo | **"666 OPs" conta apontamentos**, não OPs (a mesma OP aparece em vários turnos). | Médio | `ReportsPage.tsx:434,523` | "666 apontamentos", como no Histórico e nos Gráficos. | Segura | Corrigido (`1acb999`) |
| R4 | Pré-visualização da planilha | Quantidade **sem separador de milhar**. | Baixo | `ReportsPage.tsx:506` | `formatNumber`. | Segura | Corrigido (`1acb999`) |
| R5 | Pré-visualização (celular) | **"4.335.241" sai da caixa** do indicador. | Baixo | `ReportsPage.tsx:447` (+12px) | Número menor na pré-visualização estreita. | Segura | Corrigido (`07ea509`) |

## Ranking de máquinas

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| Rk1 | Critério Apontamento | **Divide pelos 22 dias úteis do mês, inclusive os que não chegaram.** Composé (Aumaq) aparece com **90,9%**; no Dashboard, **100%** (20 de 20 dias). Conta também dias só com retrabalho. | Alto | `RankingPage.tsx:40,47-48` | Dias com produção sobre os dias úteis já transcorridos, como a "Taxa de apontamento" do Dashboard. Teste. | Segura | Corrigido (`163d8da`) |
| Rk2 | Filtro Turno 3 | **As 10 máquinas que não rodam no T3 entram como "0% · Crítico".** O Dashboard as tira do recorte. | Alto | `RankingPage.tsx:70` | Só as máquinas que trabalham no turno. Teste. | Segura | Corrigido (`163d8da`) |
| Rk3 | Sem semana anterior | Com menos de uma semana de dados, toda linha diz "mesma posição · era Nº" e a coluna fica sem sentido. | Baixo | `RankingPage.tsx:77,135-145` | Sem base de comparação, a coluna e o "subiu/caiu" do pódio saem. | Segura | Corrigido (`163d8da`) |
| Rk4 | Coluna de movimento | "= mesma posição · era 3º" repete a informação. | Baixo | `RankingPage.tsx:142` | "era Nº" só quando a posição mudou. | Segura | Corrigido (`163d8da`) |
| Rk5 | Pódio | Nome truncado sem dica ("Máquina de tomadas Composé (Au…"). | Baixo | `RankingPage.tsx:189`; `antes/ranking-1440-light.jpg` | `title` com o nome. | Segura | Corrigido (`163d8da`) |

(Retrabalho e formato de %: T1 e T2.)

## Retrabalho

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| Rw1 | Gráfico por máquina (celular) | **Sem barras:** em 390px a coluna do nome (200px) e a do valor (136px) ocupam tudo, e o trilho da barra fica com 0px. | Alto | `tailwind.config.ts:304`; `antes/retrabalho-390-light.jpg` | Coluna do nome limitada a 40% da largura. | Segura | Corrigido (`07ea509`) |
| Rw2 | Período | **A tela não diz de que período são os números** e soma toda a janela de dados (com o banco, todos os meses). | Alto | `ReworkPage.tsx:34-40` | Agora: dizer o período na descrição. Depois (decisão): filtro de período como no Dashboard. | Segura + Decisão | Corrigido o período (`1acb999`); filtro aguarda decisão |
| Rw3 | Descrição | Diz "sobre a produção", mas a conta é sobre o total apontado (produção + retrabalho). | Médio | `ReworkPage.tsx:133` | Ajustar o texto à conta. | Segura | Corrigido (`1acb999`) |
| Rw4 | Código | Limite de 10% em duas constantes. | Baixo | `ReworkPage.tsx:26`, `insights.ts:23` | Uma constante. | Segura | Corrigido (`1acb999`) |
| Rw5 | Gráficos de barras | Nome truncado sem dica. | Baixo | `BarList.tsx:298` | `title` com o nome. | Segura | Corrigido (`5c98644`) |

## Modo TV

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| TV1 | Cabeçalho | **Relógio ao vivo ao lado da data dos dados**, sem dizer que é a data dos dados. Com o banco, de manhã cedo aparece a data de ontem ao lado da hora de hoje. | Médio | `TvMode.tsx:196`; `antes/tv-slide1-1920.jpg` | "Dados até sex, 27 de março". | Segura | Corrigido (`7a99f1a`) |

(Retrabalho e peças/min do placar: T1 e M2. Slides conferidos em 1920×1080:
cabem sem rolagem, contraste e tamanhos de TV bons.)

## Ajuda

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| Aj1 | FAQ | **"número da OP (7 dígitos)"** — o sistema aceita até 15 dígitos (D57). | Médio | `HelpPage.tsx:26` | "o número da OP (só números)". | Segura | Corrigido (`7a99f1a`) |
| Aj2 | FAQ | **"Toda ação pode ser desfeita logo depois pela notificação"** — com o banco, excluir e mover não têm desfazer (o próprio diálogo diz "Não dá para desfazer"). | Médio | `HelpPage.tsx:30` | "Antes de excluir, a tela pede confirmação." | Segura | Corrigido (`7a99f1a`) |
| Aj3 | FAQ e legenda | **"Dias sem apontamento contam como zero"** e "Meta do mês = meta por dia × 22 dias úteis" valem para a demonstração; com o banco, a meta é a soma das metas gravadas nos turnos apontados (D08). | Médio | `HelpPage.tsx:38` e o rodapé da legenda | Reescrever as duas respostas pela regra do banco. | Decisão | Aguardando decisão |
| Aj4 | Atalhos | "← →: percorrer os dias num gráfico **ou no Modo TV**" — na TV as setas trocam o slide. | Baixo | `HelpPage.tsx:20` | "…num gráfico ou os slides do Modo TV". | Segura | Corrigido (`7a99f1a`) |
| Aj5 | Suporte | **"Falar com o suporte" diz "Chamado aberto"** sem abrir nada (também com o banco). | Alto | `HelpPage.tsx:206` | Trocar por um contato real (e-mail ou ramal de TI) ou tirar o botão. | Decisão | Aguardando decisão |

## Cadastro de máquinas, Usuários e tela de entrar

| # | Tela | Problema | Severidade | Evidência | Correção proposta | Tipo | Status |
|---|---|---|---|---|---|---|---|
| C1 | Cadastro (celular) | **A página inteira rola de lado** (571px numa tela de 390px): o texto escondido do cabeçalho "Ações" escapa da área de rolagem da tabela. | Alto | `MachineRegistryPage.tsx:176`; `antes/cadastro-maquinas-390-light.jpg` | `relative` na área de rolagem (o texto fica preso a ela). | Segura | Corrigido (`07ea509`) |

Usuários e a tela de entrar: sem achados (estados, mensagens e foco corretos nos
dois temas e no celular).

---

## Decisões de produto pendentes

1. **M3 + M4 — Tabela da Visão geral em 1440px.** Recomendo tirar a seleção de
   linhas (não há ação em lote) e deixar o nome da máquina quebrar em duas
   linhas. Assim a tabela cabe inteira com a navegação aberta.
2. **M5 — Etiqueta "Em produção"** ao lado do título: recomendo tirar.
3. **M6 — "Histórico da máquina" / "Histórico completo":** levar ao Histórico
   (sem filtro por máquina, por enquanto) ou tirar até existir o filtro.
   Recomendo tirar.
4. **T12 — "Perfil" e "Preferências"** no menu do usuário: recomendo tirar.
5. **Aj5 — "Falar com o suporte":** qual é o canal real? Sem ele, recomendo tirar
   o botão e deixar o texto com o contato.
6. **M7 — "Ver status do sistema"** no erro de demonstração: recomendo tirar.
7. **A1 — Ajuda repetida no Apontamento:** recomendo mostrar só quando muda a
   meta.
8. **A3 — Confirmar "Descartar alterações":** recomendo confirmar.
9. **Rw2 — Filtro de período na tela Retrabalho** (hoje só digo o período).
10. **Aj3 — Texto da regra de meta na Ajuda** com o banco: confirmar a frase.
11. **F2 e Me1 — Encurtar descrições** de Feedbacks e Metas.

## O que não mexi, de propósito

- Paleta, navegação, nomes das telas e conceitos da fábrica.
- Largura padrão da navegação lateral (320px): resolver M3 por ela mudaria o
  layout de todas as telas.
- `prototype/src/data/machines.ts` (compartilhado): nenhuma correção precisou dele.
- A camada de dados e o banco: nada aqui depende da outra sessão.
