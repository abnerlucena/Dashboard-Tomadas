// ─── Máquinas, metas e calendário ─────────────────────────────
import { getSupabase } from "../../supabase";
import type { DataSource, MetaInfoRaw } from "../types";
import { MACHINE_STATUS_TO_LEGACY, holidayTypeToEventType, toHoliday, toMachine, type CalendarRow } from "./adapters";
import { loadProfileNames, toError } from "./helpers";

async function currentTargets() {
  const { data, error } = await getSupabase()
    .from("current_machine_targets")
    .select("machine_id, quantity_per_shift, valid_from, created_by, created_at, basis");
  if (error) throw toError(error);
  return data || [];
}

export const supabaseMachines: DataSource["machines"] = {
  async getMachines() {
    const sb = getSupabase();
    const [{ data, error }, targets] = await Promise.all([
      sb.from("machines").select("id, name, has_target, status, standard_operator_count, process").order("id"),
      currentTargets(),
    ]);
    if (error) throw toError(error);
    const byMachine = new Map(targets.map(t => [t.machine_id, t.quantity_per_shift ?? 0]));
    const all = (data || []).map(m => toMachine(m, byMachine.get(m.id)));
    return { machines: all.filter(m => m.status !== "inativo"), allMachines: all };
  },

  async addMachine(name, defaultMeta) {
    const { error } = await getSupabase().rpc("create_machine", { p_name: name, p_initial_target: defaultMeta });
    if (error) throw toError(error);
  },

  async toggleMachine(machineId) {
    const sb = getSupabase();
    const { data: current, error } = await sb.from("machines").select("status").eq("id", machineId).single();
    if (error || !current) throw toError(error, "Máquina não encontrada.");
    const next = current.status === "inactive" ? "active" : "inactive";
    const { data: updated, error: upError } = await sb
      .from("machines").update({ status: next }).eq("id", machineId).select("id");
    if (upError) throw toError(upError);
    // Sem permissão, o RLS não dá erro: simplesmente não altera nenhuma linha.
    if (!updated || updated.length === 0) throw new Error("Você não tem permissão para alterar máquinas.");
    return { newStatus: MACHINE_STATUS_TO_LEGACY[next] };
  },
};

export const supabaseTargets: DataSource["targets"] = {
  async getMetas() {
    const [targets, names] = await Promise.all([currentTargets(), loadProfileNames(getSupabase())]);
    const metas: Record<number, number> = {};
    const metasInfo: Record<number, MetaInfoRaw> = {};
    for (const t of targets) {
      if (t.machine_id == null) continue;
      metas[t.machine_id] = t.quantity_per_shift ?? 0;
      metasInfo[t.machine_id] = {
        updatedBy: (t.created_by && names.get(t.created_by)) || "carga inicial",
        updatedAt: t.created_at ?? "",
        vigenciaInicio: t.valid_from ?? "",
        // D39/D47: o número pode ser do turno, rateado pela lotação
        // (horizontais) ou de cada pessoa (A Granél).
        basis: t.basis === "per_operator" || t.basis === "per_shift_prorated"
          ? t.basis
          : "per_shift",
      };
    }
    return { metas, metasInfo };
  },

  async saveMetas(metas, vigenciaInicio, _session, bases) {
    const { error } = await getSupabase().rpc("save_machine_targets", {
      p_targets: metas,
      p_valid_from: vigenciaInicio || undefined,
      // Sem bases, a função preserva a que cada máquina já tinha.
      p_bases: bases && Object.keys(bases).length ? bases : undefined,
    });
    if (error) throw toError(error);
  },

  async getHistory() {
    const sb = getSupabase();
    const [{ data, error }, names] = await Promise.all([
      sb.from("machine_targets")
        .select("machine_id, quantity_per_shift, valid_from, created_by, created_at")
        .order("valid_from", { ascending: false }),
      loadProfileNames(sb),
    ]);
    if (error) throw toError(error);
    return (data || []).map(t => ({
      machineId: t.machine_id,
      quantity: t.quantity_per_shift,
      validFrom: t.valid_from,
      createdBy: (t.created_by && names.get(t.created_by)) || "",
      createdAt: t.created_at,
    }));
  },

  /**
   * A meta e a base que valiam NUMA DATA. É a mesma regra da view
   * `current_machine_targets`, só que para o dia pedido em vez de hoje: de
   * todos os degraus da máquina que já começaram naquela data, vale o mais
   * recente.
   *
   * Feito no app e não no banco porque a tabela é pequena (algumas dezenas de
   * linhas) e qualquer usuário ativo pode lê-la — não vale uma função nova no
   * banco para isso.
   */
  async getMetasEm(date) {
    const sb = getSupabase();
    const [{ data, error }, names] = await Promise.all([
      sb.from("machine_targets")
        .select("machine_id, quantity_per_shift, valid_from, created_by, created_at, basis")
        .lte("valid_from", date)
        .order("valid_from", { ascending: false }),
      loadProfileNames(sb),
    ]);
    if (error) throw toError(error);

    const metas: Record<number, number> = {};
    const metasInfo: Record<number, MetaInfoRaw> = {};
    // Vem ordenado do mais recente para o mais antigo: a primeira linha de
    // cada máquina é o degrau vigente naquela data. As seguintes são passado.
    for (const t of data || []) {
      if (t.machine_id == null || metas[t.machine_id] !== undefined) continue;
      metas[t.machine_id] = t.quantity_per_shift ?? 0;
      metasInfo[t.machine_id] = {
        updatedBy: (t.created_by && names.get(t.created_by)) || "carga inicial",
        updatedAt: t.created_at ?? "",
        vigenciaInicio: t.valid_from ?? "",
        basis: t.basis === "per_operator" || t.basis === "per_shift_prorated"
          ? t.basis
          : "per_shift",
      };
    }
    return { metas, metasInfo };
  },
};

export const supabaseCalendar: DataSource["calendar"] = {
  async getHolidays() {
    const sb = getSupabase();
    const [{ data, error }, names] = await Promise.all([
      sb.from("calendar_events")
        .select("id, event_date, description, event_type, created_by, created_at, calendar_event_shifts(shift_id)")
        .order("event_date"),
      loadProfileNames(sb),
    ]);
    if (error) throw toError(error);
    return { holidays: ((data || []) as CalendarRow[]).map(r => toHoliday(r, names)) };
  },

  // Eventos cadastrados pelo app entram com abrangência "company" até a tela
  // ganhar esse campo (pendência registrada no CHANGELOG 0.7.0).
  async addHoliday(date, label, type, _session, shiftIds) {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("calendar_events")
      .insert({ event_date: date, description: label, event_type: holidayTypeToEventType(type), scope: "company" })
      .select("id")
      .single();
    if (error || !data) throw toError(error);
    if (shiftIds && shiftIds.length > 0) {
      const { error: shiftError } = await sb
        .from("calendar_event_shifts")
        .insert(shiftIds.map(shift_id => ({ event_id: data.id, shift_id })));
      if (shiftError) throw toError(shiftError);
    }
  },

  async removeHoliday(id) {
    const { data, error } = await getSupabase().from("calendar_events").delete().eq("id", id).select("id");
    if (error) throw toError(error);
    if (!data || data.length === 0) throw new Error("Você não tem permissão para remover eventos do calendário.");
  },
};
