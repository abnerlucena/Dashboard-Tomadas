import type { ProductionEntryPayload } from "../../../../src/lib/repositories/types";
import type { Shift } from "@/data/machines";

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

/* ---------- Máquina que não produziu ---------- */

/**
 * "Não produziu" ainda não tem campo no banco: vai como apontamento SEM peça e
 * com a observação "Não produziu: <motivo>" (recado em
 * docs/database/notas/2026-10-09-maquina-que-nao-produziu.md). Quando o banco
 * criar o campo, só estas duas funções mudam.
 */
export const STOP_PREFIX = "Não produziu: ";
export const stopNote = (reason: string) => `${STOP_PREFIX}${reason.trim()}`;
/** O motivo, se a observação gravada for de uma máquina que não produziu */
export const parseStop = (notes: string): string | null => (notes.startsWith(STOP_PREFIX) ? notes.slice(STOP_PREFIX.length).trim() || null : null);

/* ---------- O que a tela manda ao salvar ---------- */

/** O que já está gravado para a máquina neste dia, turno e regime */
export interface ExistingRecord {
  id: string;
  /** null = não informado */
  operatorCount: number | null;
  notes: string;
  /** motivo, quando o apontamento é de uma máquina que não produziu */
  stopped?: string | null;
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
        ordemId: r.op.trim(),
        quantidade: qtyOf(r),
        ...(r.rework ? { retrabalho: true, ...(r.reason?.trim() ? { motivoRetrabalho: r.reason.trim() } : {}) } : {}),
      }));
    const note = stop ? stopNote(stop) : entry.note.trim();
    const people = operatorCountFor(entry.people);
    // A observação de "não produziu" não aparece no campo: o que se compara é só a observação escrita à mão
    const exNote = ex?.stopped ? "" : (ex?.notes ?? "");
    const noteChanged = ex ? note !== exNote : note !== "";
    const peopleChanged = ex ? (people || null) !== ex.operatorCount : false;

    if (!orders.length && !noteChanged && !peopleChanged) continue;
    if (!ex && !orders.length && !note) continue;

    const sendsPeople = !ex || peopleChanged;
    plan.push({
      machineId: m.id,
      needsSave: orders.length > 0 || (noteChanged && note !== "") || sendsPeople,
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
        // Num apontamento que já existe, sem mudança, não manda: o banco mantém
        ...(sendsPeople ? { operatorCount: people } : {}),
      },
      // Lançar peça numa máquina que constava como "não produziu": a observação antiga sai
      ...(ex && ((noteChanged && !note) || (ex.stopped && orders.length && !note)) ? { clearNoteOf: ex.id } : {}),
    });
  }
  return plan;
}
