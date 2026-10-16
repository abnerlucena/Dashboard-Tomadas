import { CircleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { STATUS_META, statusFor, type DateRange, type Machine } from "@/data/machines";
import { formatNumber, formatShortDate } from "@/lib/utils";
import { ChartCard, MiniTable } from "@/components/data/Chart";
import { BurnupChart, type BurnupBasis } from "@/components/echarts";
import { BURNUP_LEGEND } from "@/components/echarts/legends";
import { Lozenge } from "@/components/ui/Lozenge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { burnupSeries, burnupSummary } from "./burnup";

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

/**
 * "Produção acumulada vs meta": duas leituras, cada uma com a mesma base dos
 * dois lados (a conta está em burnup.ts). Em cima, o resumo que explica a
 * distância entre elas: atingimento, quanto da meta virou turno apontado e
 * quanto saiu fora da meta.
 */
export function BurnupCard({ rows, range, isLoading, isRefetching }: { rows: Machine[]; range: DateRange; isLoading?: boolean; isRefetching?: boolean }) {
  const [basis, setBasis] = useState<BurnupBasis>("recorded");
  const series = useMemo(() => burnupSeries(rows, range), [rows, range]);
  const sum = useMemo(() => burnupSummary(series), [series]);
  const recorded = basis === "recorded";
  const asOf = sum.asOf ? formatShortDate(sum.asOf) : null;
  const status = sum.attainment != null ? STATUS_META[statusFor(sum.attainment)] : null;
  // Produção no período, mas nenhum turno que conta para a meta: a leitura dos apontados fica vazia
  const noCountedTarget = sum.produced > 0 && sum.recordedTarget === 0;

  const tableRows = (recorded ? series.filter((p) => p.elapsed) : series).map((p) => {
    const a = recorded ? p.counted : p.produced;
    const goal = recorded ? (p.recordedTarget ?? 0) : p.calendarTarget;
    return [
      formatShortDate(p.date),
      a != null ? formatNumber(a) : "—",
      formatNumber(goal),
      a != null && goal ? `${Math.round((a / goal) * 100)}%` : "—",
      ...(recorded ? [p.outsideDay ? formatNumber(p.outsideDay) : "—"] : []),
    ];
  });

  return (
    <ChartCard
      isLoading={isLoading}
      isRefetching={isRefetching}
      className="basis-full"
      title="Produção acumulada vs meta"
      subtitle={
        recorded
          ? "Só os turnos que contam para a meta, contra a meta desses turnos: a mesma conta do atingimento."
          : "Toda a produção contra a meta de todos os dias úteis do período, apontados ou não: onde o mês precisa chegar."
      }
      legend={BURNUP_LEGEND[basis]}
      actions={
        <SegmentedControl
          label="Comparar com"
          iconOnly={false}
          value={basis}
          onChange={(v) => setBasis(v as BurnupBasis)}
          options={[
            { value: "recorded", label: "Turnos apontados" },
            { value: "calendar", label: "Calendário" },
          ]}
        />
      }
      table={
        <MiniTable
          caption={recorded ? "Produção que conta e meta dos turnos apontados, acumuladas por dia" : "Produção total e meta do calendário, acumuladas por dia"}
          columns={[
            { header: "Dia" },
            { header: recorded ? "Produção que conta" : "Produção total", align: "end" },
            { header: recorded ? "Meta dos turnos apontados" : "Meta do calendário", align: "end" },
            { header: "%", align: "end" },
            ...(recorded ? [{ header: "Fora da meta no dia", align: "end" as const }] : []),
          ]}
          rows={tableRows}
        />
      }
    >
      <div className="flex flex-col gap-200">
        <dl className="grid grid-cols-1 overflow-hidden rounded-large border s:grid-cols-3">
          <div className="flex flex-col gap-025 border-b px-200 py-150 s:border-b-0 s:border-r">
            <dt className="font-body-small text-subtle">Atingimento</dt>
            <dd className="flex flex-wrap items-center gap-100">
              <span className="font-heading-large tabular-nums text-default">{pct(sum.attainment)}</span>
              {status && <Lozenge appearance={status.appearance}>{status.label}</Lozenge>}
            </dd>
            <dd className="font-body-small text-subtlest">
              {sum.recordedTarget
                ? `${formatNumber(sum.counted)} de ${formatNumber(sum.recordedTarget)} peças da meta dos turnos apontados`
                : "Nenhum turno que conta para a meta no período"}
            </dd>
          </div>
          <div className="flex flex-col gap-025 border-b px-200 py-150 s:border-b-0 s:border-r">
            <dt className="font-body-small text-subtle">Meta coberta por apontamento</dt>
            <dd className="font-heading-large tabular-nums text-default">{pct(sum.coverage)}</dd>
            <dd className="font-body-small text-subtlest">
              {sum.calendarToDate
                ? `${formatNumber(sum.recordedTarget)} de ${formatNumber(sum.calendarToDate)} da meta do calendário${asOf ? ` até ${asOf}` : ""}. O resto não foi apontado.`
                : "Sem meta no calendário do período"}
            </dd>
          </div>
          <div className="flex flex-col gap-025 px-200 py-150">
            <dt className="font-body-small text-subtle">Fora da meta</dt>
            <dd className="font-heading-large tabular-nums text-default">{formatNumber(sum.outside)}</dd>
            <dd className="font-body-small text-subtlest">
              {sum.outside ? "peças em hora extra, dia anulado ou parada planejada: entram na produção, não no atingimento" : "Toda a produção do período conta para a meta"}
            </dd>
          </div>
        </dl>

        {recorded && noCountedTarget && (
          <p role="status" className="flex items-start gap-100 rounded-large bg-warning px-200 py-150 text-warning">
            <CircleAlert aria-hidden className="mt-025 size-icon-small shrink-0" />
            <span>
              Há {formatNumber(sum.produced)} peças no período, mas nenhum turno que conta para a meta (hora extra, dia anulado ou parada planejada). Veja a
              leitura <button type="button" className="font-semibold underline" onClick={() => setBasis("calendar")}>Calendário</button>.
            </span>
          </p>
        )}

        <BurnupChart series={series} basis={basis} label="Produção acumulada vs meta" />
      </div>
    </ChartCard>
  );
}
