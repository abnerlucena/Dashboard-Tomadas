import * as RadixTooltip from "@radix-ui/react-tooltip";
import { useState } from "react";
import type { DayPoint } from "@/data/machines";
import { cn, formatNumber, formatShortDate, plural } from "@/lib/utils";
import { TOOLTIP_CONTENT_CLASS } from "@/components/ui/Tooltip";

interface SparklineProps {
  points: DayPoint[];
  /** Meta diária: barras acima dela usam a cor da marca; abaixo, neutra */
  threshold: number;
  label: string;
}

/**
 * Sparkline de barras (últimos dias úteis). Uma série só → sem legenda; o
 * título da coluna nomeia a série. Linha tracejada = meta diária. Dias sem
 * apontamento aparecem como um traço na base. Passar o mouse sobre uma barra
 * mostra data e valor.
 */
export function Sparkline({ points, threshold, label }: SparklineProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value ?? 0), threshold) * 1.08;
  const above = points.filter((p) => (p.value ?? 0) >= threshold).length;
  const missing = points.filter((p) => p.value == null).length;
  const current = active != null ? points[active] : null;

  return (
    <RadixTooltip.Root open={current != null}>
      <RadixTooltip.Trigger asChild>
        <span
          role="img"
          aria-label={`${label}: ${above} de ${points.length} dias acima da meta diária de ${formatNumber(threshold)}; ${plural(missing, "dia", "dias")} sem apontamento`}
          onPointerLeave={() => setActive(null)}
          className="relative flex h-sparkline-height items-end"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-bold opacity-disabled"
            style={{ bottom: `${(threshold / max) * 100}%` }}
          />
          {points.map((p, i) => (
            <span key={i} aria-hidden onPointerEnter={() => setActive(i)} className="flex h-full items-end px-px">
              {p.value == null ? (
                <span className="h-px w-sparkline-bar bg-chart-neutral" />
              ) : (
                <span
                  className={cn(
                    "w-sparkline-bar rounded-t-xsmall transition-opacity duration-hover ease-out",
                    p.value >= threshold ? "bg-chart-brand" : "bg-chart-neutral",
                    active != null && active !== i && "opacity-disabled",
                  )}
                  style={{ height: `${Math.max(8, (p.value / max) * 100)}%` }}
                />
              )}
            </span>
          ))}
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side="top" sideOffset={6} className={TOOLTIP_CONTENT_CLASS}>
          {current && (
            <span className="flex flex-col">
              <span className="font-semibold tabular-nums">
                {current.value == null ? "Sem apontamento" : formatNumber(current.value)}
              </span>
              <span>
                {formatShortDate(current.date)}
                {current.value != null && ` · ${current.value >= threshold ? "acima" : "abaixo"} da meta diária`}
              </span>
            </span>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
