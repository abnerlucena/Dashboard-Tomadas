import {
  DATA_END,
  DATA_ORIGIN,
  SHIFT_META,
  STATUS_META,
  dayKey,
  statusFor,
  workingDatesIn,
  type DateRange,
  type Machine,
  type ProductionOrder,
  type Shift,
  type Status,
} from "@/data/machines";
import { Report, loadExcel, type Column } from "@/lib/xlsx/report";
import { CHART } from "@/lib/xlsx/theme";
import { scopedTarget, type ReportType } from "./reportPdf";

/*
 * Planilha dos Relatórios, no padrão de planilhas do Dash (src/lib/xlsx).
 * Os Relatórios escolhem vários turnos ao mesmo tempo, então tudo é calculado
 * a partir dos apontamentos do recorte (as mesmas contas do PDF: produção = só
 * a boa, meta = scopedTarget).
 */

export interface ReportXlsxInput {
  type: ReportType;
  title: string;
  period: string;
  scope: string;
  orders: ProductionOrder[];
  machines: Machine[];
  shifts: Shift[];
  range: DateRange;
  author?: string;
}

const dm = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fraction = (num: number, den: number) => (den > 0 ? num / den : null);
const statusOf = (p: number, t: number): Status | null => (t > 0 ? statusFor(Math.round((p / t) * 100)) : null);

interface Row {
  m: Machine;
  produced: number;
  rework: number;
  target: number;
  byShift: Record<Shift, number>;
  ops: number;
  days: number;
  last: ProductionOrder | null;
  reasons: Map<string, number>;
}

export async function buildReportXlsx(x: ReportXlsxInput): Promise<Blob> {
  const report = new Report(await loadExcel(), {
    title: x.title,
    period: x.period,
    filters: [["Recorte", x.scope]],
    author: x.author,
    source: DATA_ORIGIN === "backend" ? "Dados do banco" : "Demonstração (dados fictícios)",
  });
  const days = workingDatesIn(x.range).filter((d) => d <= DATA_END);

  // Uma linha por máquina, a partir dos apontamentos do recorte
  const rows: Row[] = x.machines.map((m) => {
    const own = x.orders.filter((o) => o.machineId === m.id);
    const reasons = new Map<string, number>();
    for (const o of own)
      if (o.rework) reasons.set(o.reworkReason ?? "Não informado", (reasons.get(o.reworkReason ?? "Não informado") ?? 0) + o.quantity);
    const byShift = { 1: 0, 2: 0, 3: 0 } as Record<Shift, number>;
    for (const o of own) if (!o.rework) byShift[o.shift] += o.quantity;
    const last = [...own].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0] ?? null;
    return {
      m,
      produced: own.reduce((s, o) => s + (o.rework ? 0 : o.quantity), 0),
      rework: own.reduce((s, o) => s + (o.rework ? o.quantity : 0), 0),
      target: scopedTarget(m, x.shifts, x.range),
      byShift,
      ops: new Set(own.filter((o) => o.opId).map((o) => o.opId)).size,
      days: new Set(own.map((o) => dayKey(o.date))).size,
      last,
      reasons,
    };
  });
  const withTarget = rows.filter((r) => r.target > 0);
  const produced = rows.reduce((s, r) => s + r.produced, 0);
  const producedT = withTarget.reduce((s, r) => s + r.produced, 0);
  const target = withTarget.reduce((s, r) => s + r.target, 0);
  const rework = rows.reduce((s, r) => s + r.rework, 0);
  const st = statusOf(producedT, target);

  report.addSummary([
    { label: "Produção", value: produced, format: "int", note: "peças boas, sem o retrabalho" },
    { label: "Meta do recorte", value: target, format: "int", note: "só máquinas com meta, nos turnos escolhidos" },
    {
      label: "Atingimento",
      value: fraction(producedT, target) ?? "—",
      format: "percent",
      status: st,
      note: st ? STATUS_META[st].label : "sem meta",
    },
    {
      label: "Retrabalho",
      value: rework,
      format: "int",
      note: produced + rework ? `${((rework / (produced + rework)) * 100).toFixed(1).replace(".", ",")}% do total` : "",
    },
    { label: "Máquinas", value: x.machines.length, format: "int", note: `${rows.filter((r) => r.produced > 0).length} com produção` },
    { label: "Dias úteis", value: days.length, format: "int" },
    { label: "OPs", value: new Set(x.orders.filter((o) => o.opId).map((o) => o.opId)).size, format: "int" },
    { label: "Apontamentos", value: x.orders.length, format: "int", note: "linhas na aba Apontamentos" },
  ]);

  const charts = await import("@/lib/xlsx/charts");
  const daily = days.map((d) => x.orders.reduce((s, o) => s + (!o.rework && dayKey(o.date) === dayKey(d) ? o.quantity : 0), 0));
  report.addChart(
    "Produção diária",
    charts.dailyChart(
      days.map((d) => dm.format(d)),
      daily.map((v) => v || null),
      days.map(() => null),
    ),
    { wide: true },
  );
  if (withTarget.length)
    report.addChart(
      "Atingimento por máquina",
      charts.attainmentChart(
        withTarget.map((r) => ({
          name: r.m.name,
          percent: Math.round((r.produced / r.target) * 100),
          status: statusOf(r.produced, r.target)!,
        })),
      ),
    );
  report.addChart(
    x.type === "rework" ? "Retrabalho por turno" : "Participação dos turnos",
    charts.shareChart(
      x.shifts.map((s) => ({
        name: SHIFT_META[s].label,
        value: x.orders.reduce((t, o) => t + (o.shift === s && (x.type === "rework" ? o.rework : !o.rework) ? o.quantity : 0), 0),
        color: CHART.shifts[s - 1],
      })),
    ),
  );
  report.addNotes([
    "Produção conta só as peças boas; o retrabalho aparece à parte.",
    "Meta do recorte = metas das máquinas com meta, nos turnos escolhidos, no período.",
    `Situação: Crítico ${STATUS_META.critical.range}, Atenção ${STATUS_META.attention.range}, Próximo ${STATUS_META.near.range}, Atingido ${STATUS_META.achieved.range}.`,
  ]);

  const sorted = [...rows].sort((a, b) => b.produced - a.produced);
  const shiftCols: Column<Row>[] = x.shifts.map((s) => ({
    header: SHIFT_META[s].label,
    value: (r) => r.byShift[s],
    format: "int",
    total: "sum",
  }));
  report.addTable<Row>("Máquinas", {
    title: "Máquinas",
    description: "Uma linha por máquina escolhida. Atingimento = produção ÷ meta do recorte.",
    rows: sorted,
    totals: true,
    columns: [
      { header: "Máquina", value: (r) => r.m.name, width: 36 },
      { header: "Linha", value: (r) => r.m.line },
      { header: "Dias com apontamento", value: (r) => r.days, format: "int", total: "avg" },
      { header: "Produção", value: (r) => r.produced, format: "int", total: "sum", dataBar: true },
      { header: "Meta", value: (r) => (r.target ? r.target : null), format: "int", total: "sum" },
      {
        header: "Atingimento",
        value: (r) => fraction(r.produced, r.target),
        format: "percent",
        attainment: true,
        // Só a produção das linhas com meta (por demanda fica fora, D38), e só das visíveis no filtro
        total: (ref, f, l) => {
          const P = ref("Produção");
          const M = ref("Meta");
          return `IFERROR(SUMPRODUCT(SUBTOTAL(109,OFFSET(${P}${f},ROW(${P}${f}:${P}${l})-ROW(${P}${f}),0)),--(${M}${f}:${M}${l}>0))/SUBTOTAL(109,${M}${f}:${M}${l}),"")`;
        },
      },
      {
        header: "Situação",
        value: (r) => (r.target ? STATUS_META[statusOf(r.produced, r.target)!].label : "Por demanda"),
        status: (r) => statusOf(r.produced, r.target),
      },
      ...shiftCols,
      { header: "Retrabalho", value: (r) => r.rework, format: "int", total: "sum" },
      { header: "% retrabalho", value: (r) => fraction(r.rework, r.produced + r.rework), format: "percent1" },
      { header: "OPs", value: (r) => r.ops, format: "int", total: "sum" },
      { header: "Último apontamento", value: (r) => r.last?.date ?? null, format: "date" },
    ],
  });

  if (x.type === "rework") {
    type Reason = { machine: string; reason: string; qty: number; share: number | null };
    const reasons: Reason[] = rows.flatMap((r) =>
      [...r.reasons].map(([reason, qty]) => ({ machine: r.m.name, reason, qty, share: fraction(qty, r.rework) })),
    );
    report.addTable<Reason>("Retrabalho", {
      title: "Retrabalho por motivo",
      description: "Quanto cada motivo pesou no retrabalho de cada máquina.",
      rows: reasons.sort((a, b) => b.qty - a.qty),
      totals: true,
      tab: "FFC32222",
      columns: [
        { header: "Máquina", value: (r) => r.machine, width: 36 },
        { header: "Motivo", value: (r) => r.reason, width: 32 },
        { header: "Quantidade", value: (r) => r.qty, format: "int", total: "sum", dataBar: true },
        { header: "Parte do retrabalho da máquina", value: (r) => r.share, format: "percent1" },
      ],
    });
  }

  report.addMatrix("Diário", {
    title: "Produção diária",
    description: "Peças boas por máquina em cada dia útil do recorte, nos turnos escolhidos.",
    corner: "Máquina",
    columns: days.map((d) => dm.format(d)),
    rows: [...rows]
      .sort((a, b) => a.m.name.localeCompare(b.m.name, "pt-BR"))
      .map((r) => ({
        label: r.m.name,
        values: days.map(
          (d) =>
            x.orders.reduce((s, o) => s + (o.machineId === r.m.id && !o.rework && dayKey(o.date) === dayKey(d) ? o.quantity : 0), 0) ||
            null,
        ),
      })),
    format: "int",
    color: "scale",
    totals: true,
  });

  const names = new Map(x.machines.map((m) => [m.id, m]));
  report.addTable("Apontamentos", {
    title: "Apontamentos",
    description: "Cada OP apontada no recorte, da mais antiga para a mais nova.",
    rows: [...x.orders].sort((a, b) => a.date.getTime() - b.date.getTime() || a.shift - b.shift),
    totals: true,
    freezeColumns: 2,
    columns: [
      { header: "Data", value: (o) => o.date, format: "date" },
      { header: "Turno", value: (o) => SHIFT_META[o.shift].label },
      { header: "Máquina", value: (o) => names.get(o.machineId)?.name ?? "", width: 34 },
      { header: "OP", value: (o) => o.opId.replace("OP ", "") || "—" },
      { header: "Material", value: (o) => o.material },
      { header: "Descrição do material", value: (o) => o.product, width: 28 },
      { header: "Quantidade", value: (o) => o.quantity, format: "int", total: "sum", dataBar: true },
      { header: "Retrabalho", value: (o) => (o.rework ? "Sim" : "Não") },
      { header: "Motivo", value: (o) => o.reworkReason ?? "" },
      { header: "Registrado por", value: (o) => o.operator, width: 22 },
      { header: "Registrado em", value: (o) => o.recordedAt, format: "dateTime" },
      { header: "Observação", value: (o) => o.note?.text ?? "", width: 48, wrap: true },
    ],
  });
  return report.toBlob();
}
