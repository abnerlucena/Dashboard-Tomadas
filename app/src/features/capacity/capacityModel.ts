/*
 * Modelo de capacidade — transcrito da planilha
 * "Capacidade vs Pessoas 2026–2027 (REV01)", Seção Produção Tomadas &
 * Interruptores, Itajaí. As fórmulas reproduzem as da planilha:
 *
 *   tempo útil do turno  = tempo bruto − refeição − ginástica − intervalo − troca/limpeza
 *   capacidade técnica   = peças/min × média do tempo útil dos turnos do regime
 *                          (regime 3: T1,T2,T3 · regime 2: T1,T2 · regime 1: T1)
 *   meta por turno       = capacidade técnica × eficiência   (coluna J)
 *   capacidade diária    = meta por turno × regime           (coluna K)
 *   capacidade mensal    = capacidade diária × dias úteis
 */

export type ShiftIndex = 0 | 1 | 2;
export type Regime = 1 | 2 | 3;
export type Area = "montagem" | "embalagem";

export interface ShiftSchedule {
  label: string;
  start: string;
  end: string;
  grossMinutes: number;
  meal: number;
  gymnastics: number;
  breakTime: number;
  changeover: number;
}

export interface Process {
  id: string;
  area: Area;
  name: string;
  /** peças por minuto; null = máquina nova ainda sem taxa definida */
  rate: number | null;
  /** pessoas no 1º, 2º e 3º turno */
  people: [number, number, number];
  /** 0–1 */
  efficiency: number;
  regime: Regime;
  /** processos somados na "capacidade agrupada" da planilha (coluna N) */
  group?: string;
  /** observação vinda da planilha (ex.: operador compartilhado em células mescladas) */
  note?: string;
}

export interface SupportRole {
  id: string;
  area: "apoio" | "injecao";
  name: string;
  /** 1º, 2º, 3º turno e horário normal (administrativo) */
  people: [number, number, number, number];
}

export interface Scenario {
  workingDays: number;
  shifts: [ShiftSchedule, ShiftSchedule, ShiftSchedule];
  processes: Process[];
  support: SupportRole[];
}

// A base vem de capacityBaseline.ts (valores fictícios no repositório público).
// Nos builds privados, CAPACITY_DATA=real troca pelo arquivo local com a planilha real.
export { BASELINE } from "./capacityBaseline";
import { BASELINE } from "./capacityBaseline";

/* ---------- Cálculo ---------- */

export const usefulMinutes = (s: ShiftSchedule) => s.grossMinutes - s.meal - s.gymnastics - s.breakTime - s.changeover;

export function regimeMinutes(scenario: Scenario, regime: Regime) {
  const m = scenario.shifts.slice(0, regime).map(usefulMinutes);
  return m.reduce((a, b) => a + b, 0) / m.length;
}

export interface ProcessResult {
  technical: number; // capacidade técnica por turno
  perShift: number; // meta por turno (técnica × eficiência)
  daily: number; // × regime
  monthly: number; // × dias úteis
  headcount: number; // pessoas nos 3 turnos
}

export function computeProcess(scenario: Scenario, p: Process): ProcessResult {
  const technical = (p.rate ?? 0) * regimeMinutes(scenario, p.regime);
  const perShift = technical * p.efficiency;
  const daily = perShift * p.regime;
  return {
    technical,
    perShift,
    daily,
    monthly: daily * scenario.workingDays,
    headcount: p.people[0] + p.people[1] + p.people[2],
  };
}

export function computeTotals(scenario: Scenario) {
  const results = scenario.processes.map((p) => ({ p, r: computeProcess(scenario, p) }));
  const byArea = (area: Area) => results.filter((x) => x.p.area === area);
  const sum = (list: typeof results, f: (x: (typeof results)[number]) => number) => list.reduce((s, x) => s + f(x), 0);

  const daily = sum(results, (x) => x.r.daily);
  const technicalDaily = sum(results, (x) => x.r.technical * x.p.regime);
  const peopleByShift = [0, 1, 2, 3].map(
    (i) =>
      (i < 3 ? sum(results, (x) => x.p.people[i as ShiftIndex]) : 0) +
      scenario.support.reduce((s, r) => s + r.people[i], 0),
  );
  const production = [0, 1, 2].map((i) => sum(results, (x) => x.p.people[i as ShiftIndex]));
  const people = peopleByShift.reduce((a, b) => a + b, 0);

  return {
    results,
    daily,
    monthly: daily * scenario.workingDays,
    /** eficiência média ponderada pela capacidade técnica */
    efficiency: technicalDaily ? daily / technicalDaily : 0,
    montagemDaily: sum(byArea("montagem"), (x) => x.r.daily),
    embalagemDaily: sum(byArea("embalagem"), (x) => x.r.daily),
    people,
    peopleByShift,
    productionPeople: production,
    piecesPerPerson: people ? daily / people : 0,
  };
}

/* ---------- Total da embalagem como a planilha mostra ---------- */
// Calculado a partir da base, para valer tanto com os dados reais quanto com os fictícios.

const baseResults = () => BASELINE.processes.map((p) => ({ p, daily: computeProcess(BASELINE, p).daily }));
const packing = () => baseResults().filter((x) => x.p.area === "embalagem");

/** Total da embalagem como a planilha mostra: a soma para antes da última linha */
export const spreadsheetPackingTotal = () => packing().slice(0, -1).reduce((s, x) => s + x.daily, 0);
