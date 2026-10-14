import { ArrowLeftRight, Info, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn, formatNumber, plural, storageGet, storageSet, type Notify } from "@/lib/utils";
import { CapacityBars } from "@/components/echarts";
import { DataTable, type Column } from "@/components/data/DataTable";
import { KpiStrip, type KpiItem } from "@/components/data/KpiStrip";
import { PageActions, PageBody, PAGE_GUTTER } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Lozenge } from "@/components/ui/Lozenge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  BASELINE,
  spreadsheetPackingTotal,
  computeProcess,
  computeTotals,
  regimeMinutes,
  usefulMinutes,
  type Area,
  type Process,
  type Regime,
  type Scenario,
  type ShiftIndex,
  type ShiftSchedule,
} from "./capacityModel";
import { NumberField } from "./NumberField";
import { capacitiesOf, type Capacity } from "@/features/metas/metaBase";

const STORAGE_KEY = "dash-proto.capacity-scenario.v2";
const clone = (s: Scenario): Scenario => JSON.parse(JSON.stringify(s));
const round = (n: number) => Math.round(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const SHIFT_SHORT = ["1º T", "2º T", "3º T"];
const DEDUCTIONS: Array<{ key: keyof ShiftSchedule; label: string }> = [
  { key: "meal", label: "Refeição" },
  { key: "gymnastics", label: "Ginástica laboral" },
  { key: "breakTime", label: "Intervalo" },
  { key: "changeover", label: "Troca de turno e limpeza" },
];

/** Diferença assinada, com sinal de menos tipográfico: "+1.234" / "−560" */
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(round(n)))}`;

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.5) return null;
  return (
    <span className={cn("font-body-small font-medium tabular-nums", value > 0 ? "text-success" : "text-danger")}>
      {signed(value)}
      {suffix}
    </span>
  );
}

interface Change {
  id: string;
  label: string;
  from: string;
  to: string;
  revert: (s: Scenario) => void;
}

/** Lista cada campo do cenário que difere da planilha */
function diff(s: Scenario): Change[] {
  const out: Change[] = [];
  if (s.workingDays !== BASELINE.workingDays)
    out.push({ id: "days", label: "Dias úteis no mês", from: `${BASELINE.workingDays}`, to: `${s.workingDays}`, revert: (x) => (x.workingDays = BASELINE.workingDays) });
  s.shifts.forEach((sh, i) => {
    const base = BASELINE.shifts[i];
    (["grossMinutes", ...DEDUCTIONS.map((d) => d.key)] as Array<keyof ShiftSchedule>).forEach((k) => {
      if (sh[k] !== base[k]) {
        const label = k === "grossMinutes" ? "tempo bruto" : DEDUCTIONS.find((d) => d.key === k)!.label.toLowerCase();
        out.push({
          id: `s${i}-${k}`,
          label: `${sh.label}: ${label}`,
          from: `${base[k]} min`,
          to: `${sh[k]} min`,
          revert: (x) => ((x.shifts[i] as unknown as Record<string, unknown>)[k] = base[k]),
        });
      }
    });
  });
  s.processes.forEach((p, idx) => {
    const base = BASELINE.processes[idx];
    if (p.rate !== base.rate)
      out.push({ id: `${p.id}-rate`, label: `${p.name}: peças/min`, from: base.rate == null ? "sem taxa" : formatNumber(base.rate), to: p.rate == null ? "sem taxa" : formatNumber(p.rate), revert: (x) => (x.processes[idx].rate = base.rate) });
    if (p.efficiency !== base.efficiency)
      out.push({ id: `${p.id}-eff`, label: `${p.name}: eficiência`, from: pct(base.efficiency), to: pct(p.efficiency), revert: (x) => (x.processes[idx].efficiency = base.efficiency) });
    if (p.regime !== base.regime)
      out.push({ id: `${p.id}-reg`, label: `${p.name}: regime`, from: `${base.regime} turnos`, to: `${p.regime} ${p.regime === 1 ? "turno" : "turnos"}`, revert: (x) => (x.processes[idx].regime = base.regime) });
    p.people.forEach((n, i) => {
      if (n !== base.people[i])
        out.push({ id: `${p.id}-p${i}`, label: `${p.name}: pessoas no ${SHIFT_SHORT[i]}`, from: `${base.people[i]}`, to: `${n}`, revert: (x) => (x.processes[idx].people[i] = base.people[i]) });
    });
  });
  s.support.forEach((r, idx) => {
    const base = BASELINE.support[idx];
    r.people.forEach((n, i) => {
      if (n !== base.people[i])
        out.push({ id: `${r.id}-p${i}`, label: `${r.name}: pessoas (${i < 3 ? SHIFT_SHORT[i] : "normal"})`, from: `${base.people[i]}`, to: `${n}`, revert: (x) => (x.support[idx].people[i] = base.people[i]) });
    });
  });
  return out;
}

interface CapacitySimulatorProps {
  notify: Notify;
  /**
   * Manda a capacidade por turno (máquina → peças) para a aba de metas COMPARAR
   * com a meta acordada. Não grava nada: a capacidade é teto, não meta (D40), e
   * publicá-la sobrescreveria as metas confirmadas pelo gestor (nota de 01/10, § 5).
   */
  onCompare: (capacityPerShift: Record<string, Capacity>) => void;
}

/**
 * Simulador de capacidade (aba da página Metas): parâmetros da planilha
 * Capacidade vs Pessoas editáveis, com meta por turno e capacidade recalculadas.
 */
export function CapacitySimulator({ notify, onCompare }: CapacitySimulatorProps) {
  const [scenario, setScenario] = useState<Scenario>(() => storageGet(STORAGE_KEY, clone(BASELINE)));
  const [tab, setTab] = useState("resumo");
  const [confirmReset, setConfirmReset] = useState(false);
  const [bulkEff, setBulkEff] = useState<Record<Area, number | null>>({ montagem: 60, embalagem: 70 });

  useEffect(() => storageSet(STORAGE_KEY, scenario), [scenario]);

  const update = (fn: (s: Scenario) => void) =>
    setScenario((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });

  const totals = useMemo(() => computeTotals(scenario), [scenario]);
  const base = useMemo(() => computeTotals(BASELINE), []);
  const changes = useMemo(() => diff(scenario), [scenario]);

  const kpis: KpiItem[] = [
    {
      id: "daily",
      label: "Capacidade por dia",
      value: formatNumber(round(totals.daily)),
      aside: <Delta value={totals.daily - base.daily} />,
      footer: `Montagem ${formatNumber(round(totals.montagemDaily))} · embalagem ${formatNumber(round(totals.embalagemDaily))}`,
    },
    {
      id: "monthly",
      label: "Capacidade no mês",
      value: formatNumber(round(totals.monthly)),
      aside: <Delta value={totals.monthly - base.monthly} />,
      footer: `${scenario.workingDays} dias úteis`,
    },
    {
      id: "eff",
      label: "Eficiência média",
      value: pct(totals.efficiency),
      aside: <Delta value={(totals.efficiency - base.efficiency) * 100} suffix=" p.p." />,
      footer: "Ponderada pela capacidade técnica",
    },
    {
      id: "people",
      label: "Pessoas",
      value: totals.people,
      aside: <Delta value={totals.people - base.people} />,
      footer: `1º T ${totals.peopleByShift[0]} · 2º T ${totals.peopleByShift[1]} · 3º T ${totals.peopleByShift[2]} · normal ${totals.peopleByShift[3]}`,
    },
    {
      id: "ppp",
      label: "Peças por pessoa/dia",
      value: formatNumber(round(totals.piecesPerPerson)),
      aside: <Delta value={totals.piecesPerPerson - base.piecesPerPerson} />,
      footer: "Capacidade por dia ÷ pessoas",
    },
  ];

  /* ---------- Tabela de processos (montagem / embalagem) ---------- */
  const processColumns = (area: Area): Column<Process>[] => {
    const idx = (p: Process) => scenario.processes.findIndex((x) => x.id === p.id);
    const baseOf = (p: Process) => BASELINE.processes[idx(p)];
    const areaRows = scenario.processes.filter((p) => p.area === area);
    const areaTotal = areaRows.reduce((s, p) => s + computeProcess(scenario, p).daily, 0);
    const areaBase = BASELINE.processes.filter((p) => p.area === area).reduce((s, p) => s + computeProcess(BASELINE, p).daily, 0);
    return [
      {
        id: "name",
        header: "Processo",
        className: "min-w-column-name",
        cell: (p) => (
          <span className="flex items-center gap-075">
            <span className="font-medium text-default">{p.name}</span>
            {baseOf(p).rate == null && <Lozenge appearance="discovery">Nova</Lozenge>}
            {p.note && (
              <Tooltip content={p.note}>
                <span tabIndex={0} aria-label={p.note} className="flex">
                  <Info aria-hidden className="size-icon-small text-icon-subtle" />
                </span>
              </Tooltip>
            )}
          </span>
        ),
        footer: undefined,
      },
      {
        id: "rate",
        header: "Peças/min",
        align: "end",
        cell: (p) => (
          <NumberField
            label={`Peças por minuto de ${p.name}`}
            value={p.rate}
            decimals={3}
            allowEmpty
            max={1000}
            changed={p.rate !== baseOf(p).rate}
            onChange={(v) => update((s) => (s.processes[idx(p)].rate = v))}
            compact
            className="ml-auto w-field-rate"
          />
        ),
      },
      ...([0, 1, 2] as ShiftIndex[]).map<Column<Process>>((i) => ({
        id: `p${i}`,
        header: `Pessoas ${SHIFT_SHORT[i]}`,
        align: "end",
        cell: (p) => (
          <NumberField
            label={`Pessoas no ${SHIFT_SHORT[i]} em ${p.name}`}
            value={p.people[i]}
            max={50}
            changed={p.people[i] !== baseOf(p).people[i]}
            onChange={(v) => update((s) => (s.processes[idx(p)].people[i] = v ?? 0))}
            compact
            className="ml-auto w-field-count"
          />
        ),
        footer: <span className="font-semibold tabular-nums text-default">{areaRows.reduce((s, p) => s + p.people[i], 0)}</span>,
      })),
      {
        id: "regime",
        header: "Regime (turnos)",
        cell: (p) => (
          <SegmentedControl
            label={`Regime de ${p.name}`}
            iconOnly={false}
            value={String(p.regime)}
            onChange={(v) => update((s) => (s.processes[idx(p)].regime = Number(v) as Regime))}
            options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))}
          />
        ),
      },
      {
        id: "eff",
        header: "Eficiência",
        align: "end",
        cell: (p) => (
          <NumberField
            label={`Eficiência de ${p.name}`}
            value={Math.round(p.efficiency * 1000) / 10}
            decimals={1}
            min={1}
            max={100}
            suffix="%"
            changed={p.efficiency !== baseOf(p).efficiency}
            onChange={(v) => v != null && update((s) => (s.processes[idx(p)].efficiency = v / 100))}
            compact
            className="ml-auto w-field-rate"
          />
        ),
      },
      {
        id: "meta",
        header: "Meta por turno",
        align: "end",
        cell: (p) => {
          const r = computeProcess(scenario, p);
          return p.rate == null ? (
            <span className="text-subtlest">Sem taxa</span>
          ) : (
            <Tooltip content={`${formatNumber(round(r.technical))} técnica × ${pct(p.efficiency)} de eficiência`}>
              <span tabIndex={0} className="tabular-nums text-default">
                {formatNumber(round(r.perShift))}
              </span>
            </Tooltip>
          );
        },
      },
      {
        id: "daily",
        header: "Capacidade por dia",
        align: "end",
        className: "pr-200",
        cell: (p) => {
          const now = computeProcess(scenario, p).daily;
          const before = computeProcess(BASELINE, baseOf(p)).daily;
          return (
            <span className="flex flex-col items-end">
              <span className="font-semibold tabular-nums text-default">{formatNumber(round(now))}</span>
              <Delta value={now - before} />
            </span>
          );
        },
        footer: (
          <span className="flex flex-col items-end">
            <span className="font-semibold tabular-nums text-default">{formatNumber(round(areaTotal))}</span>
            <Delta value={areaTotal - areaBase} />
          </span>
        ),
      },
    ];
  };

  const processTab = (area: Area) => {
    const rows = scenario.processes.filter((p) => p.area === area);
    return (
      <div className="flex flex-col gap-200">
        <div className="flex flex-wrap items-end gap-150 rounded-large bg-surface-sunken p-200">
          <NumberField
            label={`Eficiência para todos os processos da ${area}`}
            showLabel
            value={bulkEff[area]}
            decimals={1}
            min={1}
            max={100}
            suffix="%"
            allowEmpty
            onChange={(v) => setBulkEff((b) => ({ ...b, [area]: v }))}
            className="w-column-name"
          />
          <Button
            isDisabled={bulkEff[area] == null}
            onClick={() => {
              const v = bulkEff[area];
              if (v == null) return;
              update((s) => s.processes.forEach((p) => p.area === area && (p.efficiency = v / 100)));
              notify(`Eficiência de ${v}% aplicada`, `${rows.length} processos da ${area}`);
            }}
          >
            Aplicar a todos
          </Button>
          <p className="min-w-0 flex-1 basis-kpi-min font-body-small text-subtle">
            Meta por turno = peças/min × tempo útil médio dos turnos do regime × eficiência. Capacidade por dia = meta
            por turno × regime. Tempo útil médio hoje: 2 turnos {formatNumber(round(regimeMinutes(scenario, 2)))} min · 3
            turnos {formatNumber(round(regimeMinutes(scenario, 3)))} min.
          </p>
        </div>
        <DataTable
          caption={`Capacidade da ${area}`}
          columns={processColumns(area)}
          rows={rows}
          getRowId={(p) => p.id}
          getRowLabel={(p) => p.name}
          selectable={false}
          footerLead={`${rows.length} processos`}
        />
      </div>
    );
  };

  /** Capacidade por turno de cada processo com taxa, no cenário atual */
  const compare = () => onCompare(capacitiesOf(scenario));

  const card = (title: string, children: ReactNode, extra?: ReactNode) => (
    <section className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-200 rounded-large bg-surface-raised p-250 shadow-raised">
      <header className="flex flex-wrap items-center justify-between gap-100">
        <h2 className="font-heading-small text-default">{title}</h2>
        {extra}
      </header>
      {children}
    </section>
  );

  return (
    <>
      <div className={cn(PAGE_GUTTER, "flex flex-wrap items-center justify-end gap-200 pt-300")}>
        <PageActions>
          <Button appearance="subtle" iconBefore={RotateCcw} isDisabled={changes.length === 0} onClick={() => setConfirmReset(true)}>
            Restaurar planilha
          </Button>
          {/* Propor, não publicar: a meta acordada é decisão do gestor na aba de metas */}
          <Button appearance="primary" iconBefore={ArrowLeftRight} onClick={compare}>
            Comparar com as metas acordadas
          </Button>
        </PageActions>
      </div>

      <div className={cn(PAGE_GUTTER, "pt-300")}>
        <KpiStrip items={kpis} label="Resultado do cenário" />
      </div>

      {/* Seções do simulador: controle segmentado (já estamos dentro de uma aba da página) */}
      <div className={cn(PAGE_GUTTER, "flex flex-wrap items-center gap-150 pt-300")}>
        <SegmentedControl
          label="Seção do simulador"
          iconOnly={false}
          value={tab}
          onChange={setTab}
          options={[
            { value: "resumo", label: changes.length ? `Resumo (${changes.length})` : "Resumo" },
            { value: "montagem", label: "Montagem" },
            { value: "embalagem", label: "Embalagem" },
            { value: "pessoas", label: "Pessoas" },
            { value: "jornada", label: "Jornada" },
          ]}
        />
        {changes.length > 0 && (
          <Lozenge appearance="discovery">{plural(changes.length, "alteração", "alterações")} em relação à planilha</Lozenge>
        )}
      </div>

        {/* ---------- Resumo ---------- */}
        {tab === "resumo" && (
          <div>
          <PageBody>
            <div className="flex flex-wrap items-start gap-300">
              {card(
                "Alterações em relação à planilha",
                changes.length === 0 ? (
                  <p className="text-subtle">
                    Nenhuma alteração: os números acima são os da planilha. Edite eficiência, peças/min, regime, pessoas ou a
                    jornada nas outras abas para simular.
                  </p>
                ) : (
                  <ul className="flex flex-col overflow-hidden rounded-large border">
                    {changes.map((c) => (
                      <li key={c.id} className="flex items-center gap-150 border-t px-150 py-100 first:border-t-0">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-default">{c.label}</span>
                          <span className="font-body-small tabular-nums text-subtle">
                            {c.from} → <strong className="font-semibold text-default">{c.to}</strong>
                          </span>
                        </span>
                        <Button appearance="subtle" spacing="compact" iconBefore={Undo2} onClick={() => update(c.revert)}>
                          Desfazer
                        </Button>
                      </li>
                    ))}
                  </ul>
                ),
                changes.length > 0 && <Lozenge appearance="discovery">{changes.length}</Lozenge>,
              )}
            </div>
            {card(
              "Capacidade por dia, por processo",
              <CapacityBars
                label="Capacidade por dia de cada processo"
                items={totals.results.map(({ p, r }) => ({
                  id: p.id,
                  label: p.name,
                  area: p.area,
                  value: r.daily,
                  before: computeProcess(BASELINE, BASELINE.processes.find((b) => b.id === p.id)!).daily,
                  noRate: p.rate == null,
                }))}
              />,
              <span className="flex items-center gap-200 font-body-small text-subtle">
                <span className="flex items-center gap-075">
                  <span aria-hidden className="size-100 rounded-xsmall bg-chart-categorical-1" />
                  Montagem
                </span>
                <span className="flex items-center gap-075">
                  <span aria-hidden className="size-100 rounded-xsmall bg-chart-categorical-2" />
                  Embalagem
                </span>
              </span>,
            )}
            <p className="font-body-small text-subtlest">
              A planilha mostra {formatNumber(round(spreadsheetPackingTotal()))} peças/dia na embalagem; somando todas as
              linhas, o valor é {formatNumber(round(base.embalagemDaily))}. O protótipo usa a soma completa.
            </p>
          </PageBody>
        </div>
        )}

        {tab === "montagem" && (
          <div>
          <PageBody>{processTab("montagem")}</PageBody>
        </div>
        )}
        {tab === "embalagem" && (
          <div>
          <PageBody>{processTab("embalagem")}</PageBody>
        </div>
        )}

        {/* ---------- Pessoas ---------- */}
        {tab === "pessoas" && (
          <div>
          <PageBody>
            <div className="scrollbar-thin overflow-x-auto rounded-xlarge border">
              <table className="w-full border-collapse">
                <caption className="sr-only">Pessoas por área e turno</caption>
                <thead>
                  <tr className="h-row-header">
                    {["Área", "Função", "1º T", "2º T", "3º T", "Normal", "Total"].map((h, i) => (
                      <th key={h} scope="col" className={cn("whitespace-nowrap px-150 font-body-small font-medium text-subtlest", i > 1 ? "text-right" : "text-left", i === 0 && "pl-200")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["montagem", "embalagem"] as Area[]).map((area) => {
                    const rows = scenario.processes.filter((p) => p.area === area);
                    const byShift = [0, 1, 2].map((i) => rows.reduce((s, p) => s + p.people[i], 0));
                    return (
                      <tr key={area} className="h-row border-t">
                        <td className="px-150 pl-200 font-medium capitalize text-default">{area}</td>
                        <td className="px-150 text-subtle">
                          Soma dos processos{" "}
                          <button type="button" className="text-link hover:underline" onClick={() => setTab(area)}>
                            (editar)
                          </button>
                        </td>
                        {byShift.map((n, i) => (
                          <td key={i} className="px-150 text-right tabular-nums text-default">
                            {n}
                          </td>
                        ))}
                        <td className="px-150 text-right tabular-nums text-subtlest">–</td>
                        <td className="px-150 text-right font-semibold tabular-nums text-default">{byShift.reduce((a, b) => a + b, 0)}</td>
                      </tr>
                    );
                  })}
                  {scenario.support.map((r, idx) => (
                    <tr key={r.id} className="h-row border-t">
                      <td className="px-150 pl-200 font-medium text-default">{r.area === "apoio" ? "Apoio" : "Injeção"}</td>
                      <td className="whitespace-nowrap px-150 text-default">{r.name}</td>
                      {r.people.map((n, i) => (
                        <td key={i} className="px-150">
                          <NumberField
                            label={`${r.name}: pessoas (${i < 3 ? SHIFT_SHORT[i] : "normal"})`}
                            value={n}
                            max={50}
                            changed={n !== BASELINE.support[idx].people[i]}
                            onChange={(v) => update((s) => (s.support[idx].people[i] = v ?? 0))}
                            compact
                            className="ml-auto w-field-count"
                          />
                        </td>
                      ))}
                      <td className="px-150 text-right font-semibold tabular-nums text-default">{r.people.reduce((a, b) => a + b, 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="h-row border-t bg-surface-sunken">
                    <td className="px-150 pl-200 font-body-small text-subtle" colSpan={2}>
                      Total da seção
                    </td>
                    {totals.peopleByShift.map((n, i) => (
                      <td key={i} className="px-150 text-right font-semibold tabular-nums text-default">
                        {n}
                      </td>
                    ))}
                    <td className="px-150 text-right">
                      <span className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums text-default">{totals.people}</span>
                        <Delta value={totals.people - base.people} />
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </PageBody>
        </div>
        )}

        {/* ---------- Jornada ---------- */}
        {tab === "jornada" && (
          <div>
          <PageBody>
            <div className="flex flex-wrap items-end gap-200">
              <NumberField
                label="Dias úteis no mês"
                showLabel
                value={scenario.workingDays}
                min={1}
                max={31}
                changed={scenario.workingDays !== BASELINE.workingDays}
                onChange={(v) => v != null && update((s) => (s.workingDays = v))}
                className="w-column-name"
              />
              <p className="max-w-search-width font-body-small text-subtle">
                A capacidade no mês é a capacidade por dia × dias úteis. O tempo útil de cada turno entra na capacidade
                técnica de todos os processos.
              </p>
            </div>
            <div className="flex flex-wrap gap-300">
              {scenario.shifts.map((sh, i) => {
                const useful = usefulMinutes(sh);
                const baseUseful = usefulMinutes(BASELINE.shifts[i]);
                const sameAsPrevious = i === 1 && sh.start === scenario.shifts[0].start && sh.end === scenario.shifts[0].end;
                return (
                  <section key={sh.label} aria-label={sh.label} className="flex min-w-0 flex-1 basis-kpi-min flex-col gap-150 rounded-large bg-surface-raised p-250 shadow-raised">
                    <header className="flex flex-wrap items-center justify-between gap-100">
                      <h2 className="font-heading-small text-default">{sh.label}</h2>
                      {sameAsPrevious && <Lozenge appearance="warning">Mesmo horário do 1º turno</Lozenge>}
                    </header>
                    <div className="flex gap-100">
                      <TextField label="Início" type="time" value={sh.start} onChange={(e) => update((s) => (s.shifts[i].start = e.target.value))} className="flex-1" />
                      <TextField label="Fim" type="time" value={sh.end} onChange={(e) => update((s) => (s.shifts[i].end = e.target.value))} className="flex-1" />
                    </div>
                    <NumberField
                      label="Tempo bruto (min)"
                      showLabel
                      value={sh.grossMinutes}
                      max={720}
                      suffix="min"
                      changed={sh.grossMinutes !== BASELINE.shifts[i].grossMinutes}
                      onChange={(v) => v != null && update((s) => (s.shifts[i].grossMinutes = v))}
                    />
                    <div className="flex flex-col gap-100 rounded-medium bg-neutral p-150">
                      <span className="font-body-small font-semibold text-subtle">Descontos</span>
                      {DEDUCTIONS.map((d) => (
                        <div key={d.key} className="flex items-center justify-between gap-100">
                          <span className="text-default">{d.label}</span>
                          <NumberField
                            label={`${d.label} no ${sh.label}`}
                            value={sh[d.key] as number}
                            max={240}
                            suffix="min"
                            changed={sh[d.key] !== BASELINE.shifts[i][d.key]}
                            onChange={(v) => v != null && update((s) => ((s.shifts[i] as unknown as Record<string, number>)[d.key] = v))}
                            className="w-field-rate"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-baseline justify-between gap-100 border-t pt-150">
                      <span className="text-subtle">Tempo útil</span>
                      <span className="flex items-baseline gap-100">
                        <span className="font-metric-small tabular-nums text-default">{useful} min</span>
                        <Delta value={useful - baseUseful} suffix=" min" />
                      </span>
                    </div>
                  </section>
                );
              })}
            </div>
          </PageBody>
        </div>
        )}

      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restaurar os valores da planilha?"
        primary={{
          label: "Restaurar",
          appearance: "danger",
          onClick: () => {
            const previous = scenario;
            setScenario(clone(BASELINE));
            setConfirmReset(false);
            notify("Planilha restaurada", `${changes.length} alterações descartadas.`, "success", {
              label: "Desfazer",
              onClick: () => setScenario(previous),
            });
          },
        }}
      >
        {changes.length === 1 ? "A alteração do cenário volta" : `As ${changes.length} alterações do cenário voltam`} aos valores da planilha (revisão 01).
      </Modal>

    </>
  );
}
