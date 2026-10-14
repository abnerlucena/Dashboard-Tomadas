import type { WorkOrderMessage, WorkOrderRecord } from "../../../../src/lib/repositories/types";
import { parseMoment } from "@/data/fromBackend";
import type { OpMessage, Shift, WorkOrder } from "@/data/machines";

/*
 * Contrato das OPs (data.workOrders, D62) → formato das telas (WorkOrder de
 * machines.ts). Nota de 04/10 "OPs no banco":
 * - `id` da tela continua "OP 4501234" (URL da conversa); o uuid vai em `dbId`;
 * - produzido = sem o retrabalho; quantidade pedida vazia vira 0 (a tela mostra
 *   só o apontado);
 * - a conversa vem à parte (`conversation`), ao abrir a OP.
 */

const EPOCH = new Date(0);
const when = (s: string | null | undefined) => parseMoment(s) ?? null;

export function toWorkOrder(r: WorkOrderRecord): WorkOrder {
  const created = when(r.createdAt) ?? EPOCH;
  const released = when(r.releasedAt);
  const closed = when(r.closedAt);
  const lastEntry = when(r.lastEntryAt);
  const activity = [created, released, closed, lastEntry].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    id: `OP ${r.orderNumber}`,
    dbId: r.id,
    machineId: String(r.machineId),
    material: r.materialCode ?? "",
    product: r.materialDescription ?? "",
    planned: r.plannedQuantity ?? 0,
    produced: r.producedQuantity,
    stage: r.stage,
    releasedAt: released ?? created,
    closedAt: closed,
    pauseReason: r.pauseReason,
    entryIds: [],
    messages: [],
    unreadCount: r.unread,
    lastActivityAt: activity ?? created,
    conversationLoaded: false,
  };
}

const shiftOf = (n: number | null): Shift | undefined => (n === 1 || n === 2 || n === 3 ? n : undefined);

export function toMessages(list: WorkOrderMessage[], opId: string): OpMessage[] {
  return list.map((m) => ({
    id: m.id,
    opId,
    at: when(m.at) ?? EPOCH,
    author: m.author,
    role: m.kind === "system" ? "system" : m.kind === "operator_note" ? "operator" : "member",
    shift: shiftOf(m.shiftId),
    text: m.text,
    ...(m.rework ? { rework: true } : {}),
  }));
}

/**
 * As não lidas, para a linha "Novas mensagens": o banco dá só a contagem, sem
 * contar as minhas. São as últimas `count` que não são minhas.
 */
export function unreadIds(messages: OpMessage[], count: number, me: string): string[] {
  if (count <= 0) return [];
  return messages
    .filter((m) => m.author !== me || m.role === "system")
    .slice(-count)
    .map((m) => m.id);
}
