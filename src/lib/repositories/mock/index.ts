// ─── Implementação de mentira (VITE_DATA_SOURCE=mock) ─────────
// Para construir telas sem Supabase, sem Apps Script e sem ninguém cadastrado.
//
// O que é de verdade aqui: a ÁREA DE ACESSO inteira (login, crachá da conta
// compartilhada, cadastro pendente, aprovação, bloqueio, recuperação de senha),
// com as mesmas mensagens e regras do modo Supabase. Contas em ./contas.ts.
//
// O que NÃO é: produção, máquinas, metas, calendário e alertas devolvem vazio,
// e toda escrita nessas áreas recusa com aviso. A UI nova já tem os próprios
// dados de demonstração para essas telas; duplicá-los aqui criaria uma segunda
// verdade fictícia.
import type { DataSource } from "../types";
import { mockAuth, mockUsers } from "./acesso";

const semBanco = () => { throw new Error("Modo de demonstração: não há banco para gravar."); };

export const mockDataSource: DataSource = {
  kind: "mock",
  auth: mockAuth,
  users: mockUsers,

  production: {
    async getAll() { return { data: [] }; },
    saveEntries: semBanco,
    updateObs: semBanco,
    updateEntry: semBanco,
    bulkDelete: semBanco,
    bulkMove: semBanco,
    bulkEditTurno: semBanco,
  },
  machines: {
    async getMachines() { return { machines: [], allMachines: [] }; },
    addMachine: semBanco,
    toggleMachine: semBanco,
  },
  targets: {
    async getMetas() { return { metas: {}, metasInfo: {} }; },
    saveMetas: semBanco,
    async getHistory() { return []; },
    async getMetasEm() { return { metas: {}, metasInfo: {} }; },
  },
  calendar: {
    async getHolidays() { return { holidays: [] }; },
    addHoliday: semBanco,
    addHolidays: semBanco,
    removeHoliday: semBanco,
  },
  alerts: {
    async getAlertConfig() { return {}; },
    saveAlertConfig: semBanco,
    testAlertEmail: semBanco,
  },
};

export { resetarMock } from "./acesso";
export { SENHA_DEMO, CRACHAS_DA_CONTA_COMPARTILHADA } from "./contas";
