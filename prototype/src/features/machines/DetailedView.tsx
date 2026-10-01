import { useState, type ReactNode } from "react";
import { PERIOD_LABEL, STATUS_META, dayKey, type Machine, type Status } from "@/data/machines";
import { formatCompact, formatNumber } from "@/lib/utils";
import { DataTable, type Column, type TableState } from "@/components/data/DataTable";
import { HeatCell, type HeatMode } from "@/components/data/HeatCell";
import { Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

interface DetailedViewProps {
  rows: Machine[];
  /** dias úteis do período (uma coluna por dia) */
  dates: Date[];
  state: TableState;
  activeId: string | null;
  onRowActivate: (m: Machine) => void;
  emptyState: ReactNode;
  errorState: ReactNode;
}

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "long" });

/**
 * Visão detalhada: grade máquina × dia útil. Cada célula mostra a produção do
 * dia (ou % da meta diária) no tom do status; "–" marca dia sem apontamento,
 * o que deixa as falhas de apontamento visíveis de relance.
 */
export function DetailedView({ rows, dates, state, activeId, onRowActivate, emptyState, errorState }: DetailedViewProps) {
  const [mode, setMode] = useState<HeatMode>("quantity");

  const dayTotals = dates.map((d) => rows.reduce((s, m) => s + (m.daily.get(dayKey(d)) ?? 0), 0));

  const columns: Column<Machine>[] = [
    {
      id: "name",
      header: "Máquina",
      className: "min-w-column-name",
      cell: (m) => <span className="font-medium text-default">{m.name}</span>,
      skeleton: <Skeleton className="h-150 w-1000" />,
    },
    ...dates.map<Column<Machine>>((date, i) => ({
      id: `d${dayKey(date)}`,
      header: String(date.getDate()),
      srHeader: ` de ${MONTH.format(date)}, ${WEEKDAY.format(date)}`,
      className: "text-center",
      cell: (m) => (
        <HeatCell
          date={date}
          value={m.daily.get(dayKey(date)) ?? null}
          dailyTarget={m.dailyTarget}
          mode={mode}
          machineName={m.name}
        />
      ),
      footer: <span className="block text-center tabular-nums">{dayTotals[i] ? formatCompact(dayTotals[i]) : "–"}</span>,
      skeleton: <Skeleton className="mx-auto h-lozenge w-heat-cell" />,
    })),
    {
      id: "total",
      header: "Total",
      align: "end",
      className: "pr-200",
      cell: (m) => <span className="font-medium tabular-nums text-default">{formatNumber(m.produced)}</span>,
      footer: (
        <span className="font-semibold tabular-nums text-default">
          {formatNumber(rows.reduce((s, m) => s + m.produced, 0))}
        </span>
      ),
      skeleton: <Skeleton className="h-150 w-600" />,
    },
  ];

  return (
    <div className="flex flex-col gap-200">
      <div className="flex flex-wrap items-center justify-between gap-150">
        <div className="flex flex-wrap items-center gap-100">
          <span className="font-body-small text-subtlest">Cor do dia em relação à meta diária:</span>
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <Lozenge key={s} appearance={STATUS_META[s].appearance}>
              {STATUS_META[s].label} · {STATUS_META[s].range}
            </Lozenge>
          ))}
          <span className="font-body-small text-subtlest">– sem apontamento</span>
        </div>
        <SegmentedControl
          label="Valor exibido nas células"
          iconOnly={false}
          value={mode}
          onChange={(v) => setMode(v as HeatMode)}
          options={[
            { value: "quantity", label: "Quantidade" },
            { value: "percent", label: "% da meta diária" },
          ]}
        />
      </div>

      <DataTable
        caption={`Produção diária por máquina em ${PERIOD_LABEL}`}
        columns={columns}
        rows={rows}
        getRowId={(m) => m.id}
        getRowLabel={(m) => `${m.name}, ${m.days} dias com apontamento, total ${formatNumber(m.produced)}`}
        state={state}
        selectable={false}
        activeRowId={activeId}
        onRowActivate={onRowActivate}
        footerLead="Total do dia"
        emptyState={emptyState}
        errorState={errorState}
      />
    </div>
  );
}
