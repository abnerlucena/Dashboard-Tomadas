# OP não informada: hoje vai como o número 0, falta um valor próprio

> Data: 12/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Pede decisão: criar o "não informado" de verdade e limpar a OP `0`. **Ajuste temporário, a pedido do gestor.**

## Em uma linha

O Apontamento deixou de exigir o nº da OP. Sem número, a linha vai como OP **`0`**,
porque é o único valor que o banco aceita hoje (D57: só números, de 1 a 15).

## O que a interface faz (ajuste temporário)

- O campo Nº da OP é opcional. Com quantidade e sem número, a tela avisa "Sem número:
  vai como não informado" e manda `{ ordemId: "0", quantidade }` em `saveEntries`.
  A constante é `NO_OP` em `prototype/src/data/machines.ts`.
- Se a pessoa digitou, o número continua validado (só números, até 15).
- Na leitura, a OP `0` aparece como **"Não informado"** (Apontamento, Histórico,
  Retrabalho, relatórios) e **não conta** como OP nos totais de OPs dos relatórios.
- Na edição do Histórico, a OP `0` aparece como campo vazio e volta como `0`.

## O que isso causa no banco

- `insert_production_orders` aceita `0` (passa em `^[0-9]{1,15}$`). Como a OP nasce de
  apontamento (D62), o banco cria uma **OP `0`** em `pending_review`, ligada à máquina do
  primeiro apontamento sem OP. `work_orders.order_number` é único, então **todos os
  apontamentos sem OP, de todas as máquinas, caem na mesma OP `0`**.
- Efeitos colaterais: a OP `0` aparece em OPs e Feedbacks com a produção somada e as
  observações misturadas; e, se alguém liberar ou concluir a `0`, ela se comporta como OP.

## O que a sessão do banco precisa decidir

1. **Valor próprio de "não informado".** Sugestão: aceitar `order_number` vazio em
   `insert_production_orders` e gravar a linha em `production_orders` **sem** criar OP em
   `work_orders` (como o `IMPORTADO`, D57). Contrato: `OrdemProducao.ordemId` opcional.
2. **Limpeza da OP `0`.** Quando o item 1 existir: converter as linhas `order_number = '0'`
   e apagar a OP `0` de `work_orders` (e a conversa dela, se houver).
3. **Proteção até lá.** Se quiser, recusar liberar, pausar e concluir a OP `0`.

Quando o banco aceitar o "não informado", a interface troca `NO_OP` pelo valor novo (uma
constante e `opLabel`) e deixa de mandar `0`.
