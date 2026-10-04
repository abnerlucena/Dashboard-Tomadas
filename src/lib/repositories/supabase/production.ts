// ─── Apontamentos de produção ─────────────────────────────────
// Leitura: view production_summary + production_orders.
// Escrita: somente pelas funções do banco (RPC), que conferem permissões.
import { getSupabase } from "../../supabase";
import type { DataSource } from "../types";
import { toUpdateEntryArgs, buildProdRecords, shiftIdFromTurno, toOrdersJson, type OrderRow, type SummaryRow } from "./adapters";
import { fetchAll, loadProfileNames, toError } from "./helpers";

export const supabaseProduction: DataSource["production"] = {
  async getAll() {
    const sb = getSupabase();
    const [rows, orders, names] = await Promise.all([
      fetchAll<SummaryRow>((from, to) =>
        sb.from("production_summary").select("*").order("production_date", { ascending: false }).order("id").range(from, to)),
      fetchAll<OrderRow>((from, to) =>
        sb.from("production_orders")
          .select("production_record_id, order_number, quantity, is_rework, notes")
          .order("created_at").order("id").range(from, to)),
      loadProfileNames(sb),
    ]);
    return { data: buildProdRecords(rows, orders, names) };
  },

  // Tela de Apontamento. Cada máquina preenchida vira uma chamada de
  // save_production_record: cria o apontamento ou COMPLETA o existente,
  // acrescentando as ordens (D10/D30). Observação vazia = manter a atual.
  async saveEntries(entries, options) {
    const sb = getSupabase();
    const workMode = options.workMode ?? "regular";
    for (const e of entries) {
      const { error } = await sb.rpc("save_production_record", {
        p_production_date: e.date,
        p_shift_id: shiftIdFromTurno(e.turno),
        p_machine_id: e.machineId,
        p_orders: toOrdersJson(e.ordensProducao),
        p_notes: e.obs?.trim() ? e.obs.trim() : undefined,
        p_work_mode: workMode,
        p_operator_count: e.operatorCount ?? undefined,
      });
      if (error) throw toError(error);
    }
  },

  // Aba Feedbacks: editar/apagar só a observação ("" apaga).
  async updateObs(record, obs) {
    if (!record.id) throw new Error("Apontamento sem identificador.");
    const { error } = await getSupabase().rpc("update_production_record", { p_id: record.id, p_notes: obs });
    if (error) throw toError(error);
  },

  // Histórico: corrigir UM apontamento (D59). As OPs informadas substituem as
  // que estavam; o resto, se não vier, fica como está.
  async updateEntry(id, changes) {
    const { error } = await getSupabase().rpc("update_production_record", toUpdateEntryArgs(id, changes));
    if (error) throw toError(error);
  },

  async bulkDelete(ids) {
    const { error } = await getSupabase().rpc("bulk_delete_production_records", { p_ids: ids });
    if (error) throw toError(error);
  },

  async bulkMove(ids, newDate) {
    const { error } = await getSupabase().rpc("bulk_update_production_records", { p_ids: ids, p_new_date: newDate });
    if (error) throw toError(error);
  },

  async bulkEditTurno(ids, newTurno) {
    const { error } = await getSupabase().rpc("bulk_update_production_records", {
      p_ids: ids,
      p_new_shift_id: shiftIdFromTurno(newTurno),
    });
    if (error) throw toError(error);
  },
};
