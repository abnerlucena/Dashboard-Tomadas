import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Feedback";

export interface KpiItem {
  id: string;
  label: ReactNode;
  value: ReactNode;
  /** Complemento ao lado do valor (ex.: "de 6", lozenge de status) */
  aside?: ReactNode;
  footer?: ReactNode;
  /** Fora do foco atual (ex.: outro turno filtrado) */
  isDimmed?: boolean;
}

/**
 * Faixa de KPIs em uma superfície elevada (raised + shadow), células
 * divididas por linhas de 1px. Valores em font.metric.medium, tabular-nums.
 */
export function KpiStrip({
  items,
  isLoading,
  label = "Indicadores do período",
}: {
  items: KpiItem[];
  isLoading?: boolean;
  label?: string;
}) {
  // 2 ou 4 KPIs: uma linha ou 2 × 2 (nunca 3 + 1); outras contagens seguem o espaço
  const balanced = items.length === 2 || items.length === 4;
  return (
    <section aria-label={label} className="overflow-hidden rounded-large bg-surface-raised shadow-raised">
      {/* gap de 1px sobre o fundo da borda = divisórias; flex-wrap segue o espaço real, não a viewport */}
      <dl
        className="flex flex-wrap gap-px bg-border"
        style={balanced ? ({ "--dash-kpi-count": items.length } as CSSProperties) : undefined}
        aria-busy={isLoading || undefined}
      >
        {items.map((item) => (
          // Mobile: 2 por linha, número menor e menos respiro; ≥ 768px: tamanho normal
          <div
            key={item.id}
            className={cn(
              "flex min-w-0 flex-1 flex-col gap-050 bg-surface-raised px-200 py-150 s:px-250 s:py-200",
              balanced ? "kpi-balanced" : "basis-kpi-min-compact s:basis-kpi-min",
            )}
          >
            <dt
              className={cn(
                "font-body-small text-subtle transition-opacity duration-hover ease-out s:font-body",
                item.isDimmed && "opacity-disabled",
              )}
            >
              {item.label}
            </dt>
            {isLoading ? (
              <dd className="flex flex-col gap-100 pt-050">
                <Skeleton className="h-300 w-1/2" />
                <Skeleton className="h-150 w-2/3" />
              </dd>
            ) : (
              <>
                <dd
                  className={cn(
                    "flex flex-wrap items-center gap-100 transition-opacity duration-hover ease-out",
                    item.isDimmed && "opacity-disabled",
                  )}
                >
                  {/* número grande isolado: algarismos proporcionais (tabular só em colunas) */}
                  <span className="font-metric-small text-default s:font-metric-medium">{item.value}</span>
                  {item.aside}
                </dd>
                {item.footer && <dd className="font-body-small text-subtlest">{item.footer}</dd>}
              </>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
