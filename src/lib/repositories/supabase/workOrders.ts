// ─── OPs (D62) ────────────────────────────────────────────────
// Tudo o que grava passa por funções do banco: a RLS só deixa ler.
import { getSupabase } from "../../supabase";
import type { DataSource } from "../types";
import { contarNaoLidas, toWorkOrder, toWorkOrderMessage } from "./adapters";
import { fetchAll, loadProfileNames, toError } from "./helpers";

export const supabaseWorkOrders: DataSource["workOrders"] = {
  async list(session) {
    const sb = getSupabase();
    const [ops, conversa, leituras] = await Promise.all([
      fetchAll((from, to) => sb.from("work_order_summary").select("*").order("created_at", { ascending: false }).range(from, to)),
      // Para contar as não lidas. Quem não vê a conversa (o operador) recebe
      // lista vazia da RLS, e fica com zero não lidas.
      fetchAll((from, to) => sb.from("work_order_conversation").select("work_order_id, created_at, author_id").range(from, to)),
      sb.from("work_order_reads").select("work_order_id, last_read_at"),
    ]);
    if (leituras.error) throw toError(leituras.error);
    const lidas = new Map((leituras.data || []).map(r => [r.work_order_id, r.last_read_at]));
    const naoLidas = contarNaoLidas(conversa, lidas, session?.userId);
    return ops.map(o => toWorkOrder(o, naoLidas.get(o.id ?? "") ?? 0));
  },

  async create(input) {
    const { data, error } = await getSupabase().rpc("create_work_order", {
      p_order_number: input.orderNumber,
      p_machine_id: input.machineId,
      p_material_code: input.materialCode,
      p_material_description: input.materialDescription,
      p_planned_quantity: input.plannedQuantity,
    });
    if (error) throw toError(error);
    return data as string;
  },

  async update(id, changes) {
    const { error } = await getSupabase().rpc("update_work_order", {
      p_id: id,
      p_machine_id: changes.machineId,
      p_material_code: changes.materialCode,
      p_material_description: changes.materialDescription,
      p_planned_quantity: changes.plannedQuantity,
    });
    if (error) throw toError(error);
  },

  async setStage(id, stage, reason) {
    const { error } = await getSupabase().rpc("set_work_order_stage", { p_id: id, p_stage: stage, p_reason: reason });
    if (error) throw toError(error);
  },

  async conversation(id) {
    const sb = getSupabase();
    const [{ data, error }, names] = await Promise.all([
      sb.from("work_order_conversation")
        .select("id, work_order_id, created_at, author_id, kind, body, shift_id, is_rework")
        .eq("work_order_id", id)
        .order("created_at"),
      loadProfileNames(sb),
    ]);
    if (error) throw toError(error);
    return (data || []).map(r => toWorkOrderMessage(r, names));
  },

  async postMessage(id, text) {
    const { error } = await getSupabase().rpc("post_work_order_message", { p_id: id, p_body: text });
    if (error) throw toError(error);
  },

  async markRead(id) {
    const { error } = await getSupabase().rpc("mark_work_order_read", { p_id: id });
    if (error) throw toError(error);
  },
};
