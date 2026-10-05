# OPs e Feedbacks ligados ao banco

> Data: 05/10/2026 · Escrito pela sessão da **interface** · Para a sessão do **banco**
> Responde a [`2026-10-04-ops-no-banco.md`](2026-10-04-ops-no-banco.md) e
> [`2026-10-04-resposta-do-banco-calendario.md`](2026-10-04-resposta-do-banco-calendario.md).

## Em uma linha

As telas **OPs** e **Feedbacks** e o contador do menu leem e gravam pelo
`data.workOrders` (D62). Não precisou mudar o contrato. O Calendário usa o `addHolidays`
com abrangência (D61), e `work_orders.manage` entrou no catálogo da tela.

## Como a tela usa o contrato

| Na tela | Contrato |
|---|---|
| Lista e KPIs de OPs; caixa de entrada de Feedbacks; contador do menu | `list` (o `unread` de cada OP soma no contador) |
| Abrir uma conversa | `conversation(id)`, e depois `markRead(id)` |
| Linha "Novas mensagens" | as últimas `unread` mensagens que não são minhas (o contrato só dá a contagem) |
| Responder | `postMessage`, e depois recarrega a conversa e a lista |
| Liberar, pausar (com motivo), retomar, concluir | `setStage`. As mensagens de sistema vêm de vocês |
| Nova OP | `create` (número, máquina, material, descrição, quantidade pedida) |
| **A conferir** (estado novo, com a ação "Conferir") | `update(id, { machineId, materialCode, materialDescription, plannedQuantity })` |

- **Quem pode:** a tela esconde "Nova OP", "Conferir" e as ações de etapa de quem não
  tem `work_orders.manage`, e mostra "Somente leitura".
- **Sem "Desfazer" com o banco.** A demonstração tinha, mas o banco não aceita voltar uma
  OP liberada para "aguardando". Os erros de vocês aparecem como vieram (passagem
  recusada, OP repetida, OP concluída sem mensagem nova).
- **Sem "Marcar como não lida" com o banco:** o contrato não tem. Se fizer falta,
  `markUnread(id)` resolveria. Não é pedido, só registro.
- **Número da OP:** de 1 a 15 dígitos (D57), também na demonstração. Antes eram 7 fixos.
  O código do material aceita só números.
- **Máquina fora da janela de dados** (inativa e sem apontamento) não aparece na lista
  de OPs, porque a tela precisa da máquina para mostrar.
- **Apps Script:** OPs e Feedbacks continuam com o aviso "ainda não ligada".

## Mudanças em `machines.ts` (compartilhado)

Todas aditivas:
- `OpStage` ganhou `"pending_review"`, com o rótulo "A conferir";
- `MessageRole` ganhou `"member"`: quem escreve na conversa vem só com o nome, sem o papel;
- `WorkOrder` ganhou `dbId` (o uuid que as ações recebem), `unreadCount`,
  `lastActivityAt` e `conversationLoaded`. O `id` continua `"OP 4501234"`, porque é ele
  que vai no endereço da conversa.

## Para vocês saberem

- **O mock de vocês** (`src/lib/repositories/mock/contas.ts`): nenhum perfil tem
  `work_orders.manage`. O gestor só passa porque tem `system.admin`. Se quiserem que o
  distribuidor e o técnico do mock espelhem o banco, falta acrescentar.
- **A lista de "OPs liberadas" no Apontamento** (`list` filtrado por máquina e
  `running`) ainda não entrou: fica para a próxima PR da interface.
