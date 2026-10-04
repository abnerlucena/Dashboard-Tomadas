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
// Erros simulados: OP "9999999" na máquina 12; trocar para o TURNO 3.
const R = "/@fs" + process.cwd().split("\\").join("/") + "/src/lib/repositories/mock";
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
    async updateObs(record, obs) { window.__calls = window.__calls || []; window.__calls.push({ updateObs: record.id, obs }); const r = F.records.find(x => x.id === record.id); if (r) r.obs = obs; },
    async bulkDelete(ids) { window.__calls = window.__calls || []; window.__calls.push({ bulkDelete: ids }); F.records = F.records.filter(r => !ids.includes(r.id)); },
    async bulkMove(ids, d) { window.__calls = window.__calls || []; window.__calls.push({ bulkMove: ids, d }); for (const r of F.records) if (ids.includes(r.id)) r.date = d; },
    async bulkEditTurno(ids, t) { window.__calls = window.__calls || []; window.__calls.push({ bulkEditTurno: ids, t }); if (t === "TURNO 3") throw new Error("Já existe apontamento desta máquina neste dia e turno."); for (const r of F.records) if (ids.includes(r.id)) r.turno = t; } },
  machines: { async getMachines() { return { machines: F.machines, allMachines: F.machines }; }, addMachine: no, toggleMachine: no },
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
  calendar: { async getHolidays() { return { holidays: F.holidays }; }, addHoliday: no, removeHoliday: no },
  alerts: { async getAlertConfig() { return {}; }, saveAlertConfig: no, testAlertEmail: no },
};
export { resetarMock } from "${R}/acesso.ts";
export { SENHA_DEMO, CRACHAS_DA_CONTA_COMPARTILHADA } from "${R}/contas.ts";
`;
