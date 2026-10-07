import { STATUS_META, statusFor, type Status } from "@/data/machines";
import { cn, formatCompact, formatLongDate, formatNumber } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

// Fundo sutil + texto do papel (mesma dupla dos lozenges de status)
const TONE: Record<Status, string> = {
  critical: "bg-danger text-danger",
  attention: "bg-warning text-warning",
  near: "bg-information text-information",
  achieved: "bg-success text-success",
};

export type HeatMode = "quantity" | "percent";

interface HeatCellProps {
  date: Date;
  value: number | null;
  dailyTarget: number;
  mode: HeatMode;
  machineName: string;
}

/**
 * Célula da grade diária: valor (ou % da meta diária) sobre o tom do status
 * do dia. O status também está no tooltip e no nome acessível — nunca só cor.
 */
export function HeatCell({ date, value, dailyTarget, mode, machineName }: HeatCellProps) {
  const dateLabel = formatLongDate(date);
  if (value == null) {
    return (
      <span
        aria-label={`${machineName}, ${dateLabel}: sem apontamento`}
        className="mx-auto flex h-lozenge w-heat-cell items-center justify-center font-body-small text-subtlest"
      >
        –
      </span>
    );
  }
  // Sem meta diária no recorte (dado do banco): não há % — mostra a quantidade, em tom neutro
  if (!dailyTarget) {
    return (
      <span
        aria-label={`${machineName}, ${dateLabel}: ${formatNumber(value)}, sem meta no dia`}
        className="mx-auto flex h-lozenge w-heat-cell items-center justify-center rounded-small bg-neutral font-body-small font-medium tabular-nums text-subtle"
      >
        {formatCompact(value)}
      </span>
    );
  }
  const percent = Math.round((value / dailyTarget) * 100);
  const status = statusFor(percent);
  const text = mode === "quantity" ? formatCompact(value) : `${percent}%`;

  return (
    <Tooltip
      content={
        <span className="flex flex-col">
          <span className="font-semibold tabular-nums">
            {formatNumber(value)} · {percent}%
          </span>
          <span className="first-letter:uppercase">
            {dateLabel} · {STATUS_META[status].label}
          </span>
        </span>
      }
    >
      <span
        tabIndex={-1}
        aria-label={`${machineName}, ${dateLabel}: ${formatNumber(value)}, ${percent}% da meta diária, ${STATUS_META[status].label}`}
        className={cn(
          "mx-auto flex h-lozenge w-heat-cell items-center justify-center rounded-small font-body-small font-medium tabular-nums",
          TONE[status],
        )}
      >
        {text}
      </span>
    </Tooltip>
  );
}
