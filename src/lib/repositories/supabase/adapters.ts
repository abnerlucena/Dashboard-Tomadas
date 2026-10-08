// ─── Adaptadores: formato do banco ⇄ formato atual das telas ──
// Funções puras (sem acesso a rede), testadas em src/test/adapters.test.ts.
//
// Regras de negócio aplicadas aqui, na fronteira, para que os gráficos
// atuais passem a seguir o desenho do banco sem serem reescritos:
//   • producao = produção BOA (good_quantity). Retrabalho não é produção
//     nova (D11); ele continua visível nas ordens marcadas como retrabalho.
//   • meta = 0 quando o apontamento NÃO conta para meta — hora extra (D27)
//     ou dia/turno anulado (D16). Os gráficos já ignoram meta 0 no cálculo
//     de atingimento; a produção continua somando no total.
//   • meta = a meta EFETIVA do turno (`effective_target`, D39/D46): em A Granél
//     a meta é por pessoa, e a view já entrega 25.000 × pessoas. Antes daqui
//     passava o número cru, e três pessoas na bancada davam 300% de
//     atingimento.
import type { Tables } from "../../database.types";
import type { Holiday, HolidayScope, Machine, OrdemProducao, ProdRecord } from "../../api";
import type { MachineChanges, NewMachineInput, UpdateEntryChanges, WorkOrderMessage, WorkOrderRecord, WorkOrderStage } from "../types";

export type SummaryRow = Tables<"production_summary">;
export type OrderRow = Pick<Tables<"production_orders">, "production_record_id" | "order_number" | "quantity" | "is_rework" | "notes" | "rework_reason">;
export type MachineRow = Pick<Tables<"machines">, "id" | "name" | "has_target" | "status"> &
  Partial<Pick<Tables<"machines">, "standard_operator_count" | "process">>;
export type CalendarRow = Pick<Tables<"calendar_events">, "id" | "event_date" | "description" | "event_type" | "created_by" | "created_at"> &
  Partial<Pick<Tables<"calendar_events">, "scope">> & {
  calendar_event_shifts?: { shift_id: number }[] | null;
};

export const shiftName = (shiftId: number) => `TURNO ${shiftId}`;

export function shiftIdFromTurno(turno: string): number {
  const m = /(\d+)\s*$/.exec(String(turno || ""));
  if (!m) throw new Error(`Turno inválido: ${turno}`);
  return Number(m[1]);
}

export const MACHINE_STATUS_TO_LEGACY: Record<string, string> = {
  active: "ativo",
  inactive: "inativo",
  maintenance: "manutencao",
  preventive_maintenance: "preventiva",
};

/** Data/hora no mesmo formato que o legado gravava ("20/09/2026, 10:30:00"). */
export function toLegacyDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

export function toOrdens(orders: OrderRow[]): OrdemProducao[] {
  return orders.map(o => {
    const ordem: OrdemProducao = { ordemId: o.order_number, quantidade: o.quantity };
    if (o.notes) ordem.obs = o.notes;
    if (o.is_rework) ordem.retrabalho = true;
    if (o.rework_reason) ordem.motivoRetrabalho = o.rework_reason;
    return ordem;
  });
}

export function toProdRecord(row: SummaryRow, orders: OrderRow[], names: Map<string, string>): ProdRecord {
  const counts = row.counts_toward_target === true;
  // A meta efetiva já vem pronta do banco: multiplicada pelas pessoas quando a
  // base é por operador, e rateada (com teto) quando é conforme a lotação.
  //
  // O `??` cobre a linha em que a view não soube calcular — apontamento sem
  // meta cadastrada, por exemplo. Aí vale o número cru, e na falta dele, zero.
  const target = row.effective_target ?? row.target_quantity ?? 0;
  const rec: ProdRecord = {
    id: row.id ?? undefined,
    date: row.production_date ?? "",
    turno: row.shift_name ?? shiftName(row.shift_id ?? 0),
    machineId: row.machine_id ?? 0,
    machineName: row.machine_name ?? "",
    meta: counts ? target : 0,
    producao: row.good_quantity ?? 0,
    savedBy: (row.created_by && names.get(row.created_by)) || "",
    savedAt: toLegacyDateTime(row.created_at),
    obs: row.notes ?? "",
    ordensProducao: toOrdens(orders),
    workMode: row.work_mode === "overtime" ? "overtime" : "regular",
    goodQuantity: row.good_quantity ?? 0,
    reworkQuantity: row.rework_quantity ?? 0,
    targetQuantity: target,
    countsTowardTarget: counts,
    isExcludedDay: row.is_excluded_day === true,
    operatorCount: row.operator_count,
  };
  if (row.updated_by) {
    rec.editUser = names.get(row.updated_by) || "";
    rec.editTime = toLegacyDateTime(row.updated_at);
  }
  return rec;
}

/** Junta os apontamentos com as ordens de cada um. */
export function buildProdRecords(rows: SummaryRow[], orders: OrderRow[], names: Map<string, string>): ProdRecord[] {
  const byRecord = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const list = byRecord.get(o.production_record_id);
    if (list) list.push(o); else byRecord.set(o.production_record_id, [o]);
  }
  return rows.map(r => toProdRecord(r, (r.id && byRecord.get(r.id)) || [], names));
}

/** Ordens da tela (formato legado) → JSON esperado por save_production_record. */
/**
 * Argumentos de update_production_record a partir de uma correção (D59).
 * Só entra o que veio: no banco, parâmetro ausente quer dizer "mantém".
 */
export function toUpdateEntryArgs(id: string, c: UpdateEntryChanges) {
  const args: {
    p_id: string;
    p_orders?: ReturnType<typeof toOrdersJson>;
    p_production_date?: string;
    p_shift_id?: number;
    p_work_mode?: "regular" | "overtime";
    p_notes?: string;
    p_operator_count?: number;
  } = { p_id: id };

  // Lista vazia vale: o apontamento fica sem peça (máquina parada), como o
  // saveEntries só com observação. Ausente é que mantém as OPs.
  if (c.ordensProducao !== undefined) args.p_orders = toOrdersJson(c.ordensProducao);
  if (c.date !== undefined) args.p_production_date = c.date;
  if (c.turno !== undefined) args.p_shift_id = shiftIdFromTurno(c.turno);
  if (c.workMode !== undefined) args.p_work_mode = c.workMode;
  if (c.obs !== undefined) args.p_notes = c.obs;              // "" apaga
  if (c.operatorCount !== undefined) args.p_operator_count = c.operatorCount;  // 0 apaga (D52)

  if (Object.keys(args).length === 1) throw new Error("Nada para corrigir.");
  return args;
}

type WorkOrderRow = Tables<"work_order_summary">;
type ConversationRow = Pick<Tables<"work_order_conversation">, "id" | "work_order_id" | "created_at" | "author_id" | "kind" | "body" | "shift_id" | "is_rework">;

const STAGES: WorkOrderStage[] = ["pending_review", "waiting", "running", "paused", "done"];

/**
 * OP do banco para o formato do contrato (D62). `unread` vem calculado à
 * parte, porque depende de quem está lendo.
 */
export function toWorkOrder(row: WorkOrderRow, unread = 0): WorkOrderRecord {
  const stage = STAGES.includes(row.stage as WorkOrderStage) ? (row.stage as WorkOrderStage) : "waiting";
  const source = row.source === "sap" || row.source === "apontamento" ? row.source : "app";
  return {
    id: row.id ?? "",
    orderNumber: row.order_number ?? "",
    machineId: row.machine_id ?? 0,
    materialCode: row.material_code,
    materialDescription: row.material_description,
    plannedQuantity: row.planned_quantity,
    producedQuantity: row.produced_quantity ?? 0,
    reworkQuantity: row.rework_quantity ?? 0,
    stage,
    pauseReason: row.pause_reason,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    source,
    createdAt: row.created_at ?? "",
    lastEntryAt: row.last_entry_at,
    unread,
  };
}

export function toWorkOrderMessage(row: ConversationRow, names: Map<string, string>): WorkOrderMessage {
  const kind = row.kind === "system" || row.kind === "operator_note" ? row.kind : "message";
  return {
    id: row.id ?? "",
    workOrderId: row.work_order_id ?? "",
    at: row.created_at ?? "",
    kind,
    author: kind === "system" ? "" : (row.author_id && names.get(row.author_id)) || "",
    text: row.body ?? "",
    shiftId: row.shift_id,
    rework: row.is_rework === true,
  };
}

/**
 * Quantas mensagens cada OP tem que esta pessoa ainda não leu: as posteriores
 * à última leitura dela, sem contar as que ela mesma escreveu.
 */
export function contarNaoLidas(
  linhas: { work_order_id: string | null; created_at: string | null; author_id: string | null }[],
  leituras: Map<string, string>,
  eu: string | undefined,
): Map<string, number> {
  const naoLidas = new Map<string, number>();
  for (const l of linhas) {
    if (!l.work_order_id || !l.created_at) continue;
    if (eu && l.author_id === eu) continue;
    const lida = leituras.get(l.work_order_id);
    if (lida && l.created_at <= lida) continue;
    naoLidas.set(l.work_order_id, (naoLidas.get(l.work_order_id) ?? 0) + 1);
  }
  return naoLidas;
}

/** Argumentos de create_machine (D63). */
export function toCreateMachineArgs(input: NewMachineInput) {
  if (!input.name.trim()) throw new Error("O nome da máquina é obrigatório.");
  return {
    p_name: input.name.trim(),
    p_process: input.process,
    p_initial_target: Math.max(0, Math.round(input.defaultMeta || 0)),
    ...(input.hasMeta !== undefined ? { p_has_target: input.hasMeta } : {}),
    ...(input.standardOperatorCount !== undefined ? { p_standard_operator_count: input.standardOperatorCount } : {}),
    ...(input.basis !== undefined ? { p_basis: input.basis } : {}),
  };
}

/** Argumentos de update_machine (D63). Só o que veio. */
export function toUpdateMachineArgs(id: number, c: MachineChanges) {
  const args = {
    p_id: id,
    ...(c.name !== undefined ? { p_name: c.name } : {}),
    ...(c.process !== undefined ? { p_process: c.process } : {}),
    ...(c.standardOperatorCount !== undefined ? { p_standard_operator_count: c.standardOperatorCount } : {}),
  };
  if (Object.keys(args).length === 1) throw new Error("Nada para alterar.");
  return args;
}

export function toOrdersJson(ordens: OrdemProducao[] | undefined) {
  return (ordens || [])
    .filter(o => Number(o.quantidade) > 0)
    .map(o => ({
      order_number: String(o.ordemId ?? "").trim(),
      quantity: Math.round(Number(o.quantidade)),
      is_rework: o.retrabalho === true,
      notes: o.obs ? String(o.obs) : null,
      // Só retrabalho tem motivo (D66); o banco descarta o resto de qualquer jeito.
      rework_reason: o.retrabalho === true && o.motivoRetrabalho?.trim() ? o.motivoRetrabalho.trim() : null,
    }));
}

export function toMachine(row: MachineRow, target: number | undefined): Machine {
  return {
    id: row.id,
    name: row.name,
    hasMeta: row.has_target,
    defaultMeta: target ?? 0,
    status: MACHINE_STATUS_TO_LEGACY[row.status] ?? row.status,
    // Lotação padrão do posto: é o divisor da meta rateada (D47).
    standardOperatorCount: row.standard_operator_count ?? null,
    // Só quando o banco disse. Sem a coluna na consulta, o campo fica ausente:
    // inventar uma linha aqui seria pior do que não ter nenhuma.
    ...(row.process === "assembly" || row.process === "packaging" ? { process: row.process } : {}),
  };
}

export function holidayTypeToEventType(type: Holiday["type"]): "holiday" | "excluded_day" {
  return type === "dia_anulado" ? "excluded_day" : "holiday";
}

export function toHoliday(row: CalendarRow, names: Map<string, string>): Holiday {
  const eventType = row.event_type as Holiday["eventType"];
  return {
    id: row.id,
    date: row.event_date,
    label: row.description,
    type: eventType === "excluded_day" ? "dia_anulado" : "feriado",
    createdBy: (row.created_by && names.get(row.created_by)) || "",
    createdAt: row.created_at,
    eventType,
    shiftIds: (row.calendar_event_shifts || []).map(s => s.shift_id).sort(),
    ...(isHolidayScope(row.scope) ? { scope: row.scope } : {}),
  };
}

const isHolidayScope = (s: unknown): s is HolidayScope =>
  s === "national" || s === "state" || s === "municipal" || s === "company";

/** Argumentos de add_calendar_events (D61). */
export function toAddCalendarArgs(
  dates: string[], label: string, type: Holiday["type"],
  options: { shiftIds?: number[]; scope?: HolidayScope } = {},
) {
  if (dates.length === 0) throw new Error("Informe ao menos um dia.");
  return {
    p_dates: dates,
    p_description: label,
    p_event_type: holidayTypeToEventType(type),
    p_scope: options.scope ?? "company",
    ...(options.shiftIds && options.shiftIds.length ? { p_shift_ids: options.shiftIds } : {}),
  };
}

export const PROFILE_STATUS_TO_LEGACY: Record<string, string> = {
  active: "ativo",
  blocked: "bloqueado",
  pending: "pendente",
};
