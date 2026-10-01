import { useMemo, type ReactNode } from "react";
import {
  DATA_END,
  DATA_ORIGIN,
  SHIFTS,
  STATUS_META,
  plantSeries,
  workingDatesIn,
  type DateRange,
  type Machine,
  type Shift,
} from "@/data/machines";
import { formatDecimal, formatLongDate, formatNumber, formatShortDate, plural } from "@/lib/utils";
import { ChartCard, MiniTable, type LegendItem } from "@/components/data/Chart";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { AttainmentBars, BurnupChart, ComboChart, DailyColumns, HBars, type ComboSeries } from "@/components/echarts";
import { BURNUP_LEGEND, DAILY_LEGEND } from "@/components/echarts/legends";
import { useOps } from "@/features/ops/OpsStore";
import { REWORK_LIMIT, SHIFT_NAMES, insights } from "./insights";

interface ChartsViewProps {
  rows: Machine[];
  /** Período escolhido no filtro (qualquer intervalo de dias) */
  range: DateRange;
  /** Período por extenso, para os subtítulos */
  periodText: string;
  shift: Shift | "all";
  isLoading: boolean;
  isRefetching: boolean;
  activeId: string | null;
  onSelect: (m: Machine) => void;
  /** Estado vazio/erro substitui os gráficos inteiros */
  replacement?: ReactNode;
  scopeLabel: string;
}

const pct = (v: number) => `${formatDecimal(v)}%`;
const days = (v: number) => `${formatDecimal(v)} ${v === 1 ? "dia" : "dias"}`;

const OPS_LEGEND: LegendItem[] = [
  { label: "OPs concluídas", shape: "rect", colorClass: "bg-chart-brand" },
  {
    label: "Tempo médio (dias)",
    shape: "line",
    colorClass: "bg-chart-categorical-2",
  },
];
const REWORK_LEGEND: LegendItem[] = [
  { label: "Peças em retrabalho", shape: "rect", colorClass: "bg-danger-bold" },
  {
    label: "Taxa de retrabalho",
    shape: "line",
    colorClass: "bg-chart-neutral",
  },
  {
    label: `Limite de ${REWORK_LIMIT}%`,
    shape: "dashed",
    colorClass: "border-chart-target",
  },
];
const PARETO_LEGEND: LegendItem[] = [
  { label: "Ocorrências", shape: "rect", colorClass: "bg-danger-bold" },
  { label: "% acumulado", shape: "line", colorClass: "bg-chart-neutral" },
];

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex basis-full flex-col gap-200">
      <header>
        <h2 className="font-heading-small text-default">{title}</h2>
        <p className="mt-025 font-body-small text-subtlest">{hint}</p>
      </header>
      {/* flex-wrap pela largura real (painel aberto, nav redimensionada), não pela viewport */}
      <div className="flex flex-wrap gap-300">{children}</div>
    </section>
  );
}

/**
 * Gráficos do período. Os filtros acima (período, máquina, turno, status)
 * valem para tudo aqui. Além da produção contra a meta, mostra o que se
 * movimenta no sistema: turnos, ritmo (peças/min), OPs e retrabalho.
 * Numa troca de período os gráficos mantêm o quadro anterior esmaecido
 * (sem skeleton); o skeleton aparece só no carregamento inicial.
 */
export function ChartsView({
  rows,
  range,
  periodText,
  shift,
  isLoading,
  isRefetching,
  activeId,
  onSelect,
  replacement,
  scopeLabel,
}: ChartsViewProps) {
  const { ops } = useOps();
  const series = useMemo(() => plantSeries(rows, range), [rows, range]);
  const dates = useMemo(() => workingDatesIn(range).filter((d) => d <= DATA_END), [range]);
  const data = useMemo(() => insights(rows, dates, range, ops), [rows, dates, range, ops]);
  if (replacement) return <>{replacement}</>;

  const elapsed = series.filter((p) => p.value != null);
  const categories = dates.map(formatShortDate);
  const titles = dates.map(formatLongDate);
  const card = { isLoading, isRefetching };
  const half = "flex-1 basis-chart-card-min";
  const shifts = shift === "all" ? SHIFTS : [shift];

  // Com o banco, ritmo (minutos por OP) e OPs ainda não existem: fora, em vez de "0"
  const known = DATA_ORIGIN === "demo";
  const kpis: KpiItem[] = (
    [
      {
        id: "rate",
        label: "Ritmo médio",
        value: formatDecimal(data.perMinuteTotal),
        aside: <span className="text-subtle">peças/min</span>,
        footer: `${formatNumber(data.produced)} peças em ${plural(data.entries, "apontamento", "apontamentos")}`,
      },
      {
        id: "ops",
        label: "OPs concluídas",
        value: formatNumber(data.opsDone),
        footer: data.opsDone ? `Em média ${days(data.avgLeadDays)} da liberação à conclusão` : "Nenhuma concluída no período",
      },
      {
        id: "open",
        label: "OPs em aberto agora",
        value: formatNumber(data.opsOpen),
        footer: data.opsPaused ? `${plural(data.opsPaused, "pausada", "pausadas")}` : "Nenhuma pausada",
      },
      {
        id: "rework",
        label: "Retrabalho",
        value: pct(data.reworkRate),
        footer: data.reworkRate > REWORK_LIMIT ? `Acima do limite de ${REWORK_LIMIT}%` : `Dentro do limite de ${REWORK_LIMIT}%`,
      },
      {
        id: "notes",
        label: "Observações dos operadores",
        value: formatNumber(data.notes),
        footer: data.entries ? `Em ${pct((data.notes / data.entries) * 100)} dos apontamentos` : "Sem apontamentos",
      },
    ] satisfies KpiItem[]
  ).filter((k) => known || !["rate", "ops", "open"].includes(k.id));

  const shiftSeries: ComboSeries[] = shifts.map((s) => ({
    name: SHIFT_NAMES[s],
    kind: "bar",
    stack: "shifts",
    color: (["c1", "c2", "c3"] as const)[s - 1],
    data: data.byDayShift.map((d) => d.byShift[s - 1]),
  }));
  const shiftLegend: LegendItem[] = shifts.map((s) => ({
    label: SHIFT_NAMES[s],
    shape: "rect",
    colorClass: SHIFT_FILL[s],
  }));
  const shiftTotals = shifts.map((s) => ({
    s,
    total: data.byDayShift.reduce((q, d) => q + d.byShift[s - 1], 0),
  }));
  const bestShift = [...shiftTotals].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="flex flex-col gap-400">
      <KpiStrip items={kpis} isLoading={isLoading} label="Indicadores de operação do período" />

      <Section title="Produção" hint={`Soma de ${scopeLabel}, dias úteis de ${periodText}`}>
        <ChartCard
          {...card}
          className="basis-full"
          title="Produção acumulada vs meta"
          subtitle="Onde o período está em relação à meta, dia a dia"
          legend={BURNUP_LEGEND}
          table={
            <MiniTable
              caption="Produção acumulada e meta acumulada por dia útil"
              columns={[
                { header: "Dia" },
                { header: "Realizado acumulado", align: "end" },
                { header: "Meta acumulada", align: "end" },
                { header: "% da meta", align: "end" },
              ]}
              rows={series.map((p) => [
                formatShortDate(p.date),
                p.cumulative != null ? formatNumber(p.cumulative) : "—",
                formatNumber(p.targetCumulative),
                p.cumulative != null ? `${Math.round((p.cumulative / p.targetCumulative) * 100)}%` : "—",
              ])}
            />
          }
        >
          <BurnupChart series={series} label="Produção acumulada vs meta" />
        </ChartCard>

        <ChartCard
          {...card}
          className={half}
          title="Produção diária"
          subtitle="Por dia útil, contra a meta diária"
          legend={DAILY_LEGEND}
          table={
            <MiniTable
              caption="Produção por dia útil"
              columns={[{ header: "Dia" }, { header: "Produção", align: "end" }, { header: "% da meta diária", align: "end" }]}
              rows={elapsed.map((p) => [
                formatShortDate(p.date),
                formatNumber(p.value!),
                `${Math.round((p.value! / p.dailyTarget) * 100)}%`,
              ])}
            />
          }
        >
          <DailyColumns series={series} label="Produção diária" />
        </ChartCard>

        <ChartCard
          {...card}
          className={half}
          title="Produção por turno"
          subtitle={shift === "all" ? "Peças por dia, empilhadas por turno" : `Peças por dia no ${SHIFT_NAMES[shift].toLowerCase()}`}
          legend={shiftLegend}
          table={
            <MiniTable
              caption="Produção por dia e por turno"
              columns={[
                { header: "Dia" },
                ...shifts.map((s) => ({
                  header: SHIFT_NAMES[s],
                  align: "end" as const,
                })),
              ]}
              rows={data.byDayShift.map((d) => [formatShortDate(d.date), ...shifts.map((s) => formatNumber(d.byShift[s - 1]))])}
            />
          }
        >
          <ComboChart
            categories={categories}
            titles={titles}
            series={shiftSeries}
            label={`Produção por turno. ${
              bestShift?.total
                ? `${SHIFT_NAMES[bestShift.s]} produziu mais: ${formatNumber(bestShift.total)} peças.`
                : "Sem produção no período."
            }`}
          />
        </ChartCard>

        <ChartCard
          {...card}
          className={half}
          title="Atingimento por máquina"
          subtitle="Clique numa máquina para ver as ordens de produção"
          table={
            <MiniTable
              caption="Atingimento da meta por máquina"
              columns={[
                { header: "Máquina" },
                { header: "Produção", align: "end" },
                { header: "Meta", align: "end" },
                { header: "Atingimento", align: "end" },
              ]}
              rows={[...rows]
                .sort((a, b) => b.percent - a.percent)
                .map((m) => [m.name, formatNumber(m.produced), formatNumber(m.target), `${m.percent}% · ${STATUS_META[m.status].label}`])}
            />
          }
        >
          <AttainmentBars machines={rows} activeId={activeId} onSelect={onSelect} />
        </ChartCard>

        {/* Ritmo e OPs dependem de minutos por OP e do cadastro de OPs, que o banco ainda não tem */}
        {known && (
          <ChartCard
            {...card}
            className={half}
            title="Ritmo por máquina"
            subtitle="Peças por minuto produtivo apontado · clique para abrir a máquina"
            table={
              <MiniTable
                caption="Peças por minuto por máquina"
                columns={[{ header: "Máquina" }, { header: "Peças/min", align: "end" }, { header: "Produção", align: "end" }]}
                rows={data.perMinute.map((x) => [x.machine.name, formatDecimal(x.value), formatNumber(x.machine.produced)])}
              />
            }
          >
            <HBars
              items={data.perMinute.map((x) => ({
                id: x.machine.id,
                label: x.machine.name,
                value: x.value,
                display: formatDecimal(x.value),
                detail: `${formatNumber(x.machine.produced)} peças no período`,
              }))}
              unit="peças/min"
              activeId={activeId}
              onSelect={(id) => {
                const m = rows.find((r) => r.id === id);
                if (m) onSelect(m);
              }}
              label={`Ritmo por máquina, em peças por minuto. ${
                data.perMinute[0]
                  ? `Mais rápida: ${data.perMinute[0].machine.name}, ${formatDecimal(data.perMinute[0].value)} peças/min.`
                  : ""
              }`}
            />
          </ChartCard>
        )}
      </Section>

      {known && (
        <Section title="Ordens de produção" hint="OPs das máquinas filtradas concluídas no período, contadas pela data de conclusão">
          <ChartCard
            {...card}
            className={half}
            title="OPs concluídas por dia"
            subtitle="Quantidade e tempo médio da liberação à conclusão"
            legend={OPS_LEGEND}
            table={
              <MiniTable
                caption="OPs concluídas e tempo médio por dia"
                columns={[{ header: "Dia" }, { header: "Concluídas", align: "end" }, { header: "Tempo médio", align: "end" }]}
                rows={data.opsByDay.map((d) => [formatShortDate(d.date), formatNumber(d.count), d.avgDays == null ? "—" : days(d.avgDays)])}
              />
            }
          >
            <ComboChart
              categories={categories}
              titles={titles}
              integer
              series={[
                {
                  name: "OPs concluídas",
                  kind: "bar",
                  color: "brand",
                  data: data.opsByDay.map((d) => d.count),
                },
                {
                  name: "tempo médio",
                  kind: "line",
                  color: "c2",
                  right: true,
                  format: days,
                  data: data.opsByDay.map((d) => d.avgDays),
                },
              ]}
              rightFormat={(v) => formatDecimal(v)}
              label={`OPs concluídas por dia. ${formatNumber(data.opsDone)} no período, em média ${days(data.avgLeadDays)} cada.`}
            />
          </ChartCard>

          <ChartCard
            {...card}
            className={half}
            title="Tempo das OPs"
            subtitle="Da liberação à conclusão, por faixa"
            table={
              <MiniTable
                caption="OPs concluídas por faixa de tempo"
                columns={[{ header: "Faixa" }, { header: "OPs", align: "end" }, { header: "% do total", align: "end" }]}
                rows={data.leadBuckets.map((b) => [
                  b.label,
                  formatNumber(b.count),
                  data.opsDone ? pct((b.count / data.opsDone) * 100) : "—",
                ])}
              />
            }
          >
            <ComboChart
              categories={data.leadBuckets.map((b) => b.label)}
              integer
              series={[
                {
                  name: "OPs concluídas",
                  kind: "bar",
                  color: "brand",
                  data: data.leadBuckets.map((b) => b.count),
                },
              ]}
              label={`Tempo das OPs por faixa. ${data.leadBuckets.map((b) => `${b.count} ${b.label}`).join(", ")}.`}
            />
          </ChartCard>
        </Section>
      )}

      <Section title="Qualidade" hint="Apontamentos marcados como retrabalho e os motivos informados">
        <ChartCard
          {...card}
          className={half}
          title="Retrabalho por dia"
          subtitle={`Peças e taxa sobre a produção do dia; limite de ${REWORK_LIMIT}%`}
          legend={REWORK_LEGEND}
          table={
            <MiniTable
              caption="Retrabalho por dia"
              columns={[{ header: "Dia" }, { header: "Peças", align: "end" }, { header: "Taxa", align: "end" }]}
              rows={data.reworkByDay.map((d) => [formatShortDate(d.date), formatNumber(d.qty), d.rate == null ? "—" : pct(d.rate)])}
            />
          }
        >
          <ComboChart
            categories={categories}
            titles={titles}
            series={[
              {
                name: "peças em retrabalho",
                kind: "bar",
                color: "danger",
                data: data.reworkByDay.map((d) => d.qty),
              },
              {
                name: "da produção do dia",
                kind: "line",
                color: "neutral",
                right: true,
                format: pct,
                data: data.reworkByDay.map((d) => d.rate),
              },
            ]}
            rightFormat={(v) => `${v}%`}
            rightMark={REWORK_LIMIT}
            label={`Retrabalho por dia. Taxa do período: ${pct(data.reworkRate)}; ${
              data.reworkByDay.filter((d) => (d.rate ?? 0) > REWORK_LIMIT).length
            } dias acima do limite de ${REWORK_LIMIT}%.`}
          />
        </ChartCard>

        <ChartCard
          {...card}
          className={half}
          title="Motivos de retrabalho"
          subtitle="Pareto: poucos motivos concentram a maior parte"
          legend={PARETO_LEGEND}
          table={
            <MiniTable
              caption="Motivos de retrabalho"
              columns={[{ header: "Motivo" }, { header: "Ocorrências", align: "end" }, { header: "% acumulado", align: "end" }]}
              rows={data.pareto.map((r) => [r.reason, formatNumber(r.count), pct(r.cumulative)])}
            />
          }
        >
          <ComboChart
            categories={data.pareto.map((r) => r.reason)}
            integer
            series={[
              {
                name: "ocorrências",
                kind: "bar",
                color: "danger",
                data: data.pareto.map((r) => r.count),
              },
              {
                name: "acumulado",
                kind: "line",
                color: "neutral",
                right: true,
                format: pct,
                data: data.pareto.map((r) => r.cumulative),
              },
            ]}
            rightFormat={(v) => `${v}%`}
            rightMax={100}
            label={`Motivos de retrabalho. ${data.pareto[0] ? `Principal: ${data.pareto[0].reason}, ${data.pareto[0].count} ocorrências.` : "Nenhum retrabalho no período."}`}
          />
        </ChartCard>
      </Section>
    </div>
  );
}
