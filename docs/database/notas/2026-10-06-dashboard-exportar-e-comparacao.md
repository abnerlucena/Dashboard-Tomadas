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

## 2. Exportar

Os dois botões "Exportar" (o do topo e o do painel da máquina) mostravam "Exportação
pronta (.xlsx)" sem baixar nada. Agora baixam um **CSV que o Excel abre direto**, com
BOM, `;` e acentos:

- **topo:** a tabela como está na tela (filtros e ordem);
- **painel:** os apontamentos da máquina no período.

Não há biblioteca de `.xlsx` no projeto. Se um dia precisarem de `.xlsx` de verdade (por
exemplo, no servidor interno), combinamos.
