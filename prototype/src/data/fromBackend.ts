import type { Holiday, Machine as ApiMachine, ProdRecord, Session } from "../../../src/lib/api";
import type { DataSource, MetaInfoRaw, TargetHistoryItem } from "../../../src/lib/repositories/types";
import { metaDoTurno } from "../../../src/lib/metas";
import {
  endOfMonth,
  installBackendData,
  fromIsoDate,
  isWeekendDate,
  toIsoDate,
  type BackendData,
  type BackendMachine,
  type Line,
  type MetaChange,
  type ProductionOrder,
  type ProductionRecordInfo,
  type Shift,
} from "./machines";

/*
 * Adaptador de leitura: o contrato da camada de dados (src/lib/repositories,
 * da sessão do banco) → o formato das telas (machines.ts).
 *
 * Regras do banco que valem aqui (notas de 27/09 e 01/10 em docs/database/notas):
 * - Produção = `goodQuantity`; o retrabalho é contado à parte (D11).
 * - Meta de um recorte = SOMA da meta efetiva dos turnos apontados que contam
 *   para meta (`meta` > 0; hora extra e dia anulado já vêm com 0). Nunca
 *   meta × turnos × dias (D08).
 * - A meta de um dia "normal", só para a linha de ritmo dos gráficos, sai de
 *   `metaDoTurno` (src/lib/metas.ts) com a lotação padrão.
 *
 * O que ainda não existe no banco fica vazio e as telas mostram "–": material
 * da OP, motivo de retrabalho, minutos por OP (lacunas 1, 2 e 4).
 */

export type ReadSource = Pick<DataSource, "production" | "machines" | "targets" | "calendar">;

export interface BackendInput {
  records: ProdRecord[];
  machines: ApiMachine[];
  metas: Record<number, number>;
  metasInfo: Record<number, MetaInfoRaw>;
  history: TargetHistoryItem[];
  holidays: Holiday[];
  now: Date;
}

/** Busca tudo o que as telas de leitura precisam. Erros sobem: a tela mostra e oferece tentar de novo. */
export async function loadBackendData(source: ReadSource, session: Session | null): Promise<BackendData> {
  const [production, machines, metas, history, calendar] = await Promise.all([
    source.production.getAll(session),
    source.machines.getMachines(session),
    source.targets.getMetas(session),
    // Histórico de metas é só para a lista de mudanças: sem ele, as telas seguem
    source.targets.getHistory(session).catch(() => [] as TargetHistoryItem[]),
    source.calendar.getHolidays(session),
  ]);
  return buildBackendData({
    records: (production.data ?? []) as ProdRecord[],
    machines: machines.allMachines ?? machines.machines ?? [],
    metas: metas.metas ?? {},
    metasInfo: metas.metasInfo ?? {},
    history,
    holidays: (calendar.holidays ?? []) as Holiday[],
    now: new Date(),
  });
}

/**
 * Busca de novo e reinstala os dados do banco, depois de uma gravação. As telas
 * que montarem em seguida já leem o conjunto novo; a tela que gravou recarrega o
 * próprio estado.
 */
export async function reloadBackendData(source: ReadSource, session: Session | null) {
  installBackendData(await loadBackendData(source, session));
}

/* ---------- Datas ---------- */

/** "2026-09-21" (banco) ou "21/09/2026" (planilha) → Date local; null se não reconhecer */
export function parseDay(value: string | undefined | null): Date | null {
  const s = String(value ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return fromIsoDate(`${m[1]}-${m[2]}-${m[3]}`);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/** "20/09/2026, 10:30:00" (formato que a camada entrega) ou ISO → Date; null se vazio ou inválido */
export function parseMoment(value: string | undefined | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), Number(br[4]), Number(br[5]), Number(br[6] ?? 0));
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

/** "TURNO 2" → 2; fora de 1–3 → null */
export function shiftOf(turno: string | undefined | null): Shift | null {
  const m = /(\d+)\s*$/.exec(String(turno ?? ""));
  const n = m ? Number(m[1]) : NaN;
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** Hora de fim de cada turno: registro sem horário vira "fim do turno" */
const SHIFT_END: Record<Shift, [number, number]> = { 1: [14, 18], 2: [23, 24], 3: [5, 0] };

/* ---------- Centros ---------- */

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Linha do centro: a do banco (`machines.process`, D37) quando vier. Sem ela
 * (centro cadastrado pelo app, ou fonte Apps Script), deduz pelo nome.
 * "Granel" não é linha: é agrupamento de tela, sempre pelo nome.
 */
export function lineOf(name: string, process?: ApiMachine["process"]): Line {
  const n = normalize(name);
  if (n.includes("granel")) return "Granel";
  if (process === "assembly") return "Montagem";
  if (process === "packaging") return "Embalagem";
  // As embaladoras de kit de parafusos ficam na montagem
  if ((n.includes("embaladora") || n.includes("embalagem")) && !n.includes("parafuso")) return "Embalagem";
  return "Montagem";
}

/** Meta de um turno normal, com a lotação padrão (mesma conta da view) */
function shiftTarget(m: ApiMachine, metas: BackendInput["metas"], info: BackendInput["metasInfo"]) {
  const cadastrada = metas[m.id] ?? m.defaultMeta ?? 0;
  if (!cadastrada) return 0;
  return metaDoTurno({ cadastrada, base: info[m.id]?.basis, pessoas: null, lotacaoPadrao: m.standardOperatorCount ?? null }).valor;
}

/* ---------- Conversão ---------- */

export function buildBackendData(input: BackendInput): BackendData {
  const byId = new Map<string, BackendMachine & { perShift: number }>();
  const ensure = (id: number, name: string) => {
    const key = String(id);
    let m = byId.get(key);
    if (!m) {
      const api = input.machines.find((x) => x.id === id);
      const perShift = api?.hasMeta ? shiftTarget(api, input.metas, input.metasInfo) : 0;
      m = {
        id: key,
        name: api?.name || name || `Centro ${id}`,
        line: lineOf(api?.name || name || "", api?.process),
        hasTarget: !!api?.hasMeta,
        regime: 2,
        dailyTarget: 0,
        perShift,
        orders: [],
        targets: [],
        ...(api?.status === "inativo" ? { inactive: true } : {}),
      };
      byId.set(key, m);
    }
    return m;
  };
  // Centros ativos aparecem mesmo sem apontamento; inativos, só se apontaram algo
  for (const m of input.machines) if (!m.status || m.status === "ativo") ensure(m.id, m.name);

  const recordDays = new Set<string>();
  let first: Date | null = null;
  let last: Date | null = null;

  for (const rec of input.records) {
    const date = parseDay(rec.date);
    const shift = shiftOf(rec.turno);
    if (!date || !shift) continue;
    const m = ensure(rec.machineId, rec.machineName);
    recordDays.add(toIsoDate(date));
    if (!first || date < first) first = date;
    if (!last || date > last) last = date;
    if (shift === 3 && rec.workMode !== "overtime") m.regime = 3;

    const [h, min] = SHIFT_END[shift];
    const recordedAt =
      parseMoment(rec.savedAt) ?? new Date(date.getFullYear(), date.getMonth(), date.getDate() + (shift === 3 ? 1 : 0), h, min);
    const operator = rec.savedBy || "Sem autor";
    const base = rec.id ?? `${rec.date}-${shift}-${rec.machineId}`;
    const orders: ProductionOrder[] = [];
    const record: ProductionRecordInfo | undefined = rec.id
      ? {
          id: rec.id,
          overtime: rec.workMode === "overtime",
          operatorCount: rec.operatorCount && rec.operatorCount > 0 ? rec.operatorCount : null,
          notes: String(rec.obs ?? "").trim(),
          orders: (rec.ordensProducao ?? []).map((o) => ({
            op: String(o.ordemId ?? "").trim(),
            quantity: Math.round(Number(o.quantidade) || 0),
            rework: o.retrabalho === true,
            note: String(o.obs ?? "").trim(),
          })),
        }
      : undefined;
    const push = (opId: string, quantity: number, rework: boolean, note: string | undefined) =>
      orders.push({
        id: `${base}-${orders.length}`,
        opId,
        machineId: m.id,
        date,
        shift,
        material: "",
        product: "",
        quantity,
        minutes: 0,
        rework,
        reworkReason: null,
        operator,
        recordedAt,
        note: note ? { id: `n-${base}-${orders.length}`, text: note, author: operator } : null,
        record,
      });

    for (const o of rec.ordensProducao ?? []) {
      const qty = Math.round(Number(o.quantidade) || 0);
      if (qty > 0) push(String(o.ordemId ?? "").trim(), qty, o.retrabalho === true, o.obs);
    }
    // O total do apontamento manda: o que as ordens não explicam entra sem OP
    const good = Math.round(rec.goodQuantity ?? rec.producao ?? 0);
    const rework = Math.round(rec.reworkQuantity ?? 0);
    const goodInOrders = orders.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0);
    const reworkInOrders = orders.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0);
    if (good > goodInOrders) push("", good - goodInOrders, false, undefined);
    if (rework > reworkInOrders) push("", rework - reworkInOrders, true, undefined);
    // Apontamento sem peça (máquina parada, por exemplo) continua visível no histórico
    if (!orders.length) push("", 0, false, undefined);
    // A observação do apontamento vai na primeira linha que ainda não tem
    const obs = String(rec.obs ?? "").trim();
    if (obs) {
      const target = orders.find((o) => !o.note) ?? orders[0];
      target.note = target.note
        ? { ...target.note, text: `${target.note.text} · ${obs}` }
        : { id: `n-${base}`, text: obs, author: operator };
    }
    m.orders.push(...orders);

    if (rec.meta > 0) m.targets.push({ date, shift, target: rec.meta });
  }

  const today = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate());
  const dataStart = first ?? today;
  const dataEnd = last ?? today;

  // Dias úteis: seg–sex da janela, menos feriado e dia anulado de dia inteiro, mais os dias que tiveram produção
  const closed = new Set(
    input.holidays
      .filter((h) => !h.shiftIds?.length)
      .map((h) => parseDay(h.date))
      .filter((d): d is Date => !!d)
      .map(toIsoDate),
  );
  const workingDates: Date[] = [];
  const windowEnd = endOfMonth(dataEnd);
  for (
    let d = new Date(dataStart.getFullYear(), dataStart.getMonth(), 1);
    d <= windowEnd;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    const iso = toIsoDate(d);
    if (recordDays.has(iso) || (!isWeekendDate(d) && !closed.has(iso))) workingDates.push(d);
  }

  const names = new Map(input.machines.map((m) => [m.id, m.name]));
  const metaChanges: MetaChange[] = input.history
    .map((h, i) => {
      const from = parseDay(h.validFrom);
      return {
        id: `t${h.machineId}-${h.validFrom}-${i}`,
        date: parseMoment(h.createdAt) ?? from ?? today,
        author: h.createdBy || "Sem autor",
        summary: `${names.get(h.machineId) ?? `Centro ${h.machineId}`}: meta por turno ${h.quantity.toLocaleString("pt-BR")}${
          from ? ` a partir de ${from.toLocaleDateString("pt-BR")}` : ""
        }`,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const machines: BackendMachine[] = [...byId.values()]
    .map(({ perShift, ...m }) => ({ ...m, dailyTarget: m.hasTarget ? perShift * m.regime : 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { machines, workingDates, dataStart, dataEnd, now: input.now, metaChanges };
}
