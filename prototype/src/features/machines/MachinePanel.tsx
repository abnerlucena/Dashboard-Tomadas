import { Download, History, PackageOpen } from "lucide-react";
import { STATUS_META, opLabel, type Machine, type ProductionOrder } from "@/data/machines";
import { formatLongDate, formatNumber } from "@/lib/utils";
import { Panel } from "@/components/layout/Panel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Lozenge } from "@/components/ui/Lozenge";

interface MachinePanelProps {
  machine: Machine | null;
  open: boolean;
  /** Recorte ativo (ex.: "Turno 2"); a máquina já chega recortada */
  scopeLabel: string | null;
  /** período em texto ("março de 2026", "16 – 20 mar") e seus dias úteis já transcorridos */
  periodText: string;
  workingDays: number;
  onClose: () => void;
  onAction: (action: string, m: Machine) => void;
}

export function MachinePanel({ machine, open, scopeLabel, periodText, workingDays, onClose, onAction }: MachinePanelProps) {
  if (!machine) return null;
  const groups = groupByDay(machine.orders);
  const meta = STATUS_META[machine.status];

  return (
    <Panel
      open={open}
      onClose={onClose}
      title={machine.name}
      subtitle={
        <>
          Ordens de produção · {periodText}
          {scopeLabel && ` · ${scopeLabel}`}
        </>
      }
      headerExtra={
        <dl className="grid grid-cols-3 overflow-hidden rounded-large border">
          {[
            { label: "Produção", value: formatNumber(machine.produced) },
            { label: "Meta", value: formatNumber(machine.target) },
            { label: "Atingimento", value: `${machine.percent}%` },
          ].map((s, i) => (
            <div key={s.label} className={i > 0 ? "border-l px-150 py-100" : "px-150 py-100"}>
              <dt className="font-body-small text-subtlest">{s.label}</dt>
              <dd className="font-metric-small tabular-nums text-default">{s.value}</dd>
            </div>
          ))}
          <div className="col-span-3 flex items-center gap-100 border-t px-150 py-100">
            <Lozenge appearance={meta.appearance}>{meta.label}</Lozenge>
            <span className="font-body-small text-subtlest">
              {machine.days} de {workingDays} dias com apontamento · meta diária {formatNumber(machine.dailyTarget)}
            </span>
          </div>
        </dl>
      }
      footer={
        <>
          <Button iconBefore={History} onClick={() => onAction("history", machine)}>
            Histórico completo
          </Button>
          <Button appearance="subtle" iconBefore={Download} onClick={() => onAction("export", machine)}>
            Exportar
          </Button>
        </>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          headingLevel={3}
          icon={PackageOpen}
          title="Nenhuma ordem neste recorte"
          hint={`Não há apontamentos${scopeLabel ? ` do ${scopeLabel.toLowerCase()}` : ""} para esta máquina em ${periodText}.`}
          className="py-600"
        />
      ) : (
        <div className="flex flex-col gap-250 pt-050">
          {groups.map(([day, items]) => (
            <section key={day} aria-label={formatLongDate(items[0].date)}>
              <h3 className="flex items-baseline justify-between pb-075 font-heading-xxsmall text-subtlest">
                <span className="first-letter:uppercase">{formatLongDate(items[0].date)}</span>
                <span className="font-body-small tabular-nums">
                  {formatNumber(items.reduce((s, o) => s + o.quantity, 0))} un.
                </span>
              </h3>
              <ul className="flex flex-col overflow-hidden rounded-large border">
                {items.map((o) => (
                  <li key={o.id} className="flex min-h-row items-center gap-150 border-t px-150 py-075 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-code text-default">{opLabel(o)}</p>
                      {o.product && <p className="truncate font-body-small text-subtle">{o.product}</p>}
                    </div>
                    <Lozenge>Turno {o.shift}</Lozenge>
                    <span className="w-800 text-right font-medium tabular-nums text-default">
                      {formatNumber(o.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

function groupByDay(orders: ProductionOrder[]) {
  const map = new Map<string, ProductionOrder[]>();
  for (const o of orders) {
    const key = o.date.toISOString().slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  return [...map.entries()];
}
