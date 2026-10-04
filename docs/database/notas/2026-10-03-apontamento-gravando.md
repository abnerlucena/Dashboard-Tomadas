# Apontamento gravando no banco — como a interface usa o contrato

> Data: 03/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Continua [`2026-10-03-ui-antiga-aposentada.md`](2026-10-03-ui-antiga-aposentada.md) (item 1 da lista).

## Em uma linha

A tela de Apontamento grava pelo `production.saveEntries`, uma máquina por chamada.
Nenhuma mudança no contrato nem no banco foi necessária.

## Como a tela usa o que existe

| Regra do banco | O que a tela faz |
|---|---|
| Salvar **acrescenta** ordens (D30) | O que já está gravado aparece como resumo, só leitura ("Gravado: 5.000 peças em OP …"). Os campos são só para ordens **novas**, para não duplicar nada. Corrigir é no Histórico (próxima etapa). |
| Hora extra é outro apontamento (D27) | Seletor **Normal / Hora extra** ao lado do turno. Manda `workMode: "overtime"` e mostra "fora da meta". |
| A meta é a do dia apontado (D08, D32) | A porcentagem da tela vem de `targets.getMetasEm(data)` e `standardOperatorCount`, passando por `metaDoTurno`. A tela não manda meta: quem congela é o banco. |
| `operatorCount`: ausente mantém, 0 apaga (D52) | Apontamento novo manda o número digitado, ou 0 se vazio. Num apontamento existente, só manda se mudou. O campo já vem preenchido com o valor gravado. |
| Observação vazia em `saveEntries` = manter | Apagar a observação de um apontamento existente vai por `updateObs(record, "")`. Se essa for a única mudança, `saveEntries` nem é chamado. |
| Sem permissão para alterar o apontamento de outra pessoa | O erro aparece **na máquina**. As outras máquinas salvam, e o que falhou continua no formulário. |

Depois de salvar, a tela recarrega os dados (`production.getAll` etc.), e Dashboard e
Histórico já mostram o novo.

**Modo Apps Script:** a tela não grava. Lá o salvar **substitui** as ordens, e esta tela
foi feita para acrescentar.

## Mudança em `machines.ts` (compartilhado)

Só um campo opcional novo, aditivo: `ProductionOrder.record?: ProductionRecordInfo`, com
`{ id, overtime, operatorCount, notes }` do apontamento a que a ordem pertence. O
`fromBackend.ts` preenche o campo a partir do `ProdRecord`. A demonstração não usa.

## Ajustado depois da resposta de vocês (mesmo dia)

- **Nº da OP (D57):** a tela aceita só números, até 15 dígitos. O teste de ponta a ponta
  cobre uma OP de 13 dígitos.
- **Nº de operadores obrigatório onde a meta é por pessoa (D54):** o campo diz
  "Obrigatório", e salvar é barrado antes de ir ao banco, citando a máquina pelo nome.
  A regra é `exigeOperadores`. Como a versão de vocês ainda está no branch
  `claude/operadores-obrigatorios`, há uma cópia em
  `prototype/src/features/entry/dayTargets.ts`. Quando o branch chegar à `main`, eu
  importo de `src/lib/metas.ts` e apago a cópia.
- **Corrigir a quantidade de um apontamento:** respondido por vocês (`updateEntry`). A
  resposta ao formato proposto vai na nota do Histórico.
