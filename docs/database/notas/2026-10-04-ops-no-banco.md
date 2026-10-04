# OPs no banco — o contrato para as telas de OPs e Feedbacks

> Data: 04/10/2026 · Escrito pela sessão do **banco** · Para a sessão da **interface**
> D62, schema 0.26.0. Fecha a "lacuna 3" das notas de 27/09 e 01/10.

## Em uma linha

A OP existe no banco, com situação e conversa. As telas de OPs e de Feedbacks
podem trocar a fonte de demonstração (`OpsStore`) pelo contrato
`data.workOrders`.

## O que o gestor definiu

| Ponto | Regra |
|---|---|
| Origem | Por enquanto **o distribuidor cadastra** na aba OPs. O objetivo é puxar do SAP, e o banco já tem a porta (`importar_ops_do_sap`) |
| OP não cadastrada no apontamento | **Entra**, e a OP nasce **"a conferir"** (`pending_review`) na máquina do apontamento |
| Material | **Pertence à OP**, não ao apontamento |
| Conversa | **Como a tela desenha**: o operador não entra, mas a observação dele no apontamento aparece |

## O contrato

```ts
data.workOrders.list(session): Promise<WorkOrderRecord[]>
data.workOrders.create({ orderNumber, machineId, materialCode?, materialDescription?, plannedQuantity? }, session): Promise<string>
data.workOrders.update(id, { machineId?, materialCode?, materialDescription?, plannedQuantity? }, session)
data.workOrders.setStage(id, "waiting" | "running" | "paused" | "done", reason?, session)
data.workOrders.conversation(id, session): Promise<WorkOrderMessage[]>
data.workOrders.postMessage(id, text, session)
data.workOrders.markRead(id, session)
```

Os tipos estão em `src/lib/repositories/types.ts`.

## Como cada coisa da tela se encaixa

| Na tela (`WorkOrder` de `machines.ts`) | No contrato |
|---|---|
| `id` ("OP 4501234") | `orderNumber` ("4501234"). O `id` do contrato é o uuid, e é ele que as ações recebem |
| `material`, `product` | `materialCode`, `materialDescription` |
| `planned`, `produced` | `plannedQuantity`, `producedQuantity` (sem o retrabalho; o retrabalho vem em `reworkQuantity`) |
| `stage` | `stage`, mais o novo **`pending_review`** ("a conferir") |
| `pauseReason`, `releasedAt`, `closedAt` | iguais |
| `messages` | `conversation(id)`, com `kind`: `message`, `system` ou `operator_note` |
| não lidas | `unread`, já calculado em `list` para quem está lendo, sem contar as próprias |
| `markRead` | `markRead(id)` |

### "A conferir"

É um estado que a tela ainda não tem. Nasce quando alguém aponta um número que
não é OP cadastrada. Para conferir: `update(id, { materialCode, …, plannedQuantity })`.
Ela passa a aguardar liberação, e a conversa registra "OP conferida". Sugestão
de rótulo: **"A conferir"**, com a ação **"Conferir"**.

### Situação

As passagens são as da tela: aguardando → em produção; em produção → pausada (com
motivo) ou concluída; pausada → em produção ou concluída; concluída → em produção
(o "Desfazer"). Qualquer outra é recusada. **Cada passagem vira uma mensagem do
sistema** na conversa ("OP liberada para produção por …", "Pausada por …: Falta de
material."), então a tela não precisa escrever essas mensagens.

### Conversa

- A **observação do operador** vem como `kind: "operator_note"`, com `shiftId` e
  `rework`. Ela não é copiada para a conversa: é lida do apontamento. Se for
  corrigida no Histórico, a conversa mostra a versão corrigida.
- OP **concluída** não aceita mensagem nova.
- `postMessage` já marca a conversa como lida para quem escreveu.

### Permissões

| Ação | Quem |
|---|---|
| Ver a lista de OPs | quem aponta (`production.create`) ou vê feedbacks |
| Ver e escrever na conversa | `feedbacks.view` |
| Cadastrar, corrigir, mudar a situação | **`work_orders.manage`** — permissão nova: distribuidor, técnico, gestor e admin |

Vale acrescentar `work_orders.manage` no catálogo de `permissions.ts` da tela,
para a edição de permissões mostrar.

## O apontamento

Nada muda no `saveEntries`. A lista de **"OPs liberadas"** da máquina é
`list()` filtrado por `machineId` e `stage === "running"`.

## Em aberto

- A mesma OP apontada em **outra máquina** não é barrada: a OP continua na
  máquina em que foi cadastrada. Se a tela quiser avisar, é comparar `machineId`.
- Os tipos destas tabelas em `database.types.ts` foram escritos à mão, no formato
  do gerador, e conferidos contra o banco.
