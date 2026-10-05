import * as Tabs from "@radix-ui/react-tabs";
import { ArrowDown, ArrowUp, Download, FilterX, LayoutList, Plus, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  TARGET_MACHINES,
  DEMAND_MACHINES,
  MACHINE_GROUPS,
  PREVIOUS_MONTH_LABEL,
  PREVIOUS_MONTH_PRODUCED,
  SHIFTS,
  SHIFT_META,
  STATUS_META,
  DATA_END,
  DATA_START,
  MONTH_RANGE,
  PERIOD_LABEL,
  WORKING_DATES,
  aggregate,
  isMonthRange,
  scopeMachine,
  statusFor,
  workingDatesIn,
  type DateRange,
  type Machine,
  type Shift,
  type Status,
} from "@/data/machines";
import { formatDecimal, formatNumber, plural, readToken, saveFile, type Notify } from "@/lib/utils";
import { DataTable, type SortState, type TableState } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorMessage } from "@/components/ui/Feedback";
import { FilterPill, type FilterOption } from "@/components/ui/FilterPill";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { rangeLabel } from "@/components/ui/dateRange";
import { Lozenge } from "@/components/ui/Lozenge";
import { ChartsView } from "./ChartsView";
import { DetailedView } from "./DetailedView";
import { machineColumns } from "./machineColumns";
import { MachinePanel } from "./MachinePanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { csvName, machinesCsv, ordersCsv } from "./exportCsv";
import { ShiftsView } from "./ShiftsView";

export type DemoState = "live" | "loading" | "empty" | "error";

interface MachinesPageProps {
  /** Título e trilha (Linhas › Embalagem, Turnos › Turno 1…) */
  title?: string;
  breadcrumbs?: string[];
  titleAccessory?: React.ReactNode;
  /** Recorte fixo por grupo de máquinas (páginas de Linhas) */
  groupId?: string;
  /** Turno pré-selecionado (páginas de Turnos); "Limpar filtros" volta para ele */
  presetShift?: Shift;
  search: string;
  onClearSearch: () => void;
  demoState: DemoState;
  onDemoStateChange: (s: DemoState) => void;
  notify: Notify;
}

const SHIFT_OPTIONS: FilterOption[] = [
  { value: "all", label: "Todos" },
  ...SHIFTS.map((s) => ({ value: String(s), label: SHIFT_META[s].label, hint: SHIFT_META[s].hours })),
];
const STATUSES: FilterOption[] = [
  { value: "all", label: "Qualquer" },
  ...(Object.keys(STATUS_META) as Status[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    hint: STATUS_META[s].range,
  })),
];

const TABS = [
  ["overview", "Visão geral"],
  ["detailed", "Detalhado"],
  ["shifts", "Turnos"],
  ["charts", "Gráficos"],
] as const;

const SORT_VALUE: Record<string, (m: Machine) => number | string> = {
  name: (m) => m.name,
  days: (m) => m.days,
  produced: (m) => m.produced,
  target: (m) => m.target,
  percent: (m) => m.percent,
};

export function MachinesPage({
  title = "Máquinas",
  breadcrumbs,
  titleAccessory,
  groupId,
  presetShift,
  search,
  onClearSearch,
  demoState,
  onDemoStateChange,
  notify,
}: MachinesPageProps) {
  // Centros por demanda (sem meta) desta página: aparecem no Apontamento e nas OPs, não no atingimento
  const demandCount = useMemo(() => {
    const group = MACHINE_GROUPS.find((g) => g.id === groupId);
    return DEMAND_MACHINES.filter((m) => !group || group.machineIds.includes(m.id)).length;
  }, [groupId]);
  // Máquinas disponíveis nesta página (todas ou só as da linha)
  const pool = useMemo(() => {
    const group = MACHINE_GROUPS.find((g) => g.id === groupId);
    return group ? TARGET_MACHINES.filter((m) => group.machineIds.includes(m.id)) : TARGET_MACHINES;
  }, [groupId]);
  const machineOptions = useMemo<FilterOption[]>(
    () => [{ value: "all", label: "Todas" }, ...pool.map((m) => ({ value: m.id, label: m.name }))],
    [pool],
  );
  const DEFAULT_FILTERS = useMemo(
    () => ({ machine: "all", shift: presetShift ? String(presetShift) : "all", status: "all" }),
    [presetShift],
  );
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Período livre: qualquer intervalo de dias (padrão: o mês inteiro)
  const [range, setRange] = useState<DateRange>(MONTH_RANGE);
  const monthView = isMonthRange(range);
  const periodText = monthView ? PERIOD_LABEL : rangeLabel(range);
  /** dias úteis do período que já aconteceram (base da taxa de apontamento) */
  const elapsedDays = useMemo(() => workingDatesIn(range).filter((d) => d <= DATA_END), [range]);
  const [sort, setSort] = useState<SortState | null>({ columnId: "produced", direction: "descending" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastPanelMachine, setLastPanelMachine] = useState<Machine | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Troca de período simula uma busca
  useEffect(() => {
    if (!periodLoading) return;
    const t = window.setTimeout(() => setPeriodLoading(false), readToken("--ds-motion-duration-skeleton") / 2);
    return () => window.clearTimeout(t);
  }, [periodLoading]);

  const shift: Shift | "all" = filters.shift === "all" ? "all" : (Number(filters.shift) as Shift);
  const shiftLabel = shift === "all" ? null : SHIFT_META[shift].label;

  // O turno recorta os dados de todas as abas (exceto a comparação em "Turnos")
  // Centros de 2 turnos não entram no recorte do Turno 3 (não rodam nele)
  const scoped = useMemo(
    () => pool.filter((m) => shift === "all" || shift <= m.regime).map((m) => scopeMachine(m, shift, range)),
    [pool, shift, range],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scoped.filter(
      (m) =>
        (filters.machine === "all" || m.id === filters.machine) &&
        (filters.status === "all" || m.status === filters.status) &&
        (!q || m.name.toLowerCase().includes(q) || m.lines.some((l) => l.toLowerCase().includes(q))),
    );
    if (!sort) return list;
    const get = SORT_VALUE[sort.columnId];
    const dir = sort.direction === "ascending" ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (typeof va === "string" ? va.localeCompare(vb as string, "pt-BR") : va - (vb as number)) * dir;
    });
  }, [scoped, filters, search, sort]);

  // Aba Turnos: as mesmas máquinas filtradas, no período, mas com todos os turnos
  const unscopedRows = useMemo(
    () => rows.map((r) => scopeMachine(TARGET_MACHINES.find((m) => m.id === r.id)!, "all", range)),
    [rows, range],
  );

  const totals = aggregate(rows, elapsedDays.length);
  const onlyDefaults =
    Object.entries(DEFAULT_FILTERS).every(([k, v]) => filters[k as keyof typeof filters] === v) && !search && monthView;

  // Comparação: mês inteiro × mês anterior; outro período × os mesmos dias úteis logo antes dele
  const previous = useMemo(() => {
    if (monthView) return null;
    const before = WORKING_DATES.filter((d) => d < range.from && d >= DATA_START).slice(-elapsedDays.length);
    if (!elapsedDays.length || before.length < elapsedDays.length) return { range: null, produced: 0 };
    const prev = { from: before[0], to: before[before.length - 1] };
    const produced = rows.reduce((s, r) => s + scopeMachine(TARGET_MACHINES.find((m) => m.id === r.id)!, shift, prev).produced, 0);
    return { range: prev, produced };
  }, [monthView, range, elapsedDays.length, rows, shift]);
  const growth = previous
    ? previous.produced
      ? ((totals.produced - previous.produced) / previous.produced) * 100
      : 0
    : PREVIOUS_MONTH_PRODUCED
      ? ((totals.produced - PREVIOUS_MONTH_PRODUCED) / PREVIOUS_MONTH_PRODUCED) * 100
      : 0;
  const growthLabel = previous?.range ? `o período anterior (${rangeLabel(previous.range)})` : PREVIOUS_MONTH_LABEL;
  const showGrowth = previous ? !!previous.range : onlyDefaults && !groupId && !presetShift && PREVIOUS_MONTH_PRODUCED > 0;

  const tableState: TableState =
    demoState === "loading" || periodLoading
      ? "loading"
      : demoState === "error"
        ? "error"
        : demoState === "empty" || rows.length === 0
          ? "empty"
          : "ready";
  const noData = demoState === "error" || demoState === "empty";

  // O painel mostra a máquina no recorte atual; mantém a última durante a animação de saída
  const panelMachine = activeId ? (scoped.find((m) => m.id === activeId) ?? null) : null;
  useEffect(() => {
    if (panelMachine) setLastPanelMachine(panelMachine);
  }, [panelMachine]);

  const setFilter = (key: "machine" | "shift" | "status") => (value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const changeRange = (r: DateRange) => {
    setRange(r);
    setPeriodLoading(true);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setRange(MONTH_RANGE);
    onClearSearch();
    if (demoState === "empty") onDemoStateChange("live");
  };

  const openPanel = (m: Machine) => setActiveId((id) => (id === m.id ? null : m.id));

  /** Gera e baixa o CSV; avisa o que saiu (ou que a pessoa recusou o download) */
  const download = async (name: string, csv: string, what: string) => {
    setExporting(true);
    try {
      const r = await saveFile(name, new Blob([csv], { type: "text/csv;charset=utf-8" }));
      if (r === "saved") notify("Planilha baixada", `${what} · ${periodText}. Abre no Excel (${name}).`);
    } catch {
      notify("Não foi possível exportar", "Tente de novo. Se continuar, recarregue a página.", "error");
    } finally {
      setExporting(false);
    }
  };

  const onAction = (action: string, m: Machine) => {
    if (action === "export")
      void download(csvName("dash", m.name, periodText), ordersCsv(m, m.orders), `${m.name}: ${plural(m.orders.length, "apontamento", "apontamentos")}`);
    else if (action === "entry") window.location.hash = "/apontamento";
    else notify("Histórico da máquina", "Ainda não existe uma tela só da máquina. Os apontamentos dela estão no Histórico.");
  };

  const exportAll = () => void download(csvName("dash-maquinas", periodText), machinesCsv(rows), plural(rows.length, "máquina", "máquinas"));

  /* ---------- Estados compartilhados pelas abas ---------- */
  const emptyState =
    demoState === "empty" ? (
      <EmptyState
        icon={LayoutList}
        title={`Nenhum apontamento em ${periodText}`}
        hint="Ainda não há produção registrada neste período. Os números aparecem assim que o primeiro turno apontar."
        action={{ label: "Novo apontamento", icon: Plus, onClick: () => (window.location.hash = "/apontamento") }}
      />
    ) : (
      <EmptyState
        icon={SearchX}
        title="Nenhuma máquina encontrada"
        hint={
          search
            ? `Nada corresponde a "${search}" com os filtros atuais.`
            : "Nenhuma máquina corresponde aos filtros selecionados."
        }
        action={{ label: "Limpar filtros", icon: FilterX, onClick: clearFilters }}
      />
    );
  const errorState = (
    <ErrorMessage
      title={`Não foi possível carregar a produção de ${periodText}`}
      actions={
        <>
          <Button iconBefore={RefreshCw} onClick={() => onDemoStateChange("loading")}>
            Tentar novamente
          </Button>
          <Button appearance="subtle" onClick={() => notify("Status do sistema", "Serviço de apontamentos: instável.")}>
            Ver status do sistema
          </Button>
        </>
      }
    >
      O serviço de apontamentos não respondeu. Tente de novo em alguns instantes; se persistir, avise o suporte.
    </ErrorMessage>
  );

  /* ---------- KPIs (seguem os filtros) ---------- */
  const status = STATUS_META[statusFor(totals.percent)];
  const kpis: KpiItem[] = [
    {
      id: "produced",
      label: "Produção",
      value: noData ? "—" : formatNumber(totals.produced),
      footer: noData ? (
        "Sem dados no período"
      ) : showGrowth ? (
        // mês: contra o mês anterior (só a fábrica inteira); outro período: contra os dias úteis logo antes
        <span className="flex flex-wrap items-center gap-x-050">
          <span className={`flex items-center gap-025 font-medium ${growth >= 0 ? "text-success" : "text-danger"}`}>
            {growth >= 0 ? <ArrowUp aria-hidden className="size-icon-small" /> : <ArrowDown aria-hidden className="size-icon-small" />}
            {formatDecimal(Math.abs(growth))}%
          </span>
          {growth >= 0 ? "acima de" : "abaixo de"} {growthLabel}
        </span>
      ) : (
        previous && !previous.range
          ? "Sem período anterior nos dados"
          : groupId || presetShift
            ? `Produção de ${periodText}${shiftLabel ? ` no ${shiftLabel.toLowerCase()}` : ""}`
            : `Recorte filtrado${shiftLabel ? ` · ${shiftLabel}` : ""}`
      ),
    },
    {
      id: "percent",
      label: "Atingimento da meta",
      value: noData ? "—" : `${totals.percent}%`,
      aside: noData ? undefined : <Lozenge appearance={status.appearance}>{status.label}</Lozenge>,
      footer: noData
        ? "Sem dados no período"
        : `Meta ${shiftLabel ? `do ${shiftLabel.toLowerCase()}` : monthView ? "do mês" : "do período"}: ${formatNumber(totals.target)}`,
    },
    {
      id: "rate",
      label: "Taxa de apontamento",
      value: noData ? "—" : `${totals.entryRate}%`,
      footer: noData ? "Sem dados no período" : `Dias com apontamento sobre ${plural(elapsedDays.length, "dia útil", "dias úteis")}`,
    },
    {
      id: "active",
      label: "Máquinas ativas",
      value: noData ? "—" : rows.filter((m) => m.days > 0).length,
      aside: noData ? undefined : <span className="font-body-large text-subtle">de {rows.length}</span>,
      footer: noData
        ? "Sem dados no período"
        : shiftLabel
          ? `Com apontamento no ${shiftLabel.toLowerCase()}`
          : monthView
            ? "Com apontamento no mês"
            : "Com apontamento no período",
    },
  ];

  const pad = "px-200 m:px-400";

  return (
    <>
      <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-full flex-col">
        {/* ---------- Cabeçalho da página ---------- */}
        <PageHeader
          title={title}
          breadcrumbs={breadcrumbs}
          lozenge={
            titleAccessory ?? (
              <Lozenge appearance="success" withDot>
                Em produção
              </Lozenge>
            )
          }
          actions={
            <>
              <Button appearance="subtle" iconBefore={Download} isLoading={exporting} onClick={exportAll}>
                Exportar
              </Button>
              <Button appearance="primary" iconBefore={Plus} onClick={() => (window.location.hash = "/apontamento")}>
                Novo apontamento
              </Button>
            </>
          }
        >
          <Tabs.List
            aria-label="Visões da página"
            className="mt-200 flex gap-300 overflow-x-auto overflow-y-hidden border-b"
          >
            {TABS.map(([value, label]) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="shrink-0 whitespace-nowrap border-b-thick border-transparent pb-100 pt-050 font-body font-medium text-subtle transition-colors duration-hover ease-out hover:text-default data-[state=active]:border-selected data-[state=active]:text-selected"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </PageHeader>

        {/* ---------- Filtros: uma linha acima do conteúdo; valem para todas as abas ---------- */}
        <div role="toolbar" aria-label="Filtros" className={`${pad} flex flex-wrap items-center gap-100 pt-300`}>
          <DateRangePicker
            label="Período"
            value={range}
            defaultValue={MONTH_RANGE}
            onChange={changeRange}
            min={DATA_START}
            max={MONTH_RANGE.to}
            dataEnd={DATA_END}
          />
          <FilterPill
            label="Máquina"
            value={filters.machine}
            defaultValue="all"
            options={machineOptions}
            onChange={setFilter("machine")}
          />
          <FilterPill
            label="Turno"
            value={filters.shift}
            defaultValue={DEFAULT_FILTERS.shift}
            options={SHIFT_OPTIONS}
            onChange={setFilter("shift")}
          />
          <FilterPill label="Status" value={filters.status} defaultValue="all" options={STATUSES} onChange={setFilter("status")} />
          {!onlyDefaults && (
            <Button appearance="subtle" iconBefore={FilterX} onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
          {tableState === "ready" && (
            <p aria-live="polite" className="ml-auto font-body-small text-subtlest">
              {rows.length === pool.length ? plural(rows.length, "máquina com meta", "máquinas com meta") : `${rows.length} de ${pool.length} máquinas com meta`}
              {demandCount > 0 && ` · ${plural(demandCount, "centro por demanda fica", "centros por demanda ficam")} fora do atingimento`}
            </p>
          )}
        </div>

        {/* ---------- Visão geral ---------- */}
        <Tabs.Content value="overview" className={`${pad} flex flex-col gap-300 py-300 outline-none data-[state=inactive]:hidden`}>
          <KpiStrip items={kpis} isLoading={tableState === "loading"} />
          <DataTable
            caption={`Produção por máquina em ${periodText}`}
            columns={machineColumns({ onOpenOrders: openPanel, onAction, totals })}
            rows={rows}
            getRowId={(m) => m.id}
            getRowLabel={(m) => `${m.name}, ${m.percent}% da meta, ${STATUS_META[m.status].label}`}
            state={tableState}
            selectedIds={selected}
            onSelectionChange={setSelected}
            activeRowId={activeId}
            onRowActivate={openPanel}
            sort={sort}
            onSortChange={setSort}
            footerLead={
              selected.size > 0 ? (
                <span className="font-medium text-selected">
                  {selected.size} de {rows.length} selecionadas
                </span>
              ) : (
                plural(rows.length, "máquina", "máquinas")
              )
            }
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Detalhado ---------- */}
        <Tabs.Content value="detailed" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <DetailedView
            rows={rows}
            dates={elapsedDays}
            state={tableState}
            activeId={activeId}
            onRowActivate={openPanel}
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Turnos ---------- */}
        <Tabs.Content value="shifts" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <ShiftsView
            machines={unscopedRows}
            state={tableState}
            focus={shift === "all" ? null : shift}
            activeId={activeId}
            onRowActivate={openPanel}
            emptyState={emptyState}
            errorState={errorState}
          />
        </Tabs.Content>

        {/* ---------- Gráficos ---------- */}
        <Tabs.Content value="charts" className={`${pad} py-300 outline-none data-[state=inactive]:hidden`}>
          <ChartsView
            rows={rows}
            range={range}
            periodText={periodText}
            shift={shift}
            isLoading={demoState === "loading"}
            isRefetching={periodLoading}
            activeId={activeId}
            onSelect={openPanel}
            scopeLabel={`${rows.length === pool.length ? (groupId ? `todas as máquinas da linha` : "todas as máquinas") : plural(rows.length, "máquina", "máquinas")}${shiftLabel ? ` no ${shiftLabel.toLowerCase()}` : ""}`}
            replacement={
              demoState === "error" ? (
                errorState
              ) : demoState === "empty" || rows.length === 0 ? (
                <div className="rounded-xlarge border">{emptyState}</div>
              ) : undefined
            }
          />
        </Tabs.Content>
      </Tabs.Root>

      <MachinePanel
        machine={panelMachine ?? lastPanelMachine}
        open={panelMachine != null}
        scopeLabel={shiftLabel}
        periodText={periodText}
        workingDays={elapsedDays.length}
        onClose={() => {
          // devolve o foco ao que abriu o painel (linha da tabela ou barra do gráfico)
          document.querySelector<HTMLElement>('tr[aria-current="true"], button[aria-pressed="true"]')?.focus();
          setActiveId(null);
        }}
        onAction={onAction}
      />
    </>
  );
}
