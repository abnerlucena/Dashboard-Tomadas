import {
  DATA_END,
  DATA_ORIGIN,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  dayKey,
  plantSeries,
  statusFor,
  targetOn,
  workingDatesIn,
  type DateRange,
  type Machine,
  type ProductionOrder,
  type Shift,
  type Status,
} from "@/data/machines";
import { Report, loadExcel, type Column, type Kpi } from "@/lib/xlsx/report";
import { CHART } from "@/lib/xlsx/theme";

/*
 * O que o "Exportar" do Dashboard entrega, no padrão de planilhas do Dash
 * (src/lib/xlsx). Os números são os da tela: mesmo recorte de período, turno,
 * máquina e situação, e as mesmas contas (produção = só a boa, D11; meta = soma
 * da meta efetiva dos turnos apontados, D08).
 */

export interface DashboardExport {
  rows: Machine[];
  /** máquinas por demanda no mesmo recorte (sem meta, fora do atingimento) */
  demand: Machine[];
  range: DateRange;
  shift: Shift | "all";
  period: string;
  filters: Array<[string, string]>;
  author?: string;
  /** "12,4% acima de agosto até o dia 21" */
  comparison?: string;
}

const dm = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const rework = (orders: ProductionOrder[]) => orders.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0);
const ops = (orders: ProductionOrder[]) => new Set(orders.filter((o) => o.quantity > 0 && o.opId).map((o) => o.opId)).size;
const opNumber = (o: ProductionOrder) => o.opId.replace("OP ", "");
const source = () => (DATA_ORIGIN === "backend" ? "Dados do banco" : "Demonstração (dados fictícios)");
const fraction = (num: number, den: number) => (den > 0 ? num / den : null);
const statusOf = (produced: number, target: number): Status | null =>
  target > 0 ? statusFor(Math.round((produced / target) * 100)) : null;

/** Dias úteis do recorte que já passaram (as colunas dos mapas diários) */
const elapsedDates = (range: DateRange) => workingDatesIn(range).filter((d) => d <= DATA_END);

/** Produção boa de uma máquina num dia e turno */
function perDayShift(m: Machine) {
  const map = new Map<string, number>();
  for (const o of m.orders) {
    if (o.rework) continue;
    const k = `${dayKey(o.date)}-${o.shift}`;
    map.set(k, (map.get(k) ?? 0) + o.quantity);
  }
  return (d: Date, s?: Shift) =>
    s ? (map.get(`${dayKey(d)}-${s}`) ?? 0) : SHIFTS.reduce((t, sh) => t + (map.get(`${dayKey(d)}-${sh}`) ?? 0), 0);
}

const shiftList = (shift: Shift | "all"): Shift[] => (shift === "all" ? SHIFTS : [shift]);

const ORDER_COLUMNS: Column<ProductionOrder & { machineName: string; line: string }>[] = [
  { header: "Data", value: (o) => o.date, format: "date" },
  { header: "Turno", value: (o) => SHIFT_META[o.shift].label },
  { header: "Máquina", value: (o) => o.machineName, width: 34 },
  { header: "Linha", value: (o) => o.line },
  { header: "OP", value: (o) => opNumber(o) || "—" },
  { header: "Quantidade", value: (o) => o.quantity, format: "int", total: "sum", dataBar: true },
  { header: "Retrabalho", value: (o) => (o.rework ? "Sim" : "Não") },
  { header: "Registrado por", value: (o) => o.operator, width: 22 },
  { header: "Registrado em", value: (o) => o.recordedAt, format: "dateTime" },
  { header: "Observação", value: (o) => o.note?.text ?? "", width: 48, wrap: true },
];

const withMachine = (m: Machine) => m.orders.map((o) => ({ ...o, machineName: m.name, line: m.line }));
const byDate = (a: ProductionOrder, b: ProductionOrder) => a.date.getTime() - b.date.getTime() || a.shift - b.shift;

/* ---------- Dashboard inteiro ---------- */

export async function buildDashboardReport(x: DashboardExport): Promise<Blob> {
  const report = new Report(await loadExcel(), {
    title: "Dashboard de produção",
    period: x.period,
    filters: x.filters,
    author: x.author,
    source: source(),
  });
  const days = elapsedDates(x.range);
  const shifts = shiftList(x.shift);
  const produced = x.rows.reduce((s, m) => s + m.produced, 0);
  const target = x.rows.reduce((s, m) => s + m.target, 0);
  const rw = x.rows.reduce((s, m) => s + rework(m.orders), 0);
  const allOrders = x.rows.flatMap(withMachine);
  const active = x.rows.filter((m) => m.produced > 0).length;
  const att = fraction(produced, target);
  const st = statusOf(produced, target);
  const fns = new Map(x.rows.map((m) => [m.id, perDayShift(m)]));

  const kpis: Kpi[] = [
    { label: "Produção", value: produced, format: "int", note: x.comparison ?? "peças boas, sem o retrabalho" },
    { label: "Meta do período", value: Math.round(target), format: "int", note: "soma das metas dos turnos apontados" },
    { label: "Atingimento", value: att ?? "—", format: "percent", status: st, note: st ? STATUS_META[st].label : "sem meta no recorte" },
    {
      label: "Diferença para a meta",
      value: Math.round(produced - target),
      format: "int",
      status: st,
      note: produced >= target ? "acima da meta" : "abaixo da meta",
    },
    {
      label: "Retrabalho",
      value: rw,
      format: "int",
      note: produced + rw ? `${((rw / (produced + rw)) * 100).toFixed(1).replace(".", ",")}% do total apontado` : "",
    },
    {
      label: "Média por dia útil",
      value: days.length ? Math.round(produced / days.length) : 0,
      format: "int",
      note: `${days.length} dias úteis no recorte`,
    },
    {
      label: "Máquinas com produção",
      value: `${active} de ${x.rows.length}`,
      note: x.demand.length ? `+ ${x.demand.length} por demanda (aba própria)` : "",
    },
    {
      label: "OPs apontadas",
      value: ops(x.rows.flatMap((m) => m.orders)),
      format: "int",
      note: `${allOrders.length} linhas de apontamento`,
    },
  ];
  report.addSummary(kpis, [["Máquinas no recorte", String(x.rows.length)]]);

  // Gráficos
  // Meta acumulada = soma das metas dos turnos apontados até o dia (a mesma conta do cartão, D08)
  const plant = plantSeries(x.rows, x.range).filter((p) => p.date <= DATA_END);
  let acc = 0;
  const targetCumulative = plant.map((p) => (acc += targetOn(x.rows, p.date)));
  report.addChart(
    "Produção acumulada × meta acumulada",
    (await import("@/lib/xlsx/charts")).cumulativeChart(
      plant.map((p) => dm.format(p.date)),
      plant.map((p) => p.cumulative),
      targetCumulative,
    ),
    { wide: true },
  );
  const charts = await import("@/lib/xlsx/charts");
  report.addChart(
    "Atingimento por máquina",
    charts.attainmentChart(
      x.rows
        .filter((m) => m.target > 0)
        .map((m) => ({ name: m.name, percent: Math.round((m.produced / m.target) * 100), status: m.status })),
    ),
  );
  const shiftTotals = shifts.map((s) => x.rows.reduce((t, m) => t + (m.byShift[s] ?? 0), 0));
  report.addChart(
    "Participação dos turnos",
    charts.shareChart(shifts.map((s, i) => ({ name: SHIFT_META[s].label, value: shiftTotals[i], color: CHART.shifts[s - 1] }))),
  );
  const byProd = [...x.rows].sort((a, b) => b.produced - a.produced);
  report.addChart(
    "Produção por turno em cada máquina",
    charts.shiftsChart(
      byProd.map((m) => m.name),
      [1, 2, 3].map((s) => byProd.map((m) => (shifts.includes(s as Shift) ? (m.byShift[s as Shift] ?? 0) : 0))) as [
        number[],
        number[],
        number[],
      ],
    ),
    { wide: true },
  );
  report.addNotes([
    "Produção conta só as peças boas; o retrabalho aparece à parte.",
    "Meta do período é a soma das metas dos turnos que apontaram: hora extra e dia anulado ficam fora.",
    `Situação: Crítico ${STATUS_META.critical.range}, Atenção ${STATUS_META.attention.range}, Próximo ${STATUS_META.near.range}, Atingido ${STATUS_META.achieved.range}.`,
    "As abas de tabela têm filtro no cabeçalho; a linha de total soma só o que estiver visível.",
    "Máquinas por demanda produzem sem meta e não entram no atingimento: estão na aba própria.",
  ]);

  // Máquinas
  report.addTable<Machine>("Máquinas", {
    title: "Máquinas",
    description: "Uma linha por máquina com meta, no recorte da tela. Atingimento = produção ÷ meta do período.",
    rows: [...x.rows].sort((a, b) => b.produced - a.produced),
    totals: true,
    columns: [
      { header: "Máquina", value: (m) => m.name, width: 36 },
      { header: "Linha", value: (m) => m.line },
      { header: "Turnos (regime)", value: (m) => m.regime, format: "int" },
      { header: "Dias com apontamento", value: (m) => m.days, format: "int", total: "avg" },
      { header: "Produção", value: (m) => m.produced, format: "int", total: "sum", dataBar: true },
      { header: "Meta", value: (m) => Math.round(m.target), format: "int", total: "sum" },
      {
        header: "Atingimento",
        value: (m) => fraction(m.produced, m.target),
        format: "percent",
        attainment: true,
        total: (ref, f, l) =>
          `IFERROR(SUBTOTAL(109,${ref("Produção")}${f}:${ref("Produção")}${l})/SUBTOTAL(109,${ref("Meta")}${f}:${ref("Meta")}${l}),"")`,
      },
      {
        header: "Situação",
        value: (m) => (m.target > 0 ? STATUS_META[m.status].label : "Sem meta"),
        status: (m) => (m.target > 0 ? m.status : null),
      },
      { header: "Diferença p/ meta", value: (m) => Math.round(m.produced - m.target), format: "int", total: "sum" },
      { header: "Média por dia", value: (m) => (m.days ? Math.round(m.produced / m.days) : 0), format: "int", total: "avg" },
      ...SHIFTS.map((s) => ({
        header: SHIFT_META[s].label,
        value: (m: Machine) => (shifts.includes(s) ? (m.byShift[s] ?? 0) : null),
        format: "int" as const,
        total: "sum" as const,
      })),
      { header: "Retrabalho", value: (m) => rework(m.orders), format: "int", total: "sum" },
      { header: "% retrabalho", value: (m) => fraction(rework(m.orders), m.produced + rework(m.orders)), format: "percent1" },
      { header: "OPs", value: (m) => ops(m.orders), format: "int", total: "sum" },
      { header: "Último apontamento", value: (m) => m.lastEntry?.date ?? null, format: "date" },
      { header: "Último turno", value: (m) => (m.lastEntry ? SHIFT_META[m.lastEntry.shift].label : "") },
    ],
  });

  if (x.demand.length)
    report.addTable<Machine>("Por demanda", {
      title: "Máquinas por demanda",
      description: "Centros sem meta: produzem conforme a necessidade e ficam fora do atingimento.",
      rows: [...x.demand].sort((a, b) => b.produced - a.produced),
      totals: true,
      tab: "FF8A94A3",
      columns: [
        { header: "Máquina", value: (m) => m.name, width: 36 },
        { header: "Linha", value: (m) => m.line },
        { header: "Dias com apontamento", value: (m) => m.days, format: "int" },
        { header: "Produção", value: (m) => m.produced, format: "int", total: "sum", dataBar: true },
        ...SHIFTS.map((s) => ({
          header: SHIFT_META[s].label,
          value: (m: Machine) => (shifts.includes(s) ? (m.byShift[s] ?? 0) : null),
          format: "int" as const,
          total: "sum" as const,
        })),
        { header: "Retrabalho", value: (m) => rework(m.orders), format: "int", total: "sum" },
        { header: "OPs", value: (m) => ops(m.orders), format: "int", total: "sum" },
        { header: "Último apontamento", value: (m) => m.lastEntry?.date ?? null, format: "date" },
      ],
    });

  // Mapas diários
  const ordered = [...x.rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  report.addMatrix("Diário", {
    title: "Produção diária",
    description: "Peças boas por máquina em cada dia útil do recorte. Quanto mais azul, mais produção.",
    corner: "Máquina",
    columns: days.map((d) => dm.format(d)),
    rows: ordered.map((m) => ({ label: m.name, values: days.map((d) => fns.get(m.id)!(d) || null) })),
    format: "int",
    color: "scale",
    totals: true,
  });
  report.addMatrix("Atingimento diário", {
    title: "Atingimento diário",
    description:
      "Produção do dia ÷ meta do dia, por máquina. Vermelho abaixo de 70%, amarelo perto de 85%, verde acima de 100%. Vazio = sem meta ou sem apontamento.",
    corner: "Máquina",
    columns: days.map((d) => dm.format(d)),
    rows: ordered.map((m) => ({
      label: m.name,
      values: days.map((d) => {
        const t = targetOn([m], d);
        const p = fns.get(m.id)!(d);
        return t > 0 && p > 0 ? p / t : null;
      }),
    })),
    format: "percent",
    color: "attainment",
    totals: true,
  });

  // Turnos
  report.addTable<Machine>("Turnos", {
    title: "Turnos",
    description: "Produção, meta e atingimento de cada turno, por máquina.",
    rows: ordered,
    totals: true,
    columns: [
      { header: "Máquina", value: (m) => m.name, width: 36 },
      ...shifts.flatMap((s) => [
        {
          header: `${SHIFT_META[s].label} · produção`,
          value: (m: Machine) => m.byShift[s] ?? 0,
          format: "int" as const,
          total: "sum" as const,
        },
        {
          header: `${SHIFT_META[s].label} · meta`,
          value: (m: Machine) => Math.round(m.targetByShift[s] ?? 0),
          format: "int" as const,
          total: "sum" as const,
        },
        {
          header: `${SHIFT_META[s].label} · atingimento`,
          value: (m: Machine) => fraction(m.byShift[s] ?? 0, m.targetByShift[s] ?? 0),
          format: "percent" as const,
          attainment: true,
        },
      ]),
    ],
  });

  // Apontamentos
  report.addTable("Apontamentos", {
    title: "Apontamentos",
    description: "Cada OP apontada no recorte, da mais antiga para a mais nova.",
    rows: allOrders.sort((a, b) => byDate(a, b) || a.machineName.localeCompare(b.machineName, "pt-BR")),
    totals: true,
    freezeColumns: 2,
    columns: ORDER_COLUMNS,
  });

  return report.toBlob();
}

/* ---------- Uma máquina (painel) ---------- */

export async function buildMachineReport(
  m: Machine,
  x: Pick<DashboardExport, "range" | "shift" | "period" | "filters" | "author">,
): Promise<Blob> {
  const report = new Report(await loadExcel(), { title: m.name, period: x.period, filters: x.filters, author: x.author, source: source() });
  const days = elapsedDates(x.range);
  const shifts = shiftList(x.shift);
  const fn = perDayShift(m);
  const rw = rework(m.orders);
  const st = m.target > 0 ? m.status : null;
  report.addSummary(
    [
      { label: "Produção", value: m.produced, format: "int", note: "peças boas" },
      { label: "Meta do período", value: Math.round(m.target), format: "int" },
      {
        label: "Atingimento",
        value: fraction(m.produced, m.target) ?? "—",
        format: "percent",
        status: st,
        note: st ? STATUS_META[st].label : "sem meta",
      },
      { label: "Dias com apontamento", value: m.days, format: "int", note: `de ${days.length} dias úteis` },
      { label: "Média por dia", value: m.days ? Math.round(m.produced / m.days) : 0, format: "int" },
      { label: "Retrabalho", value: rw, format: "int" },
      { label: "OPs apontadas", value: ops(m.orders), format: "int" },
      { label: "Último apontamento", value: m.lastEntry ? `${dm.format(m.lastEntry.date)} · ${SHIFT_META[m.lastEntry.shift].label}` : "—" },
    ],
    [
      ["Linha", m.line],
      ["Turnos (regime)", String(m.regime)],
    ],
  );
  const charts = await import("@/lib/xlsx/charts");
  report.addChart(
    "Produção diária × meta do dia",
    charts.dailyChart(
      days.map((d) => dm.format(d)),
      days.map((d) => fn(d) || null),
      days.map((d) => targetOn([m], d) || null),
    ),
    { wide: true },
  );
  report.addChart(
    "Participação dos turnos",
    charts.shareChart(shifts.map((s) => ({ name: SHIFT_META[s].label, value: m.byShift[s] ?? 0, color: CHART.shifts[s - 1] }))),
  );
  report.addNotes(["Produção conta só as peças boas.", "Meta do dia = soma das metas dos turnos apontados naquele dia."]);

  type Day = { date: Date; total: number; target: number; byShift: Record<Shift, number> };
  const rows: Day[] = days.map((d) => ({
    date: d,
    total: fn(d),
    target: targetOn([m], d),
    byShift: { 1: fn(d, 1), 2: fn(d, 2), 3: fn(d, 3) },
  }));
  report.addTable<Day>("Diário", {
    title: "Diário",
    description: `Produção de ${m.name} em cada dia útil do recorte, por turno.`,
    rows,
    totals: true,
    columns: [
      { header: "Data", value: (d) => d.date, format: "date" },
      { header: "Dia", value: (d) => d.date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") },
      ...shifts.map((s) => ({
        header: SHIFT_META[s].label,
        value: (d: Day) => d.byShift[s] || null,
        format: "int" as const,
        total: "sum" as const,
      })),
      { header: "Produção do dia", value: (d) => d.total, format: "int", total: "sum", dataBar: true },
      { header: "Meta do dia", value: (d) => d.target || null, format: "int", total: "sum" },
      {
        header: "Atingimento",
        value: (d) => fraction(d.total, d.target),
        format: "percent",
        attainment: true,
        total: (ref, f, l) =>
          `IFERROR(SUBTOTAL(109,${ref("Produção do dia")}${f}:${ref("Produção do dia")}${l})/SUBTOTAL(109,${ref("Meta do dia")}${f}:${ref("Meta do dia")}${l}),"")`,
      },
      {
        header: "Situação",
        value: (d) =>
          d.target ? STATUS_META[statusFor(Math.round((d.total / d.target) * 100))].label : d.total ? "Sem meta" : "Sem apontamento",
        status: (d) => (d.target && d.total ? statusFor(Math.round((d.total / d.target) * 100)) : null),
      },
    ],
  });
  report.addTable("Apontamentos", {
    title: "Apontamentos",
    description: `Cada OP apontada em ${m.name} no recorte.`,
    rows: withMachine(m).sort(byDate),
    totals: true,
    columns: ORDER_COLUMNS,
  });
  return report.toBlob();
}
