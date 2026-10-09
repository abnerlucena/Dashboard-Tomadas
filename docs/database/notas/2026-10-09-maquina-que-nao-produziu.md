# Máquina que não produziu: hoje vai na observação, falta um campo próprio

> Data: 09/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Pede decisão: criar um campo para "não produziu" e o motivo. **Não bloqueia a interface.**

## Em uma linha

O Apontamento ganhou o botão **Não produziu** (etapa D da proposta em
`docs/frontend/proposta-apontamento.md`). Sem campo no contrato, ele grava um
apontamento **sem peças** com a observação `Não produziu: <motivo>`.

## O que a interface faz

- No cartão da máquina, "Não produziu" abre os motivos: Manutenção, Sem OP,
  Sem operador, Setup / troca, Falta de material, Máquina parada. Sem motivo,
  não conclui.
- Ao concluir manda `saveEntries([{ ..., producao: 0, ordensProducao: [], obs: "Não produziu: Manutenção" }])`.
  É o "apontamento sem peça, só com observação" que o contrato já aceita
  (`UpdateEntryChanges`, `ordensProducao: []`). O `operatorCount` segue valendo.
- Na leitura (`EntryPage.loadForm`), um apontamento com 0 peças e observação
  começando por `Não produziu: ` aparece como "Não produziu" (bolinha cinza na
  lista, contado à parte no resumo e fora do aviso de "menos de 30% da meta").
- Lançar peças depois numa máquina assim: a interface manda as OPs e apaga a
  observação (`updateObs(id, "")`).
- Toda a convenção está em duas funções, `stopNote` e `parseStop`, em
  `prototype/src/features/entry/payload.ts`.

## Por que é provisório

- O motivo é texto livre dentro de `notes`: aparece em Feedbacks como uma
  observação qualquer e não dá para somar "quantos turnos parada por manutenção".
- Um operador que escrevesse "Não produziu: …" à mão numa observação de turno
  sem peças seria lido como máquina parada.
- A meta do turno continua valendo para a máquina (o banco congela a meta no dia,
  D08): o atingimento cai, como num dia sem produção. Não há como separar parada
  planejada (manutenção) de parada por falta de OP.

## O que a sessão do banco precisa decidir

1. **Campo próprio.** Sugestão: `production_records.stop_reason text null`
   (preenchido só quando o apontamento não tem peças) e, no contrato,
   `ProductionEntryPayload.motivoParada?: string` e o mesmo na leitura
   (`ProdRecord`). Quando existir, a interface troca `stopNote`/`parseStop`
   por ele e lê os dois durante a transição.
2. **Lista fechada ou texto livre?** Hoje a tela oferece 6 motivos fixos. Uma
   tabela `stop_reasons` mantida pelo gestor permitiria relatório limpo; texto
   livre é mais simples (mesma discussão do motivo do retrabalho, D66).
3. **Paradas planejadas fora da meta?** Manutenção e preventiva poderiam sair
   da meta do turno, como o dia anulado. É decisão de negócio, não da tela.
4. **Migração:** copiar para o campo novo as observações `Não produziu: …` de
   apontamentos sem peças gravados a partir de 09/10/2026.
