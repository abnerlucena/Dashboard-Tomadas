// Banco falso para testar a interface no navegador SEM Supabase, gravando em memória.
//
// Substitui o módulo src/lib/repositories/mock/index.ts (o modo mock da sessão do
// banco, que só tem a área de acesso) por um com produção, máquinas, metas em
// degraus com vigência, feriados e as operações de gravação. Cada chamada de
// gravação fica em window.__calls, para o teste conferir o que a tela mandou.
//
// Uso (servidor: VITE_DATA_SOURCE=mock npx vite --config prototype/vite.config.ts):
//   import { moduleSource } from "./e2e/support/banco-falso.mjs";
//   await page.route(/repositories\/mock\/index\.ts/, (r) =>
//     r.fulfill({ contentType: "application/javascript", body: moduleSource }));
//   login: gestor@demo.local / 123456 (contas do mock do banco)
//
// Dados: 4 máquinas (ids 11–14), agosto e setembro/2026 até 21/09, feriado 07/09.
// Erros simulados: OP "9999999" na máquina 12; trocar para o TURNO 3; cadastrar 31/12 no calendário;
// máquina com "recusa" no nome; OP repetida; passagem de etapa fora da regra; corrigir para um destino ocupado; A Granél (13) sem nº de pessoas.
// No Windows o caminho começa com a letra do disco (C:/...): o /@fs/ precisa da barra
const CWD = process.cwd().split("\\").join("/").replace(/^(?!\/)/, "/");
const R = "/@fs" + CWD + "/src/lib/repositories/mock";
const machines = [
  { id: 11, name: "Máquina de tomadas Composé (Aumaq)", hasMeta: true, defaultMeta: 11000, status: "ativo" },
  { id: 12, name: "Embaladora horizontal nº 1", hasMeta: true, defaultMeta: 9200, status: "ativo", standardOperatorCount: 4 },
  { id: 13, name: "Bancada de embalagem A Granél", hasMeta: true, defaultMeta: 25000, status: "ativo", standardOperatorCount: 1 },
  { id: 14, name: "Prensa Tox", hasMeta: false, defaultMeta: 0, status: "ativo" },
];
const records = [];
let seq = 0;
const pad = (n) => String(n).padStart(2, "0");
for (let month = 7; month <= 8; month++) {
  for (let day = 1; day <= 31; day++) {
    const d = new Date(2026, month, day);
    if (d.getMonth() !== month || d.getDay() === 0 || d.getDay() === 6) continue;
    if (month === 8 && day > 21) continue; // último dado: 21/09
    const iso = `2026-${pad(month + 1)}-${pad(day)}`;
    for (const m of machines) {
      for (const t of [1, 2]) {
        if ((day + m.id + t) % 7 === 0) continue; // alguns turnos sem apontamento
        const meta = m.id === 13 ? 25000 * 2 : m.hasMeta ? m.defaultMeta : 0;
        const good = Math.round((m.hasMeta ? m.defaultMeta : 3000) * (0.6 + ((day * 7 + m.id * 3 + t) % 50) / 100));
        const rw = (day + t) % 9 === 0 ? 120 : 0;
        records.push({
          id: `r${++seq}`, date: iso, turno: `TURNO ${t}`, machineId: m.id, machineName: m.name,
          meta, producao: good, savedBy: seq % 5 === 0 ? "" : ["Ana Ribeiro", "Carlos Lima", "Marcos Vieira"][seq % 3],
          savedAt: `${pad(day)}/${pad(month + 1)}/2026, ${t === 1 ? "14" : "23"}:${pad(seq % 60)}:00`,
          obs: seq % 13 === 0 ? "Parada de 20 min para troca de bobina." : "",
          ordensProducao: [
            { ordemId: seq % 5 === 0 ? "IMPORTADO" : String(4510000 + seq), quantidade: good },
            ...(rw ? [{ ordemId: String(4519000 + seq), quantidade: rw, retrabalho: true }] : []),
          ],
          workMode: "regular", goodQuantity: good, reworkQuantity: rw, targetQuantity: meta, countsTowardTarget: meta > 0,
          operatorCount: m.id === 13 ? 2 : null,
        });
      }
    }
  }
}
// hora extra no T3 (não conta para meta)
records.push({ id: "ot1", date: "2026-09-19", turno: "TURNO 3", machineId: 11, machineName: machines[0].name, meta: 0, producao: 4000,
  savedBy: "Ana Ribeiro", savedAt: "20/09/2026, 04:50:00", obs: "", ordensProducao: [{ ordemId: "4518888", quantidade: 4000 }],
  workMode: "overtime", goodQuantity: 4000, reworkQuantity: 0, targetQuantity: 11000, countsTowardTarget: false });
const fixture = {
  records, machines,
  metas: { 11: 11000, 12: 9200, 13: 25000 },
  metasInfo: { 12: { updatedBy: "", updatedAt: "", vigenciaInicio: "2026-08-01", basis: "per_shift_prorated" }, 13: { updatedBy: "", updatedAt: "", vigenciaInicio: "2026-08-01", basis: "per_operator" } },
  history: [{ machineId: 11, quantity: 11000, validFrom: "2026-08-01", createdBy: "Gestor Demo", createdAt: "2026-07-30T10:00:00Z" }],
  holidays: [{ id: "h1", date: "2026-09-07", label: "Independência", type: "feriado" }],
};
export const moduleSource = `
import { mockAuth, mockUsers } from "${R}/acesso.ts";
const F = ${JSON.stringify(fixture)};
const no = () => { throw new Error("somente leitura"); };
export const mockDataSource = {
  kind: "mock", auth: mockAuth, users: mockUsers,
  production: {
    async getAll() { await new Promise(r => setTimeout(r, 200)); return { data: F.records }; },
    async saveEntries(entries, options) {
      window.__calls = window.__calls || []; window.__calls.push({ entries, options });
      for (const e of entries) {
        if (e.machineId === 12 && (e.ordensProducao || []).some(o => o.ordemId === "9999999")) throw new Error("Já existe apontamento desta máquina neste dia e turno, e você não tem permissão para alterá-lo.");
        const mode = options.workMode || "regular";
        let r = F.records.find(x => x.date === e.date && x.turno === e.turno && x.machineId === e.machineId && (x.workMode || "regular") === mode);
        if (!r) { r = { id: "n" + Math.random().toString(36).slice(2), date: e.date, turno: e.turno, machineId: e.machineId, machineName: e.machineName, meta: mode === "overtime" ? 0 : 11000, producao: 0, savedBy: "Gestor Demo", savedAt: "03/10/2026, 15:00:00", obs: "", ordensProducao: [], workMode: mode, goodQuantity: 0, reworkQuantity: 0, operatorCount: null }; F.records.unshift(r); }
        r.ordensProducao.push(...e.ordensProducao);
        r.goodQuantity = r.ordensProducao.filter(o => !o.retrabalho).reduce((s, o) => s + o.quantidade, 0); r.producao = r.goodQuantity;
        r.reworkQuantity = r.ordensProducao.filter(o => o.retrabalho).reduce((s, o) => s + o.quantidade, 0);
        if (e.obs && e.obs.trim()) r.obs = e.obs.trim();
        if (e.operatorCount !== undefined) r.operatorCount = e.operatorCount === 0 ? null : e.operatorCount;
      }
    },
    async updateEntry(id, c) {
      window.__calls = window.__calls || []; window.__calls.push({ updateEntry: id, changes: c });
      const r = F.records.find(x => x.id === id); if (!r) throw new Error("Apontamento não encontrado.");
      const date = c.date ?? r.date, turno = c.turno ?? r.turno, mode = c.workMode ?? (r.workMode || "regular");
      const other = F.records.find(x => x !== r && x.machineId === r.machineId && x.date === date && x.turno === turno && (x.workMode || "regular") === mode);
      if (other) throw new Error("Já existe apontamento da " + r.machineName.toUpperCase() + " em " + date.split("-").reverse().join("/") + ", Turno " + turno.slice(-1) + ". Corrija ou apague aquele antes.");
      const people = c.operatorCount !== undefined ? (c.operatorCount || null) : r.operatorCount;
      if (r.machineId === 13 && !people) throw new Error("Informe quantas pessoas trabalharam neste turno: a meta desta máquina é por pessoa.");
      if (c.ordensProducao) {
        r.ordensProducao = c.ordensProducao;
        r.goodQuantity = c.ordensProducao.filter(o => !o.retrabalho).reduce((t, o) => t + o.quantidade, 0); r.producao = r.goodQuantity;
        r.reworkQuantity = c.ordensProducao.filter(o => o.retrabalho).reduce((t, o) => t + o.quantidade, 0);
      }
      Object.assign(r, { date, turno, workMode: mode, operatorCount: people });
      if (c.obs !== undefined) r.obs = c.obs;
    },
    async updateObs(record, obs) { window.__calls = window.__calls || []; window.__calls.push({ updateObs: record.id, obs }); const r = F.records.find(x => x.id === record.id); if (r) r.obs = obs; },
    async bulkDelete(ids) { window.__calls = window.__calls || []; window.__calls.push({ bulkDelete: ids }); F.records = F.records.filter(r => !ids.includes(r.id)); },
    async bulkMove(ids, d) { window.__calls = window.__calls || []; window.__calls.push({ bulkMove: ids, d }); for (const r of F.records) if (ids.includes(r.id)) r.date = d; },
    async bulkEditTurno(ids, t) { window.__calls = window.__calls || []; window.__calls.push({ bulkEditTurno: ids, t }); if (t === "TURNO 3") throw new Error("Já existe apontamento desta máquina neste dia e turno."); for (const r of F.records) if (ids.includes(r.id)) r.turno = t; } },
  machines: {
    async getMachines() { return { machines: F.machines.filter(m => m.status !== "inativo"), allMachines: F.machines }; },
    async addMachine(name, defaultMeta) {
      window.__calls = window.__calls || []; window.__calls.push({ addMachine: name, defaultMeta });
      if (/recusa/i.test(name)) throw new Error("Você não tem permissão para cadastrar máquinas.");
      F.machines.push({ id: 100 + F.machines.length, name, hasMeta: true, defaultMeta, status: "ativo" });
    },
    async toggleMachine(id) {
      window.__calls = window.__calls || []; window.__calls.push({ toggleMachine: id });
      const m = F.machines.find(x => x.id === id); m.status = m.status === "inativo" ? "ativo" : "inativo"; return { newStatus: m.status };
    },
  },
  targets: (() => {
    F.steps = F.steps || [
      { machineId: 11, quantity: 11000, validFrom: "2026-08-01", basis: "per_shift", createdBy: "Gestor Demo", createdAt: "2026-07-30T10:00:00Z" },
      { machineId: 12, quantity: 9200, validFrom: "2026-08-01", basis: "per_shift_prorated", createdBy: "Gestor Demo", createdAt: "2026-07-30T10:00:00Z" },
      { machineId: 13, quantity: 25000, validFrom: "2026-08-01", basis: "per_operator", createdBy: "Gestor Demo", createdAt: "2026-07-30T10:00:00Z" },
    ];
    const on = (date) => {
      const metas = {}, metasInfo = {};
      for (const t of [...F.steps].sort((a, b) => b.validFrom.localeCompare(a.validFrom))) {
        if (t.validFrom > date || metas[t.machineId] !== undefined) continue;
        metas[t.machineId] = t.quantity;
        metasInfo[t.machineId] = { updatedBy: t.createdBy, updatedAt: t.createdAt, vigenciaInicio: t.validFrom, basis: t.basis };
      }
      return { metas, metasInfo };
    };
    const today = new Date().toLocaleDateString("en-CA");
    return {
      async getMetas() { return on(today); },
      async saveMetas(metas, from, _s, bases) {
        window.__calls = window.__calls || []; window.__calls.push({ saveMetas: metas, from, bases });
        if (from < today) throw new Error("A vigência não pode ser no passado.");
        const cur = on(from);
        for (const [id, q] of Object.entries(metas)) {
          const basis = (bases || {})[id] || cur.metasInfo[id]?.basis || "per_shift";
          if (cur.metas[id] === q && cur.metasInfo[id]?.basis === basis) continue;
          F.steps = F.steps.filter(t => !(t.machineId === Number(id) && t.validFrom === from));
          F.steps.push({ machineId: Number(id), quantity: q, validFrom: from, basis, createdBy: "Gabriela Gestora", createdAt: new Date().toISOString() });
        }
      },
      async getHistory() { return F.steps.map(({ basis, ...t }) => t); },
      async getMetasEm(date) { window.__metasEm = (window.__metasEm || []).concat(date); return on(date); },
    };
  })(),
  calendar: {
    async getHolidays() { return { holidays: F.holidays }; },
    async addHoliday(date, label, type, _s, shiftIds) {
      window.__calls = window.__calls || []; window.__calls.push({ addHoliday: date, label, type, shiftIds });
      if (date.endsWith("-12-31")) throw new Error("Você não tem permissão para cadastrar no calendário.");
      F.holidays.push({ id: "c" + Math.random().toString(36).slice(2), date, label, type, createdBy: "Gabriela Gestora", eventType: type === "dia_anulado" ? "excluded_day" : "holiday", shiftIds: shiftIds || [] });
    },
    async addHolidays(dates, label, type, _s, options) {
      window.__calls = window.__calls || []; window.__calls.push({ addHolidays: dates, label, type, options });
      // Tudo ou nada (D61): um dia ruim barra o intervalo inteiro
      if (dates.some(d => d.endsWith("-12-31"))) throw new Error("Você não tem permissão para cadastrar no calendário.");
      for (const date of new Set(dates)) F.holidays.push({ id: "c" + Math.random().toString(36).slice(2), date, label, type, createdBy: "Gabriela Gestora", eventType: type === "dia_anulado" ? "excluded_day" : "holiday", shiftIds: options?.shiftIds || [], scope: options?.scope || "company" });
      return new Set(dates).size;
    },
    async removeHoliday(id) { window.__calls = window.__calls || []; window.__calls.push({ removeHoliday: id }); F.holidays = F.holidays.filter(h => h.id !== id); },
  },
  // OPs (D62): 4510248 em produção na Composé, 4519100 aguardando, 4599123 a conferir (nasceu de um apontamento)
  workOrders: (() => {
    const ME = "Gabriela Gestora";
    const now = () => new Date().toISOString();
    F.wo = F.wo || [
      { id: "wo1", orderNumber: "4510248", machineId: 11, materialCode: "12345678", materialDescription: "Tomada 10A", plannedQuantity: 30000, producedQuantity: 10010, reworkQuantity: 0, stage: "running", pauseReason: null, releasedAt: "2026-09-20T10:00:00Z", closedAt: null, source: "app", createdAt: "2026-09-19T10:00:00Z", lastEntryAt: "2026-09-21T17:00:00Z", unread: 1 },
      { id: "wo2", orderNumber: "4519100", machineId: 12, materialCode: "87654321", materialDescription: "Interruptor simples", plannedQuantity: 12000, producedQuantity: 0, reworkQuantity: 0, stage: "waiting", pauseReason: null, releasedAt: null, closedAt: null, source: "app", createdAt: "2026-09-21T09:00:00Z", lastEntryAt: null, unread: 0 },
      { id: "wo3", orderNumber: "4599123", machineId: 12, materialCode: null, materialDescription: null, plannedQuantity: null, producedQuantity: 2500, reworkQuantity: 0, stage: "pending_review", pauseReason: null, releasedAt: null, closedAt: null, source: "apontamento", createdAt: "2026-09-21T15:00:00Z", lastEntryAt: "2026-09-21T15:00:00Z", unread: 0 },
    ];
    F.msgs = F.msgs || {
      wo1: [
        { id: "m1", workOrderId: "wo1", at: "2026-09-20T10:00:00Z", kind: "system", author: "", text: "OP liberada para produção por Gabriela Gestora.", shiftId: null, rework: false },
        { id: "m2", workOrderId: "wo1", at: "2026-09-21T16:00:00Z", kind: "operator_note", author: "Ana Ribeiro", text: "Troca de bobina no meio do turno.", shiftId: 1, rework: false },
      ],
      wo2: [], wo3: [],
    };
    const log = (c) => { window.__calls = window.__calls || []; window.__calls.push(c); };
    const sys = (id, text) => F.msgs[id].push({ id: "s" + Math.random().toString(36).slice(2), workOrderId: id, at: now(), kind: "system", author: "", text, shiftId: null, rework: false });
    const PASSAGENS = { waiting: ["running"], running: ["paused", "done"], paused: ["running", "done"], done: ["running"] };
    return {
      async list() { await new Promise(r => setTimeout(r, 150)); return F.wo.map(w => ({ ...w })); },
      async create(input) {
        log({ createWorkOrder: input });
        if (F.wo.some(w => w.orderNumber === input.orderNumber)) throw new Error("Já existe uma OP com esse número.");
        const id = "wo" + (F.wo.length + 1);
        F.wo.unshift({ id, orderNumber: input.orderNumber, machineId: input.machineId, materialCode: input.materialCode ?? null, materialDescription: input.materialDescription ?? null, plannedQuantity: input.plannedQuantity ?? null, producedQuantity: 0, reworkQuantity: 0, stage: "waiting", pauseReason: null, releasedAt: null, closedAt: null, source: "app", createdAt: now(), lastEntryAt: null, unread: 0 });
        F.msgs[id] = []; sys(id, "OP cadastrada por " + ME + ". Aguardando liberação.");
        return id;
      },
      async update(id, changes) {
        log({ updateWorkOrder: id, changes });
        const w = F.wo.find(x => x.id === id); Object.assign(w, changes);
        if (w.stage === "pending_review") { w.stage = "waiting"; sys(id, "OP conferida por " + ME + "."); }
      },
      async setStage(id, stage, reason) {
        log({ setStage: id, stage, reason });
        const w = F.wo.find(x => x.id === id);
        if (!(PASSAGENS[w.stage] || []).includes(stage)) throw new Error("Passagem não permitida: de " + w.stage + " para " + stage + ".");
        if (stage === "paused" && !reason) throw new Error("Informe o motivo da pausa.");
        w.stage = stage; w.pauseReason = stage === "paused" ? reason : null;
        if (stage === "running" && !w.releasedAt) w.releasedAt = now();
        w.closedAt = stage === "done" ? now() : null;
        sys(id, stage === "paused" ? "Pausada por " + ME + ": " + reason + "." : stage === "done" ? "OP concluída por " + ME + "." : "OP em produção (" + ME + ").");
      },
      async conversation(id) { await new Promise(r => setTimeout(r, 100)); return F.msgs[id].map(m => ({ ...m })); },
      async postMessage(id, text) {
        log({ postMessage: id, text });
        const w = F.wo.find(x => x.id === id);
        if (w.stage === "done") throw new Error("A OP está concluída: a conversa não aceita mensagem nova.");
        F.msgs[id].push({ id: "u" + Math.random().toString(36).slice(2), workOrderId: id, at: now(), kind: "message", author: ME, text, shiftId: null, rework: false });
        w.unread = 0;
      },
      async markRead(id) { log({ markRead: id }); F.wo.find(x => x.id === id).unread = 0; },
    };
  })(),
  alerts: { async getAlertConfig() { return {}; }, saveAlertConfig: no, testAlertEmail: no },
};
export { resetarMock } from "${R}/acesso.ts";
export { SENHA_DEMO, CRACHAS_DA_CONTA_COMPARTILHADA } from "${R}/contas.ts";
`;
