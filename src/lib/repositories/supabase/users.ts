// ─── Usuários, aprovação e alertas ────────────────────────────
import { getSupabase } from "../../supabase";
import type { AdminUser, DataSource, PermissionOption, UserPermission } from "../types";
import { PROFILE_STATUS_TO_LEGACY } from "./adapters";
import { loadProfileNames, toError } from "./helpers";

export const supabaseUsers: DataSource["users"] = {
  async listUsers() {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, badge_number, account_type, status, created_at, roles(code, name)")
      .order("status", { ascending: false })   // pending primeiro
      .order("full_name");
    if (error) throw toError(error);
    const users: AdminUser[] = (data || []).map(p => {
      const role = p.roles as { code: string; name: string } | null;
      return {
        id: p.id,
        nome: p.full_name,
        status: PROFILE_STATUS_TO_LEGACY[p.status] ?? p.status,
        role: role && ["manager", "admin"].includes(role.code) ? "admin" : "user",
        roleName: role?.name ?? null,
        badgeNumber: p.badge_number,
        accountType: p.account_type,
      };
    });
    return { users };
  },

  // Alterna entre ativo e bloqueado. Cadastro pendente se aprova com approveUser.
  async toggleUser(target) {
    if (!target.id) throw new Error("Usuário sem identificador.");
    if (target.status === "pendente") throw new Error("Cadastro pendente: use \"Aprovar\".");
    const next = target.status === "ativo" ? "blocked" : "active";
    const { data, error } = await getSupabase().from("profiles").update({ status: next }).eq("id", target.id).select("id");
    if (error) throw toError(error);
    if (!data || data.length === 0) throw new Error("Você não tem permissão para alterar usuários.");
    return { newStatus: PROFILE_STATUS_TO_LEGACY[next] };
  },

  // A criação de contas e a troca de senha pelo gestor exigiriam a chave
  // service_role, que nunca pode ir para o navegador (D19). No modo Supabase
  // cada pessoa se cadastra pela tela de login e o gestor aprova (D20).
  // ─── Permissões, uma a uma (D22) ────────────────────────────────
  // Tudo aqui é acesso direto à tabela, sem função nova no banco: a RLS de
  // user_permissions já diz que só quem tem users.approve lê a de outro e só
  // ele insere ou apaga. Uma RPC seria um segundo cadeado na mesma porta.

  async listPermissions(): Promise<PermissionOption[]> {
    const { data, error } = await getSupabase()
      .from("permissions").select("code, description").order("code");
    if (error) throw toError(error);
    return (data || []).map(x => ({ code: x.code, description: x.description ?? x.code }));
  },

  async getPermissions(userId): Promise<UserPermission[]> {
    const sb = getSupabase();
    const [{ data, error }, names] = await Promise.all([
      sb.from("user_permissions")
        .select("permission_code, granted_by, granted_at")
        .eq("user_id", userId)
        .order("permission_code"),
      loadProfileNames(sb),
    ]);
    if (error) throw toError(error);
    return (data || []).map(r => ({
      code: r.permission_code,
      // Vazio quando veio da aprovação inicial, que copia o perfil sem autor.
      grantedBy: (r.granted_by && names.get(r.granted_by)) || "",
      grantedAt: r.granted_at ?? "",
    }));
  },

  async setPermissions(userId, permissions, session) {
    const sb = getSupabase();
    const { data: atuais, error } = await sb
      .from("user_permissions").select("permission_code").eq("user_id", userId);
    if (error) throw toError(error);

    const tinha = new Set((atuais || []).map(r => r.permission_code));
    const quer = new Set(permissions);
    const retirar = [...tinha].filter(c => !quer.has(c));
    const conceder = [...quer].filter(c => !tinha.has(c));
    if (!retirar.length && !conceder.length) return;

    // Só o que mudou. Apagar tudo e regravar daria a mesma lista final, mas
    // carimbaria todas as permissões com a data e o autor de hoje — e o rastro
    // de quem concedeu o quê é o motivo de esta coluna existir.
    if (retirar.length) {
      const { error: e } = await sb.from("user_permissions")
        .delete().eq("user_id", userId).in("permission_code", retirar);
      if (e) throw toError(e);
    }
    if (conceder.length) {
      const { error: e } = await sb.from("user_permissions").insert(
        conceder.map(code => ({ user_id: userId, permission_code: code, granted_by: session?.userId ?? null })),
      );
      if (e) throw toError(e);
    }

    // Sem permissão o RLS não dá erro: apenas não altera linha nenhuma. Por
    // isso o resultado é conferido, como em toggleMachine e removeHoliday.
    const { data: depois } = await sb
      .from("user_permissions").select("permission_code").eq("user_id", userId);
    const agora = new Set((depois || []).map(r => r.permission_code));
    const bateu = agora.size === quer.size && [...quer].every(c => agora.has(c));
    if (!bateu) throw new Error("Você não tem permissão para alterar permissões de usuários.");
  },

  async approveUser(userId, roleId) {
    const { error } = await getSupabase().rpc("approve_user", { p_user_id: userId, p_role_id: roleId });
    if (error) throw toError(error);
  },

  async listRoles() {
    const { data, error } = await getSupabase().from("roles").select("id, code, name").order("id");
    if (error) throw toError(error);
    return data || [];
  },
};
