import type { ProductionEntryPayload } from "../../../../src/lib/repositories/types";
import { NO_OP, type Shift } from "@/data/machines";

/**
 * Nº de operadores no payload do apontamento (`operatorCount`, nota de 01/10, § 3):
 *
 * | a tela manda    | o banco faz               |
 * |-----------------|---------------------------|
 * | não manda       | mantém o valor anterior   |
 * | 0               | apaga                     |
 * | um número       | grava                     |
 *
 * Campo vazio manda 0: quem salva o turno diz o que vale para ele, e vazio
 * quer dizer "não informado" — inclusive apagando um número salvo antes.
 */
export const operatorCountFor = (people: string): number => (people.trim() === "" ? 0 : Number(people));

/* ---------- Máquina que não produziu (D67) ---------- */

/**
 * Motivos sugeridos. O motivo final é texto livre; a marcação "planejada" vem
 * da sugestão escolhida e o operador pode mudá-la. Parada planejada sai da meta
 * do turno (como o dia anulado); as outras continuam contando.
 */
export const STOP_SUGGESTIONS: Array<{ reason: string; planned: boolean }> = [
  { reason: "Manutenção", planned: true },
  { reason: "Setup / troca", planned: true },
  { reason: "Sem OP", planned: false },
  { reason: "Sem operador", planned: false },
  { reason: "Falta de material", planned: false },
  { reason: "Máquina parada", planned: false },
];
/** A marcação sugerida para um motivo digitado; nenhuma se não for uma das sugestões */
export const plannedFor = (reason: string): boolean | null =>
  STOP_SUGGESTIONS.find((s) => s.reason.toLowerCase() === reason.trim().toLowerCase())?.planned ?? null;

/* ---------- O que a tela manda ao salvar ---------- */

/** O que já está gravado para a máquina neste dia, turno e regime */
export interface ExistingRecord {
  id: string;
  /** null = não informado */
  operatorCount: number | null;
  notes: string;
  /** motivo, quando o apontamento é de uma máquina que não produziu */
  stopped?: string | null;
  stopPlanned?: boolean;
}

export interface FormRow {
  op: string;
  qty: string;
  rework: boolean;
  /** motivo do retrabalho (obrigatório quando rework) */
  reason?: string;
}

export interface FormEntry {
  /** ordens NOVAS: salvar acrescenta às que já existem (D30) */
  rows: FormRow[];
  note: string;
  people: string;
  /** motivo de a máquina não ter produzido no turno; vazio = produziu */
  stop?: string;
  /** a parada é planejada: o turno sai da meta */
  stopPlanned?: boolean;
}

export interface EntryContext {
  /** "2026-10-03" */
  date: string;
  shift: Shift;
  overtime: boolean;
  /** nome de quem salva (o banco usa o login; o campo existe no contrato) */
  savedBy: string;
}

export interface PlannedSave {
  machineId: string;
  payload: ProductionEntryPayload;
  /**
   * Observação apagada num apontamento que já existia. `saveEntries` trata
   * observação vazia como "manter", então apagar vai por `updateObs(…, "")`.
   */
  clearNoteOf?: string;
  /** false quando a única mudança é apagar a observação: aí basta o `updateObs` */
  needsSave: boolean;
}

const qtyOf = (r: FormRow) => (r.qty.trim() === "" ? 0 : Number(r.qty));

/**
 * Decide o que mandar para cada máquina. Uma máquina só vai ao banco se tiver
 * algo a gravar:
 * - ordens novas com quantidade;
 * - observação diferente da gravada (num apontamento novo, qualquer observação:
 *   "máquina parada" sem peça nenhuma é um apontamento válido);
 * - nº de operadores diferente do gravado (só num apontamento que já existe:
 *   pessoas sem produção e sem observação não criam apontamento).
 */
export function planSaves(
  form: Record<string, FormEntry>,
  existing: Record<string, ExistingRecord | undefined>,
  machines: Array<{ id: string; name: string }>,
  ctx: EntryContext,
): PlannedSave[] {
  const plan: PlannedSave[] = [];
  for (const m of machines) {
    const entry = form[m.id];
    if (!entry) continue;
    const ex = existing[m.id];
    const stop = entry.stop?.trim() ?? "";
    // Máquina que não produziu: nenhuma OP vai, só o motivo
    const orders = (stop ? [] : entry.rows)
      .filter((r) => qtyOf(r) > 0)
      // Motivo do retrabalho no campo próprio da OP (D66)
      .map((r) => ({
        // Sem número, vai como "não informado" (ajuste temporário, ver NO_OP)
        ordemId: r.op.trim() || NO_OP,
        quantidade: qtyOf(r),
        ...(r.rework ? { retrabalho: true, ...(r.reason?.trim() ? { motivoRetrabalho: r.reason.trim() } : {}) } : {}),
      }));
    const note = stop ? "" : entry.note.trim();
    const people = operatorCountFor(entry.people);
    const noteChanged = ex ? note !== ex.notes : note !== "";
    const peopleChanged = ex ? (people || null) !== ex.operatorCount : false;

    if (!orders.length && !stop && !noteChanged && !peopleChanged) continue;
    if (!ex && !orders.length && !note && !stop) continue;

    const sendsPeople = !ex || peopleChanged;
    plan.push({
      machineId: m.id,
      needsSave: orders.length > 0 || !!stop || (noteChanged && note !== "") || sendsPeople,
      payload: {
        date: ctx.date,
        turno: `TURNO ${ctx.shift}`,
        machineId: Number(m.id),
        machineName: m.name,
        // A meta é congelada pelo banco no dia do apontamento (D08); a tela não manda
        meta: 0,
        producao: orders.reduce((s, o) => s + (o.retrabalho ? 0 : o.quantidade), 0),
        ordensProducao: orders,
        savedBy: ctx.savedBy,
        savedAt: "",
        obs: noteChanged ? note : "",
        // Máquina que não produziu: o banco guarda o motivo e a marcação (D67); lançar peças depois tira a parada sozinho
        ...(stop ? { motivoParada: stop, paradaPlanejada: entry.stopPlanned === true } : {}),
        // Num apontamento que já existe, sem mudança, não manda: o banco mantém
        ...(sendsPeople ? { operatorCount: people } : {}),
      },
      ...(ex && noteChanged && !note ? { clearNoteOf: ex.id } : {}),
    });
  }
  return plan;
}
