import type { UpdateEntryChanges } from "../../../../src/lib/repositories/types";
import { toIsoDate, type ProductionOrder, type RecordOrder, type Shift } from "@/data/machines";

/*
 * Corrigir UM apontamento inteiro pelo `production.updateEntry` (D59).
 *
 * Regras do contrato que a tela segue (comentário de UpdateEntryChanges):
 * - campo ausente = não mexer; só vai o que mudou;
 * - `ordensProducao` SUBSTITUI a lista (vazia tira todas as OPs);
 * - `obs: ""` apaga (o contrário do saveEntries, de propósito);
 * - `operatorCount: 0` apaga o nº de pessoas.
 * E as do banco: OP só com números, até 15 dígitos (D57); `IMPORTADO` só no
 * apontamento importado, que é como a carga da planilha entrou.
 */

export const IMPORTED_OP = "IMPORTADO";
const OP_PATTERN = /^\d{1,15}$/;

export interface DraftRow {
  /** chave de tela; não vai para o banco */
  key: string;
  op: string;
  qty: string;
  rework: boolean;
  /** observação da OP: não é editada aqui, mas volta igual para o banco */
  note: string;
  /** motivo do retrabalho (D66): também não é editado aqui e volta igual; sem retrabalho, o banco descarta */
  reason: string;
}

export interface EditDraft {
  rows: DraftRow[];
  date: string;
  shift: Shift;
  overtime: boolean;
  people: string;
  notes: string;
}

/** O apontamento como estava, para comparar */
export interface EditOriginal {
  orders: RecordOrder[];
  date: string;
  shift: Shift;
  overtime: boolean;
  operatorCount: number | null;
  notes: string;
}

let seq = 0;
export const newDraftRow = (r: Partial<DraftRow> = {}): DraftRow => ({ key: `r${++seq}`, op: "", qty: "", rework: false, note: "", reason: "", ...r });

/** O apontamento de uma linha da tabela (só com dados do banco: precisa de `record`) */
export function originalOf(order: ProductionOrder): EditOriginal | null {
  const r = order.record;
  if (!r) return null;
  return {
    orders: (r.orders ?? []).filter((o) => o.quantity > 0),
    date: toIsoDate(order.date),
    shift: order.shift,
    overtime: r.overtime,
    operatorCount: r.operatorCount,
    notes: r.notes,
  };
}

export function draftOf(o: EditOriginal): EditDraft {
  return {
    rows: o.orders.length
      ? o.orders.map((x) => newDraftRow({ op: x.op, qty: String(x.quantity), rework: x.rework, note: x.note, reason: x.reason ?? "" }))
      : [newDraftRow()],
    date: o.date,
    shift: o.shift,
    overtime: o.overtime,
    people: o.operatorCount ? String(o.operatorCount) : "",
    notes: o.notes,
  };
}

/** Linha em branco (sem OP e sem quantidade) não conta: some ao salvar */
const isBlank = (r: DraftRow) => !r.op.trim() && !r.qty.trim();

export const isImported = (o: EditOriginal) => o.orders.some((x) => x.op === IMPORTED_OP);

export interface DraftErrors {
  rows: Record<string, { op?: string; qty?: string }>;
  people?: string;
  date?: string;
  any: boolean;
}

export function validateDraft(d: EditDraft, original: EditOriginal, today: string): DraftErrors {
  const rows: DraftErrors["rows"] = {};
  const imported = isImported(original);
  for (const r of d.rows) {
    if (isBlank(r)) continue;
    const e: { op?: string; qty?: string } = {};
    const op = r.op.trim();
    if (!op) e.op = "Informe a OP";
    else if (op === IMPORTED_OP ? !imported : !OP_PATTERN.test(op)) e.op = "Use só números, até 15 dígitos";
    if (!/^\d+$/.test(r.qty.trim()) || Number(r.qty) <= 0) e.qty = "Quantidade inteira maior que zero";
    if (e.op || e.qty) rows[r.key] = e;
  }
  const people = d.people.trim();
  const errors: DraftErrors = { rows, any: false };
  if (people && (!/^\d+$/.test(people) || Number(people) < 1 || Number(people) > 99)) errors.people = "De 1 a 99 pessoas";
  if (!d.date) errors.date = "Escolha a data";
  else if (d.date > today) errors.date = "Não é possível apontar em datas futuras";
  errors.any = Object.keys(rows).length > 0 || !!errors.people || !!errors.date;
  return errors;
}

const sameOrders = (a: RecordOrder[], b: RecordOrder[]) =>
  a.length === b.length &&
  a.every((x, i) => x.op === b[i].op && x.quantity === b[i].quantity && x.rework === b[i].rework && x.note === b[i].note && (x.reason ?? "") === (b[i].reason ?? ""));

/** Só o que mudou; null = nada a salvar */
export function changesOf(d: EditDraft, o: EditOriginal): UpdateEntryChanges | null {
  const c: UpdateEntryChanges = {};
  const orders: RecordOrder[] = d.rows
    .filter((r) => !isBlank(r))
    .map((r) => ({ op: r.op.trim(), quantity: Number(r.qty), rework: r.rework, note: r.note, reason: r.reason }));
  if (!sameOrders(orders, o.orders))
    c.ordensProducao = orders.map((x) => ({
      ordemId: x.op,
      quantidade: x.quantity,
      retrabalho: x.rework,
      ...(x.note ? { obs: x.note } : {}),
      ...(x.rework && x.reason ? { motivoRetrabalho: x.reason } : {}),
    }));
  if (d.date !== o.date) c.date = d.date;
  if (d.shift !== o.shift) c.turno = `TURNO ${d.shift}`;
  if (d.overtime !== o.overtime) c.workMode = d.overtime ? "overtime" : "regular";
  if (d.notes.trim() !== o.notes) c.obs = d.notes.trim();
  const people = d.people.trim() ? Number(d.people) : null;
  if (people !== o.operatorCount) c.operatorCount = people ?? 0;
  return Object.keys(c).length ? c : null;
}

/** Totais do rascunho, para o resumo do diálogo */
export function draftTotals(d: EditDraft) {
  const valid = d.rows.filter((r) => !isBlank(r) && /^\d+$/.test(r.qty.trim()));
  return {
    good: valid.filter((r) => !r.rework).reduce((s, r) => s + Number(r.qty), 0),
    rework: valid.filter((r) => r.rework).reduce((s, r) => s + Number(r.qty), 0),
  };
}
