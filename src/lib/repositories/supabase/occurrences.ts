// ─── Ocorrências do turno (D70) ───────────────────────────────
// Toda escrita passa pelas funções do banco. A falta por nome é lida pela
// `list_shift_absences`, que esconde o nome de quem não tem collaborators.manage.
import { getSupabase } from "../../supabase";
import type { DataSource } from "../types";
import {
  toAbsence, toCollaborator, toCreateCollaboratorArgs, toSaveAbsenceArgs, toSaveShortageArgs,
  toShortage, toUpdateCollaboratorArgs, type AbsenceRow,
} from "./adapters";
import { fetchAll, toError } from "./helpers";

export const supabaseOccurrences: DataSource["occurrences"] = {
  async listCollaborators() {
    const sb = getSupabase();
    const rows = await fetchAll((from, to) => sb.from("collaborators").select("*").order("name").range(from, to));
    return rows.map(toCollaborator);
  },

  async createCollaborator(input) {
    const { data, error } = await getSupabase().rpc("create_collaborator", toCreateCollaboratorArgs(input));
    if (error) throw toError(error);
    return data as string;
  },

  async updateCollaborator(id, changes) {
    const { error } = await getSupabase().rpc("update_collaborator", toUpdateCollaboratorArgs(id, changes));
    if (error) throw toError(error);
  },

  async setCollaboratorActive(id, active) {
    const { data, error } = await getSupabase().rpc("set_collaborator_active", { p_id: id, p_active: active });
    if (error) throw toError(error);
    return (data as number) ?? 0;
  },

  async listShiftOccurrences(from, to, session) {
    const sb = getSupabase();
    const [faltas, materiais] = await Promise.all([
      sb.rpc("list_shift_absences", { p_from: from, p_to: to }),
      fetchAll((a, b) => sb.from("material_shortage_summary").select("*")
        .gte("production_date", from).lte("production_date", to)
        .order("production_date").order("shift_id").range(a, b)),
    ]);
    if (faltas.error) throw toError(faltas.error);
    return {
      absences: ((faltas.data || []) as AbsenceRow[]).map(toAbsence),
      shortages: materiais.map(m => toShortage(m, session?.userId)),
    };
  },

  async saveAbsence(input) {
    const { data, error } = await getSupabase().rpc("save_shift_absence", toSaveAbsenceArgs(input));
    if (error) throw toError(error);
    return data as string;
  },

  async removeAbsence(id) {
    const { error } = await getSupabase().rpc("remove_shift_absence", { p_id: id });
    if (error) throw toError(error);
  },

  async saveShortage(input) {
    const { data, error } = await getSupabase().rpc("save_material_shortage", toSaveShortageArgs(input));
    if (error) throw toError(error);
    return data as string;
  },

  async removeShortage(id) {
    const { error } = await getSupabase().rpc("remove_material_shortage", { p_id: id });
    if (error) throw toError(error);
  },
};
