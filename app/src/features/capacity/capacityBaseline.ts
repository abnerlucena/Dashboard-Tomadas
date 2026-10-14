/*
 * Base FICTÍCIA do simulador de capacidade (repositório público).
 * Mesma estrutura, processos e fórmulas da planilha "Capacidade vs Pessoas";
 * peças/min, eficiência e pessoas foram trocados por valores plausíveis.
 * Os números reais ficam em capacityBaseline.local.ts (fora do Git).
 */
import type { Scenario } from "./capacityModel";

const deductions = { meal: 30, gymnastics: 10, breakTime: 10, changeover: 15 };

export const BASELINE: Scenario = {
  workingDays: 22,
  shifts: [
    // Reproduz o ponto de atenção da planilha: 1º e 2º turno com o mesmo horário
    { label: "1º turno", start: "14:18", end: "23:24", grossMinutes: 558, ...deductions },
    { label: "2º turno", start: "14:18", end: "23:24", grossMinutes: 546, ...deductions },
    { label: "3º turno", start: "23:24", end: "05:00", grossMinutes: 336, ...deductions },
  ],
  processes: [
    // ---------- Montagem ----------
    { id: "m1", area: "montagem", name: "Máquina de interruptores Composé nº 1", rate: 11.5, people: [1, 1, 0], efficiency: 0.88, regime: 3 },
    { id: "m2", area: "montagem", name: "Embaladora kit parafusos nº 1", rate: 28, people: [0, 0, 1], efficiency: 0.62, regime: 2, note: "No 1º e 2º turno, o operador da Composé nº 1 também atende esta máquina (células mescladas na planilha)." },
    { id: "m3", area: "montagem", name: "Embaladora kit parafusos nº 2", rate: 28, people: [0, 0, 0], efficiency: 0.62, regime: 2, note: "Operada pela mesma pessoa da Composé nº 1 no 1º e 2º turno (células mescladas na planilha)." },
    { id: "m4", area: "montagem", name: "Máquina de tomadas Composé (Aumaq)", rate: 27, people: [1, 1, 1], efficiency: 0.82, regime: 3 },
    { id: "m5", area: "montagem", name: "Bancada nº 1 · teste de interruptores", rate: 12, people: [1, 1, 1], efficiency: 0.65, regime: 3 },
    { id: "m6", area: "montagem", name: "Bancada nº 2 · montagem de interruptores", rate: 5, people: [1, 1, 0], efficiency: 0.62, regime: 2 },
    { id: "m7", area: "montagem", name: "Bancada nº 3 · diversos", rate: 7, people: [1, 1, 0], efficiency: 0.58, regime: 2 },
    { id: "m8", area: "montagem", name: "Bancada nº 4 · diversos", rate: 7, people: [1, 1, 0], efficiency: 0.58, regime: 2 },
    { id: "m9", area: "montagem", name: "Bancada nº 5 · eletrônicos", rate: 5, people: [1, 1, 0], efficiency: 0.6, regime: 2 },
    { id: "m10", area: "montagem", name: "Prensa de inserção de contatos", rate: 4.5, people: [2, 1, 0], efficiency: 0.62, regime: 2 },
    { id: "m11", area: "montagem", name: "Máquina de plugue Slin (Aumaq)", rate: 15, people: [1, 1, 0], efficiency: 0.64, regime: 2 },
    { id: "m12", area: "montagem", name: "Prensa Tox", rate: 6.5, people: [1, 1, 0], efficiency: 0.6, regime: 2 },
    { id: "m13", area: "montagem", name: "Prensa placa Refinatto", rate: 5.5, people: [0, 0, 0], efficiency: 0.6, regime: 2, note: "Operada pela mesma pessoa da Prensa Tox (células mescladas na planilha)." },
    { id: "m14", area: "montagem", name: "Máquina de interruptores (nova base)", rate: null, people: [1, 1, 1], efficiency: 0.6, regime: 3 },
    { id: "m15", area: "montagem", name: "Máquina de plugue fêmea", rate: null, people: [1, 1, 0], efficiency: 0.6, regime: 2 },
    { id: "m16", area: "montagem", name: "Máquina de tomadas nº 2", rate: null, people: [1, 0, 0], efficiency: 0.6, regime: 2 },
    // ---------- Embalagem ----------
    { id: "e1", area: "embalagem", name: "Embaladora vertical conjuntos nº 1", rate: 15, people: [2, 2, 0], efficiency: 0.72, regime: 2, group: "conjuntos" },
    { id: "e2", area: "embalagem", name: "Embaladora vertical conjuntos nº 2", rate: 15, people: [2, 2, 0], efficiency: 0.72, regime: 2, group: "conjuntos" },
    { id: "e3", area: "embalagem", name: "Embaladora horizontal nº 1", rate: 31, people: [3, 4, 0], efficiency: 0.68, regime: 2, group: "horizontal" },
    { id: "e4", area: "embalagem", name: "Embaladora horizontal nº 2", rate: 31, people: [4, 3, 0], efficiency: 0.68, regime: 2, group: "horizontal" },
    { id: "e5", area: "embalagem", name: "Embaladora 4x2 suportes/placas nº 1", rate: 22, people: [2, 2, 0], efficiency: 0.72, regime: 2, group: "4x2" },
    { id: "e6", area: "embalagem", name: "Embaladora 4x2 suportes/placas nº 2", rate: 22, people: [2, 2, 0], efficiency: 0.72, regime: 2, group: "4x2" },
    { id: "e7", area: "embalagem", name: "Embaladora vertical módulos nº 1", rate: 30, people: [2, 1, 0], efficiency: 0.78, regime: 2, group: "modulos" },
    { id: "e8", area: "embalagem", name: "Embaladora vertical módulos nº 2", rate: 30, people: [1, 2, 0], efficiency: 0.78, regime: 2, group: "modulos" },
    { id: "e9", area: "embalagem", name: "Bancada de embalagem a granel", rate: 60, people: [1, 1, 0], efficiency: 0.72, regime: 2 },
    { id: "e10", area: "embalagem", name: "Embaladora vertical Lufati Klin padrão", rate: 38, people: [1, 1, 0], efficiency: 0.7, regime: 2 },
    { id: "e11", area: "embalagem", name: "Embaladora vertical Lufati placa + suporte 4x4", rate: 38, people: [2, 1, 0], efficiency: 0.7, regime: 2 },
    { id: "e12", area: "embalagem", name: "Embaladora vertical plugues", rate: 24, people: [1, 1, 0], efficiency: 0.68, regime: 2 },
    { id: "e13", area: "embalagem", name: "Embaladora vertical conjuntos nº 3", rate: 24, people: [1, 1, 0], efficiency: 0.7, regime: 2 },
  ],
  support: [
    { id: "a1", area: "apoio", name: "Distribuição de materiais", people: [2, 2, 0, 0] },
    { id: "a2", area: "apoio", name: "Preparação de máquinas", people: [2, 1, 0, 0] },
    { id: "a3", area: "apoio", name: "Técnico de produção", people: [1, 0, 0, 0] },
    { id: "a4", area: "apoio", name: "Chefe de produção", people: [1, 1, 0, 0] },
    { id: "i1", area: "injecao", name: "Operador de injeção", people: [3, 3, 2, 0] },
    { id: "i2", area: "injecao", name: "Preparador de injeção", people: [1, 1, 1, 0] },
    { id: "i3", area: "injecao", name: "Ferramenteiro", people: [0, 0, 0, 1] },
  ],
};
