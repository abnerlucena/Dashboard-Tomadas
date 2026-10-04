// ─── Implementação GAS (Google Apps Script) ───────────────────
// Repassa cada operação para o api() atual com EXATAMENTE o mesmo payload que
// as telas enviavam antes da camada de dados existir. É o modo padrão.
import { api, type Session } from "../api";
import type { DataSource, MetaInfoRaw } from "./types";

/**
 * A sessão como o Apps Script devolve. `onboardingDone` chega como booleano ou
 * como o texto "false" — a planilha não distingue os dois.
 */
type SessaoBrutaGas = {
  token: string;
  nome: string;
  role: Session["role"];
  expiresAt?: string;
  onboardingDone?: boolean | string;
};

const toSession = (raw: { token: string; nome: string; role: Session["role"]; expiresAt?: string }): Session => ({
  token:     raw.token,
  nome:      raw.nome,
  role:      raw.role,
  expiresAt: raw.expiresAt,
});

export const gasDataSource: DataSource = {
  kind: "gas",

  auth: {
    async login(nome, senha) {
      const r = await api<{ session: SessaoBrutaGas }>("login", { nome, senha });
      const onboardingPending = r.session.onboardingDone === false || r.session.onboardingDone === "false";
      return { session: toSession(r.session), onboardingDone: !onboardingPending };
    },
    async register({ nome, senha, inviteCode }) {
      const r = await api<{ session: SessaoBrutaGas }>("register", { nome, senha, inviteCode });
      return { loggedIn: true, session: toSession(r.session), onboardingDone: true };
    },
    async logout() { /* sessão do GAS é só local: nada a fazer no servidor */ },
    async completeOnboarding(session) { await api("completeOnboarding", {}, session); },
    async isSessionValid() { return true; },
    watchSession() { return () => {}; },
    // O Apps Script guarda a senha na própria planilha e não envia e-mail.
    // Recuperar por conta própria não existe nesse modo, e fingir que existe
    // seria pior do que dizer a verdade.
    async requestPasswordReset() {
      throw new Error("A recuperação de senha por e-mail ainda não existe neste modo. Fale com o administrador.");
    },
    async setNewPassword() {
      throw new Error("A recuperação de senha por e-mail ainda não existe neste modo. Fale com o administrador.");
    },
  },

  production: {
    getAll: (session) => api("getAll", {}, session),
    async updateEntry() { throw new Error("Corrigir um apontamento só existe no modo Supabase."); },
    async saveEntries(records, _options, session) { await api("upsert", { records }, session); },
    async updateObs(r, obs, session) {
      const nowBR = new Date().toLocaleString("pt-BR");
      await api("upsert", {
        records: [{
          date: r.date,
          turno: r.turno,
          machineId: r.machineId,
          machineName: r.machineName,
          meta: r.meta,
          producao: r.producao,
          savedBy: r.savedBy,
          savedAt: r.savedAt || "",
          obs,
          editUser: session?.nome || "",
          editTime: nowBR,
        }],
      }, session);
    },
    async bulkDelete(ids, session) { await api("bulkDelete", { ids }, session); },
    async bulkMove(ids, newDate, session) { await api("bulkMove", { ids, newDate }, session); },
    async bulkEditTurno(ids, newTurno, session) { await api("bulkEditTurno", { ids, newTurno }, session); },
  },

  machines: {
    getMachines: (session) => api("getMachines", {}, session),
    async addMachine(name, defaultMeta, session) {
      await api("addMachine", { name, hasMeta: true, defaultMeta }, session);
    },
    toggleMachine: (machineId, session) => api("toggleMachine", { machineId }, session),
  },

  targets: {
    getMetas: (session) => api("getMetas", {}, session),
    async saveMetas(metas, vigenciaInicio, session) { await api("saveMetas", { metas, vigenciaInicio }, session); },
    async getHistory() { return []; },
    // A planilha do Apps Script guarda uma meta só por máquina, sem data de
    // vigência: não há passado para consultar. Devolver as de hoje é o mais
    // perto da verdade que este modo consegue chegar.
    async getMetasEm(_date, session) {
      const r = await api("getMetas", {}, session) as {
        metas?: Record<number, number>;
        metasInfo?: Record<number, MetaInfoRaw>;
      };
      return { metas: r.metas ?? {}, metasInfo: r.metasInfo ?? {} };
    },
  },

  calendar: {
    getHolidays: (session) => api("getHolidays", {}, session),
    async addHoliday(date, label, type, session) { await api("addHoliday", { date, label, type }, session); },
    async removeHoliday(id, session) { await api("removeHoliday", { id }, session); },
  },

  users: {
    listUsers: (session) => api("listUsers", {}, session),
    toggleUser: (target, session) => api("toggleUser", { targetNome: target.nome }, session),
    async adminCreateUser(nome, senha, session) { await api("adminCreateUser", { nome, senha }, session); },
    async resetPassword(targetNome, novaSenha, session) { await api("resetPassword", { targetNome, novaSenha }, session); },
    generateInviteCode: (session) => api("generateInviteCode", {}, session),
    async approveUser() { throw new Error("Aprovação de cadastro só existe no modo Supabase."); },
    async listPermissions() { throw new Error("Permissões por usuário só existem no modo Supabase."); },
    async getPermissions() { throw new Error("Permissões por usuário só existem no modo Supabase."); },
    async setPermissions() { throw new Error("Permissões por usuário só existem no modo Supabase."); },
    async listRoles() { return []; },
  },

  alerts: {
    getAlertConfig: (session) => api("getAlertConfig", {}, session),
    async saveAlertConfig(config, session) { await api("saveAlertConfig", { config }, session); },
    async testAlertEmail(session) { await api("testAlertEmail", {}, session); },
  },
};
