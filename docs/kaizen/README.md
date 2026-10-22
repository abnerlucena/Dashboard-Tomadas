# Kaizen: do Excel ao Dash de Produção

> Rascunho para apresentação · Tomadas & Interruptores · Itajaí · outubro de 2026
> Os números da seção **Situação anterior** vêm da planilha real
> (`ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx`, conferida na migração).
> Os **prints** usam os dados fictícios do modo de demonstração (março de 2026).
> Os campos marcados **[preencher]** pedem medição na fábrica.

## Título

**Apontamento de produção digital: do Excel ao Dash de Produção**

Outras opções:

- *Fim do apontamento em planilha: produção, meta e paradas num sistema só*
- *Dash de Produção: o turno apontado vira indicador no mesmo dia*

## Problema

A produção da fábrica era registrada à mão numa planilha do Excel. Ela tinha uma
aba por mês, uma linha por dia e turno, uma coluna por máquina e um bloco de
"Informações adicionais" em texto livre. A planilha funcionava como registro,
mas não segurava o dado nem respondia às perguntas da gestão sem trabalho manual.

**Em uma frase:** o apontamento em planilha aceitava qualquer coisa em qualquer
célula, não guardava o contexto da produção e deixava o atingimento da meta para
ser calculado à mão.

### O que a migração de 9 meses mostrou (20/12/2025 a 21/09/2026)

Na migração, as 23 colunas da planilha foram conferidas uma a uma, com 2.505
turnos-máquina com produção. Foi o que se encontrou:

| O que aconteceu na planilha | Casos | Consequência |
|---|---|---|
| A hora extra foi escrita de 5 jeitos diferentes ("HORA EXTRA", "H. EXTRA", "EXTRA 1°T", "EXTRA 2°T", uma aba separada) | 9 | não dava para somar nem separar da meta do turno |
| Texto no lugar de número ("Preventiva", "Manutenção") | 4 | a parada sumia das contas |
| Retrabalho anotado em texto livre ("Retrabalho Refinatto 4.510") | 3 | o retrabalho se misturava à produção boa |
| Número cortado ("10." em vez de 10.000) | 1 | só foi corrigido depois, perguntando ao gestor |
| Zeros que queriam dizer "a máquina ainda não existia" | 2.663 células | zero de máquina inexistente se confundia com zero de parada |
| Zeros de máquinas por demanda (turno sem pedido) | ~1.060 células | "não teve pedido" e "parou" ficavam iguais |
| Coluna sem nenhum dado em 9 meses (Montagem Tomadas Manual) | 1 | coluna morta |
| Máquina sem coluna (Bancada N°5 · Eletrônicos) | 1 | a produção dela não tinha onde ser registrada |
| Meta do grupo valendo para cada máquina, e meta nova sobrescrevendo a antiga | todas | não havia histórico de metas |
| Nenhum nº de OP | todos | não dava para saber de qual ordem veio a produção |

### Causas (5 porquês, resumido)

1. **Por que** o atingimento dava trabalho e era pouco confiável? Porque era
   calculado à mão, a partir de células que podiam ter qualquer conteúdo.
2. **Por que** as células tinham qualquer conteúdo? Porque a planilha não valida
   tipo, faixa nem cadastro: "Manutenção" cabe onde deveria haver um número.
3. **Por que** paradas, hora extra e retrabalho iam em texto? Porque a planilha
   não tinha campo para esses casos. O operador escrevia do jeito que conseguia.
4. **Por que** não havia campo? Porque o formato "linha = dia e turno, coluna =
   máquina" só tem lugar para **uma quantidade** por célula.
5. **Causa raiz:** o registro da produção dependia de um formato que não
   separa produção boa, retrabalho, hora extra, paradas e ocorrências, nem
   guarda a meta de cada dia.

## Objetivo

- Registrar cada turno de cada máquina num lugar só, com validação no momento
  do apontamento.
- Mostrar o atingimento da meta sem cálculo manual, no mesmo dia.
- Separar o que conta para a meta (turno normal) do que não conta (hora extra,
  dia anulado, parada planejada).
- Registrar paradas, retrabalho, materiais faltantes e faltas de pessoas em
  campos próprios, não em texto solto.

## Solução

O **Dash de Produção** é uma aplicação web, usada no computador e no celular, com
um banco de dados próprio (PostgreSQL). Ele substitui a planilha no apontamento e
na consulta.

| Antes (planilha) | Depois (Dash de Produção) | Print |
|---|---|---|
| Qualquer pessoa abria o arquivo e editava qualquer célula | Cada pessoa entra com o próprio usuário e perfil, e o sistema registra **quem** apontou e quando | 01 |
| Atingimento calculado à mão | Dashboard com o atingimento da fábrica, das linhas e das máquinas, atualizado a cada apontamento | 02, 03 |
| Uma planilha aberta com 23 colunas | Apontamento em 3 passos: turno → máquinas (com a lista do que falta) → conferir e terminar | 04, 05, 07 |
| "Manutenção" escrito no lugar do número | Botão **Não produziu**, com o motivo e a marcação de **parada planejada** (que tira o turno da meta) | 06 |
| Erro de digitação passava (um zero a mais) | Avisos na conferência: quantidade acima de 2× a meta, mesma OP em duas máquinas | 07 |
| "Informações adicionais" em texto livre | **Ocorrências do turno**: material faltante pelo código, falta de pessoa pelo cadastro | 08 |
| Procurar a linha do dia e do turno na aba do mês | **Histórico** com calendário, filtro por turno e por máquina, e a meta do dia ao lado da produção | 09, 10 |
| Comparar turnos exigia montar uma tabela | Visão por turno e **Modo TV** para o chão de fábrica | 11, 19 |
| Montar relatório copiando e colando | Relatórios exportados em Excel e PDF | 12 |
| Sem comparação entre máquinas | Ranking das máquinas | 13 |
| Retrabalho somado com a produção | Retrabalho separado, com o motivo | 14 |
| Meta nova apagava a antiga | Metas com histórico: cada meta guarda a data em que passou a valer | 15 |
| Feriado e dia sem produção não ficavam marcados | Calendário com feriados, eventos e dias anulados (que saem da conta) | 16 |
| Falta de pessoa escrita à mão | Cadastro de colaboradores; o nome de quem faltou só aparece para o gestor | 17 |
| Ninguém para perguntar como preencher | Página de Ajuda com perguntas frequentes | 18 |
| Apontar só onde estava o arquivo | Apontamento também no celular | 20 |

### Regras que o sistema passou a garantir

- Só existe apontamento de máquina cadastrada, e um por máquina, dia, turno e
  regime (normal ou hora extra).
- A **hora extra** é marcada como tal: entra na produção total, mas fica fora do
  atingimento.
- A **parada planejada** (manutenção, setup) sai da meta do turno. Sem OP, sem
  operador e falta de material **continuam contando**, para o problema aparecer
  no atingimento.
- **Máquina por demanda** (bancadas) aparece com a produção, mas fora do
  atingimento: turno sem pedido não é parada.
- O **retrabalho** nunca entra como produção boa.
- O **histórico da planilha** foi importado com a origem de cada valor (aba e
  célula), e o total por máquina e mês foi conferido contra a planilha.

## Resultados

Qualitativos (já observados):

- Um lugar só para a produção, com dono, data e hora de cada registro.
- O atingimento do dia sai sem cálculo manual.
- Paradas, retrabalho e ocorrências viraram dado, que pode ser somado por motivo.

Quantitativos (medir antes e depois):

| Indicador | Antes (planilha) | Depois (Dash) |
|---|---|---|
| Tempo para apontar um turno inteiro | [preencher] min | [preencher] min |
| Tempo para fechar o relatório do mês | [preencher] h | [preencher] min |
| Registros com erro ou texto no lugar de número | 17 casos em 9 meses, só os achados na migração | 0 (o sistema recusa) |
| Tempo até a gestão ver o atingimento do dia | [preencher] | no mesmo turno |

## Padronização

- O apontamento é feito no Dash ao fim de cada turno, pelo distribuidor.
- A **Ajuda** dentro do Dash explica cada tela (print 18).
- A planilha deixou de ser a fonte da produção depois da virada.

## Próximos passos

- Integração com o SAP para trazer as OPs sem digitação.
- Paradas medidas pelo SFM, ao lado das informadas pelo operador.
- Quantificar os ganhos da tabela de resultados.

## Prints

Pasta [`prints/`](prints/). Use os arquivos na ordem dos números.

| Arquivo | O que mostra |
|---|---|
| `01-tela-de-entrada-com-login-por-usuario.png` | Entrada com usuário e senha |
| `02-dashboard-atingimento-da-fabrica-em-tempo-real.png` | Dashboard: atingimento da fábrica e por máquina |
| `03-grafico-producao-acumulada-vs-meta.png` | Produção acumulada contra a meta no mês |
| `04-apontamento-passo-1-escolha-de-dia-turno-e-regime.png` | Passo 1: dia, turno e regime |
| `05-apontamento-passo-2-maquinas-com-status-ao-lado.png` | Passo 2: as máquinas, com a lista do que falta ao lado |
| `06-apontamento-maquina-que-nao-produziu-com-motivo.png` | Máquina que não produziu, com o motivo |
| `07-apontamento-passo-3-conferir-antes-de-terminar.png` | Passo 3: conferência antes de terminar o turno |
| `08-ocorrencias-do-turno-materiais-e-faltas-de-pessoas.png` | Materiais faltantes e falta de pessoas |
| `09-historico-do-dia-com-meta-e-filtro-por-turno.png` | Histórico do dia, com a meta diária |
| `10-historico-filtrado-no-turno-1.png` | Histórico filtrado no Turno 1, com a meta do turno |
| `11-dashboard-comparacao-entre-turnos.png` | Comparação entre os turnos |
| `12-relatorios-exportacao-em-excel-e-pdf.png` | Relatórios em Excel e PDF |
| `13-ranking-das-maquinas.png` | Ranking das máquinas |
| `14-retrabalho-separado-da-producao-boa.png` | Retrabalho separado da produção boa |
| `15-metas-com-historico-de-alteracoes.png` | Metas com histórico |
| `16-calendario-feriados-e-dias-anulados.png` | Calendário da fábrica |
| `17-cadastro-de-colaboradores.png` | Cadastro de colaboradores |
| `18-ajuda-perguntas-frequentes.png` | Ajuda dentro do sistema |
| `19-modo-tv-para-o-chao-de-fabrica.png` | Modo TV para o chão de fábrica |
| `20-apontamento-no-celular.png` | Apontamento no celular |

Sugestão para o "antes": um print ou foto da planilha
`ITAJAI - CONTROLE DE PRODUÇÃO 2026.xlsx`, com uma aba do mês e o bloco de
"Informações adicionais". Ela não está no repositório, que é público.
