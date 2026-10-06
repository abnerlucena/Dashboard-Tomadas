# Dashboard: Exportar de verdade e comparação justa com o mês anterior

> Data: 06/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Só para saber: nada muda no contrato.

## Em uma linha

Duas correções do Dashboard, achadas na avaliação heurística de 05/10. Uma delas mexe
em `machines.ts` (compartilhado).

## 1. Comparação com o mês anterior (`machines.ts`)

O cartão "Produção" comparava o mês **em curso** (com dados até o dia 21, por exemplo)
com o mês anterior **inteiro**. Isso inventava uma queda: com os dados do banco falso,
"28,1% abaixo de agosto". Agora:

- mês em curso compara com o mês anterior **até o mesmo dia** (1 a 21 de agosto), e o
  rótulo diz isso: "abaixo de agosto até o dia 21". No mesmo exemplo, a diferença real é
  0,3%;
- mês fechado continua comparando com o mês anterior inteiro;
- dia que não existe no mês anterior (30 de março contra fevereiro) vira o último dia
  dele.

A regra está em `comparableMonthBefore(dataEnd)`, nova e exportada, com testes. O
`installBackendData` usa ela para `PREVIOUS_MONTH_PRODUCED` e `PREVIOUS_MONTH_LABEL`. O
teste antigo do adaptador, que fixava a comparação com o mês inteiro, foi atualizado.

## 2. Exportar: planilha .xlsx com gráficos, e um padrão para todas as exportações

Os dois botões "Exportar" (o do topo e o do painel da máquina) mostravam "Exportação
pronta (.xlsx)" sem baixar nada. Agora baixam um **.xlsx de verdade**, no padrão novo de
planilhas do Dash (`prototype/src/lib/xlsx/`: tema, construtor e gráficos):

- **topo, 7 abas:**
  - Resumo: quadro de informações, 8 indicadores, 4 gráficos e "Como ler";
  - Máquinas: 18 colunas, com totais que respeitam o filtro;
  - Por demanda;
  - Diário e Atingimento diário: mapas de calor;
  - Turnos;
  - Apontamentos;
- **painel da máquina, 3 abas:** Resumo com gráficos, Diário por turno e Apontamentos.

As contas são as mesmas da tela: produção só a boa (D11), meta = soma das metas dos turnos
apontados (D08).

**Relatórios:** a opção "Planilha (CSV)" virou **"Planilha (Excel)"**, no mesmo padrão: Resumo com gráficos, Máquinas, Diário e Apontamentos, mais a aba **Retrabalho por motivo** no relatório de retrabalho. Como os Relatórios escolhem vários turnos ao mesmo tempo, a planilha sai dos apontamentos do recorte e usa a mesma meta do PDF (`scopedTarget`).

**Dependência nova:** `exceljs@4.4.0` (MIT) em `package.json`. Ela é carregada **só ao
clicar em Exportar**, num pedaço separado do pacote (939 kB, 271 kB comprimido), e o pacote
inicial não cresceu. Os gráficos são PNG desenhados com o ECharts que já está no projeto,
porque nenhuma biblioteca de navegador cria gráfico nativo do Excel. Conferido: os arquivos
abrem no Excel sem aviso de reparo.
