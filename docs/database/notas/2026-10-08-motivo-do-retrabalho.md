# Motivo do retrabalho: hoje vai na observação da OP, falta um campo próprio

> Data: 08/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Pede decisão: criar um campo de motivo no contrato e no banco.

## Em uma linha

O Apontamento passou a pedir o motivo quando a OP é marcada como retrabalho.
Como o contrato não tem campo para isso, o motivo vai, por enquanto, na
observação da própria OP (`OrdemProducao.obs` → `production_orders.notes`).

## O que a interface faz (PR #41, commits `09f765e` e `44c9608`)

- Ao marcar "Retrabalho" numa OP, aparece um campo de texto para o motivo, com
  os motivos comuns como sugestão ao digitar ("Rebarba na peça", "Cor fora do
  padrão", "Montagem invertida", "Falha no teste elétrico", "Encaixe com
  folga"). Sem motivo, não salva.
- Ao salvar: `{ ordemId, quantidade, retrabalho: true, obs: "<motivo>" }`
  (`prototype/src/features/entry/payload.ts`). Nada muda no formato enviado.
- Na leitura (`prototype/src/data/fromBackend.ts`), a observação de uma OP de
  retrabalho vira o motivo. Ela alimenta o gráfico "Motivos de retrabalho" e a
  tabela da tela Retrabalho. OP de retrabalho sem observação aparece como
  "Não informado".

## Por que isso é provisório

- `notes` é texto livre. Um operador que escrevesse outra coisa ali apareceria
  como um "motivo" no gráfico.
- Não dá para garantir a lista de motivos nem renomear um motivo depois.
- Apontamentos da planilha (carga de `supabase/import/`) não têm motivo: todos
  entram como "Não informado".

## O que a sessão do banco precisa decidir

1. **Campo próprio.** Sugestão: `production_orders.rework_reason text null`,
   preenchido só quando `is_rework = true` (check), e no contrato
   `OrdemProducao.motivoRetrabalho?: string`.
2. **Lista fechada ou texto livre?** Uma tabela `rework_reasons` (cadastro que o
   gestor mantém) dá relatório limpo; texto livre é mais simples. Hoje a
   interface grava texto livre (com sugestões), por decisão do usuário; o
   gráfico agrupa textos iguais e mostra qualquer motivo novo que vier do banco.
3. **Migração dos dados que já estão em `notes`:** copiar `notes` para o campo
   novo nas OPs com `is_rework = true` gravadas a partir de 08/10/2026.

Quando o campo existir no `types.ts`, a interface troca `obs` pelo campo novo
(duas linhas, em `payload.ts` e `fromBackend.ts`) e lê os dois durante a
transição.
