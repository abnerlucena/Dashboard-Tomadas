import type { ReactNode } from "react";
import { PERIOD_LABEL, SHIFTS, SHIFT_META, STATUS_META, shiftTotals, statusFor, type Machine, type Shift } from "@/data/machines";
import { cn, formatNumber, plural } from "@/lib/utils";
import { Legend } from "@/components/data/Chart";
import { DataTable, type Column, type TableState } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { StackedBar } from "@/components/data/StackedBar";
import { SHIFT_FILL, SHIFT_LEGEND } from "@/components/data/shiftColors";
import { Skeleton } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";

interface ShiftsViewProps {
  /** Máquinas SEM recorte de turno — esta aba é a comparação entre turnos */
  machines: Machine[];
  state: TableState;
  /** Turno escolhido no filtro: fica em destaque, os outros esmaecem */
  focus: Shift | null;
  activeId: string | null;
  onRowActivate: (m: Machine) => void;
  emptyState: ReactNode;
  errorState: ReactNode;
}

const Dot = ({ shift }: { shift: Shift }) => (
  <span aria-hidden className={cn("size-dot shrink-0 rounded-full", SHIFT_FILL[shift])} />
);

export function ShiftsView({ machines, state, focus, activeId, onRowActivate, emptyState, errorState }: ShiftsViewProps) {
  const totals = shiftTotals(machines);
  const plant = totals.reduce((s, t) => s + t.produced, 0);
  const noData = state === "error" || state === "empty";

  const kpis: KpiItem[] = totals.map((t) => {
    const percent = t.target ? Math.round((t.produced / t.target) * 100) : 0;
    const meta = STATUS_META[statusFor(percent)];
    return {
      id: `t${t.shift}`,
      isDimmed: focus != null && focus !== t.shift,
      label: (
        <span className="flex items-center gap-075">
          <Dot shift={t.shift} />
          {SHIFT_META[t.shift].label}
          <span className="text-subtlest">· {SHIFT_META[t.shift].hours}</span>
        </span>
      ),
      value: noData ? "—" : formatNumber(t.produced),
      aside: noData ? undefined : t.target ? (
        <Lozenge appearance={meta.appearance}>
          {percent}% · {meta.label}
        </Lozenge>
      ) : (
        // Turno só com hora extra: produz, mas não tem meta (D27)
        <Lozenge>sem meta</Lozenge>
      ),
      footer: noData
        ? "Sem dados no período"
        : `${plant ? Math.round((t.produced / plant) * 100) : 0}% da produção · ${t.orders} apontamentos`,
    };
  });

  const topShift = (m: Machine): Shift | null => {
    const best = SHIFTS.reduce<Shift | null>((b, s) => (m.byShift[s] > (b ? m.byShift[b] : 0) ? s : b), null);
    return best;
  };

  const shiftColumn = (s: Shift): Column<Machine> => ({
    id: `t${s}`,
    header: SHIFT_META[s].label,
    align: "end",
    className: cn("transition-opacity duration-hover ease-out", focus != null && focus !== s && "opacity-disabled"),
    cell: (m) => {
      const value = m.byShift[s];
      const share = m.produced ? Math.round((value / m.produced) * 100) : 0;
      return value ? (
        <span className="tabular-nums">
          <span className="font-medium text-default">{formatNumber(value)}</span>
          <span className="inline-block w-500 text-right font-body-small text-subtlest">{share}%</span>
        </span>
      ) : (
        <span className="text-subtlest">Sem produção</span>
      );
    },
    footer: (
      <span className="font-semibold tabular-nums text-default">
        {formatNumber(totals.find((t) => t.shift === s)!.produced)}
      </span>
    ),
    skeleton: <Skeleton className="h-150 w-800" />,
  });

  const columns: Column<Machine>[] = [
    {
      id: "name",
      header: "Máquina",
      className: "min-w-column-name",
      cell: (m) => <span className="font-medium text-default">{m.name}</span>,
      skeleton: <Skeleton className="h-150 w-1000" />,
    },
    ...SHIFTS.map(shiftColumn),
    {
      id: "distribution",
      header: "Distribuição",
      cell: (m) => <StackedBar values={m.byShift} label={`Distribuição por turno de ${m.name}`} highlight={focus} />,
      skeleton: <Skeleton className="h-150 w-stacked-bar" />,
    },
    {
      id: "top",
      header: "Maior produção",
      className: "pr-200",
      cell: (m) => {
        const s = topShift(m);
        return s ? (
          <span className="flex items-center gap-075">
            <Dot shift={s} />
            <span className="text-default">{SHIFT_META[s].label}</span>
          </span>
        ) : (
          <span className="text-subtlest">–</span>
        );
      },
      skeleton: <Skeleton className="h-150 w-800" />,
    },
  ];

  return (
    <div className="flex flex-col gap-300">
      <KpiStrip items={kpis} isLoading={state === "loading"} label="Produção por turno" />
      <div className="flex flex-col gap-150">
        <div className="flex flex-wrap items-center justify-between gap-150">
          <h2 className="font-heading-small text-default">Turnos por máquina</h2>
          <Legend items={SHIFT_LEGEND} />
        </div>
        <DataTable
          caption={`Produção por turno em cada máquina, ${PERIOD_LABEL}`}
          columns={columns}
          rows={machines}
          getRowId={(m) => m.id}
          getRowLabel={(m) => `${m.name}, ${SHIFTS.map((s) => `${SHIFT_META[s].label} ${formatNumber(m.byShift[s])}`).join(", ")}`}
          state={state}
          selectable={false}
          activeRowId={activeId}
          onRowActivate={onRowActivate}
          footerLead={plural(machines.length, "máquina", "máquinas")}
          emptyState={emptyState}
          errorState={errorState}
        />
      </div>
    </div>
  );
}
