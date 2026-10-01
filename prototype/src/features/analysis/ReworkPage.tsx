import { useMemo, useState } from "react";
import {
  ALL_ORDERS,
  MACHINES,
  REWORK_REASONS,
  SHIFTS,
  SHIFT_META,
  machineById,
  opLabel,
  type ProductionOrder,
} from "@/data/machines";
import { cn, formatDecimal, formatNumber, formatShortDate } from "@/lib/utils";
import { BarList } from "@/components/data/BarList";
import { ChartCard, MiniTable } from "@/components/data/Chart";
import { DataTable, type Column } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { SHIFT_FILL } from "@/components/data/shiftColors";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { FilterPill } from "@/components/ui/FilterPill";
import { Lozenge } from "@/components/ui/Lozenge";
import { FilterX, SearchX } from "lucide-react";

/** Limite aceitável de retrabalho (referência nos gráficos) */
const LIMIT = 10;
const pct = (part: number, total: number) => (total ? (part / total) * 100 : 0);

export function ReworkPage() {
  const [machine, setMachine] = useState("all");
  const [shift, setShift] = useState("all");
  const [reason, setReason] = useState("all");

  const inScope = useMemo(
    () =>
      ALL_ORDERS.filter(
        (o) => (machine === "all" || o.machineId === machine) && (shift === "all" || String(o.shift) === shift),
      ),
    [machine, shift],
  );
  const reworked = inScope.filter((o) => o.rework && (reason === "all" || o.reworkReason === reason));
  const produced = inScope.reduce((s, o) => s + o.quantity, 0);
  const reworkQty = reworked.reduce((s, o) => s + o.quantity, 0);

  const byMachine = MACHINES.map((m) => {
    const orders = inScope.filter((o) => o.machineId === m.id);
    const total = orders.reduce((s, o) => s + o.quantity, 0);
    const rw = orders.filter((o) => o.rework && (reason === "all" || o.reworkReason === reason)).reduce((s, o) => s + o.quantity, 0);
    return { m, total, rw, rate: pct(rw, total) };
  })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.rate - a.rate);

  const byReason = REWORK_REASONS.map((r) => {
    const orders = inScope.filter((o) => o.rework && o.reworkReason === r);
    return { reason: r, qty: orders.reduce((s, o) => s + o.quantity, 0), count: orders.length };
  })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.qty - a.qty);
  const reasonTotal = byReason.reduce((s, r) => s + r.qty, 0);

  const worst = byMachine[0];
  const topReason = byReason[0];
  const filtersActive = machine !== "all" || shift !== "all" || reason !== "all";
  const clear = () => {
    setMachine("all");
    setShift("all");
    setReason("all");
  };

  const kpis: KpiItem[] = [
    { id: "qty", label: "Peças retrabalhadas", value: formatNumber(reworkQty), footer: `${reworked.length} OPs de retrabalho` },
    {
      id: "rate",
      label: "Taxa de retrabalho",
      value: `${formatDecimal(pct(reworkQty, produced))}%`,
      aside:
        pct(reworkQty, produced) > LIMIT ? (
          <Lozenge appearance="warning">Acima do limite</Lozenge>
        ) : (
          <Lozenge appearance="success">Dentro do limite</Lozenge>
        ),
      footer: `Limite de referência: ${LIMIT}%`,
    },
    {
      id: "worst",
      label: "Maior taxa",
      value: worst ? `${formatDecimal(worst.rate)}%` : "—",
      footer: worst ? worst.m.name : "Sem produção no recorte",
    },
    {
      id: "reason",
      label: "Motivo mais frequente",
      value: topReason ? `${Math.round(pct(topReason.qty, reasonTotal))}%` : "—",
      footer: topReason ? `${topReason.reason} · ${topReason.count} OPs` : "Nenhum retrabalho no recorte",
    },
  ];

  const columns: Column<ProductionOrder>[] = [
    { id: "date", header: "Data", cell: (o) => <span className="tabular-nums text-default">{formatShortDate(o.date)}</span> },
    {
      id: "machine",
      header: "Máquina",
      className: "min-w-column-name",
      cell: (o) => <span className="font-medium text-default">{machineById(o.machineId).name}</span>,
    },
    {
      id: "shift",
      header: "Turno",
      cell: (o) => (
        <span className="flex items-center gap-075">
          <span aria-hidden className={cn("size-dot rounded-full", SHIFT_FILL[o.shift])} />
          {SHIFT_META[o.shift].label}
        </span>
      ),
    },
    { id: "op", header: "OP", cell: (o) => <span className="font-code text-default">{opLabel(o)}</span> },
    {
      id: "qty",
      header: "Quantidade",
      align: "end",
      cell: (o) => <span className="font-medium tabular-nums text-default">{formatNumber(o.quantity)}</span>,
      footer: <span className="font-semibold tabular-nums text-default">{formatNumber(reworkQty)}</span>,
    },
    { id: "reason", header: "Motivo", cell: (o) => <Lozenge>{o.reworkReason}</Lozenge> },
    { id: "op-by", header: "Operador", className: "pr-200", cell: (o) => <span className="text-subtle">{o.operator}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Retrabalho"
        description="OPs marcadas como retrabalho no apontamento. A taxa é a quantidade retrabalhada sobre a produção."
      />
      <PageBody>
        <div role="toolbar" aria-label="Filtros" className="flex flex-wrap items-center gap-100">
          <FilterPill
            label="Máquina"
            value={machine}
            defaultValue="all"
            onChange={setMachine}
            options={[{ value: "all", label: "Todas" }, ...MACHINES.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <FilterPill
            label="Turno"
            value={shift}
            defaultValue="all"
            onChange={setShift}
            options={[{ value: "all", label: "Todos" }, ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label, hint: SHIFT_META[s].hours }))]}
          />
          <FilterPill
            label="Motivo"
            value={reason}
            defaultValue="all"
            onChange={setReason}
            options={[{ value: "all", label: "Todos" }, ...REWORK_REASONS.map((r) => ({ value: r, label: r }))]}
          />
          {filtersActive && (
            <Button appearance="subtle" iconBefore={FilterX} onClick={clear}>
              Limpar filtros
            </Button>
          )}
        </div>

        <KpiStrip items={kpis} label="Indicadores de retrabalho" />

        <div className="flex flex-wrap gap-300">
          <ChartCard
            className="flex-1 basis-chart-card-min"
            title="Taxa de retrabalho por máquina"
            subtitle={`Linha tracejada: limite de ${LIMIT}%`}
            table={
              <MiniTable
                caption="Taxa de retrabalho por máquina"
                columns={[{ header: "Máquina" }, { header: "Retrabalho", align: "end" }, { header: "Produção", align: "end" }, { header: "Taxa", align: "end" }]}
                rows={byMachine.map((x) => [x.m.name, formatNumber(x.rw), formatNumber(x.total), `${formatDecimal(x.rate)}%`])}
              />
            }
          >
            <BarList
              label="Taxa de retrabalho por máquina"
              reference={{ value: LIMIT, label: `Limite ${LIMIT}%` }}
              items={byMachine.map((x) => ({
                id: x.m.id,
                label: x.m.name,
                value: x.rate,
                display: `${formatDecimal(x.rate)}%`,
                accessory: x.rate > LIMIT ? <Lozenge appearance="warning">Acima</Lozenge> : undefined,
              }))}
            />
          </ChartCard>

          <ChartCard
            className="flex-1 basis-chart-card-min"
            title="Motivos de retrabalho"
            subtitle="Quantidade retrabalhada por motivo, do maior para o menor"
            table={
              <MiniTable
                caption="Motivos de retrabalho"
                columns={[{ header: "Motivo" }, { header: "OPs", align: "end" }, { header: "Quantidade", align: "end" }, { header: "Participação", align: "end" }]}
                rows={byReason.map((r) => [r.reason, r.count, formatNumber(r.qty), `${Math.round(pct(r.qty, reasonTotal))}%`])}
              />
            }
          >
            {byReason.length ? (
              <BarList
                label="Motivos de retrabalho"
                items={byReason.map((r) => ({
                  id: r.reason,
                  label: r.reason,
                  value: r.qty,
                  display: `${Math.round(pct(r.qty, reasonTotal))}%`,
                  accessory: <span className="font-body-small text-subtlest">{r.count} OPs</span>,
                }))}
              />
            ) : (
              <p className="py-300 text-center text-subtle">Nenhum retrabalho no recorte.</p>
            )}
          </ChartCard>
        </div>

        <section aria-labelledby="rework-list" className="flex flex-col gap-150">
          <h2 id="rework-list" className="font-heading-small text-default">
            OPs de retrabalho
          </h2>
          <DataTable
            caption="OPs de retrabalho"
            columns={columns}
            rows={reworked}
            getRowId={(o) => o.id}
            getRowLabel={(o) => `${o.opId}, ${machineById(o.machineId).name}, ${o.reworkReason}`}
            selectable={false}
            state={reworked.length ? "ready" : "empty"}
            footerLead={`${reworked.length} OPs`}
            emptyState={
              <EmptyState
                icon={SearchX}
                title="Nenhuma OP de retrabalho"
                hint="Nada corresponde aos filtros selecionados."
                action={filtersActive ? { label: "Limpar filtros", icon: FilterX, onClick: clear } : undefined}
              />
            }
          />
        </section>
      </PageBody>
    </>
  );
}
