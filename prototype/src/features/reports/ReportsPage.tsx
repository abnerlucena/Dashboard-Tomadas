import { Check, ChevronDown, ClipboardList, Download, FileSpreadsheet, FileText, RotateCcw, Search, Target, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  ALL_ORDERS,
  DATA_END,
  DATA_ORIGIN,
  DATA_START,
  LINES,
  LINE_ACCENT,
  MACHINES,
  MONTH_RANGE,
  SHIFTS,
  SHIFT_META,
  goodQuantity,
  machineById,
  opLabel,
  workingDatesIn,
  type DateRange,
  type Line,
  type Shift,
} from "@/data/machines";
import { cn, formatDecimal, formatNumber, plural, saveFile, type Notify } from "@/lib/utils";
import { reworkRate } from "@/features/machines/insights";
import { DataTable, type Column } from "@/components/data/DataTable";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Lozenge } from "@/components/ui/Lozenge";
import { WegMark } from "@/components/ui/Misc";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Tag } from "@/components/ui/Tag";
import { TextField } from "@/components/ui/TextField";
import { useAccess } from "@/features/access/AccessContext";
import { buildReportPdf, scopedTarget, type ReportType } from "./reportPdf";

const TYPES: Record<ReportType, { title: string; description: string; icon: LucideIcon }> = {
  production: { title: "Produção mensal", description: "Indicadores e resumo por máquina", icon: FileText },
  entries: { title: "Apontamentos detalhados", description: "Todas as OPs, com operador e observação", icon: ClipboardList },
  rework: { title: "Retrabalho", description: "Taxas por máquina e motivos", icon: RotateCcw },
  metas: { title: "Metas e atingimento", description: "Meta por turno, dia e mês contra o realizado", icon: Target },
};
const SECTIONS = ["Indicadores", "Gráficos", "Tabela por máquina", "Observações dos operadores"] as const;

interface Generated {
  id: string;
  name: string;
  period: string;
  format: "PDF" | "XLSX";
  createdAt: Date;
  size: string;
  /** arquivo gerado nesta sessão (os exemplos da lista não têm) */
  file?: { blob: Blob; filename: string };
}
const sizeLabel = (b: Blob) => `${Math.max(1, Math.round(b.size / 1024))} KB`;
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const br = (d: Date) => d.toLocaleDateString("pt-BR");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/** Etapa numerada do formulário: cartão com título e conteúdo */
function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-200 rounded-large bg-surface-raised p-250 shadow-raised">
      <legend className="float-left flex w-full items-start gap-150">
        <span aria-hidden className="flex size-300 shrink-0 items-center justify-center rounded-full bg-brand-bold font-body-small font-semibold text-inverse">
          {n}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-heading-small text-default">{title}</span>
          {hint && <span className="font-body-small text-subtlest">{hint}</span>}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

export function ReportsPage({ notify }: { notify: Notify }) {
  const { session } = useAccess();
  const [type, setType] = useState<ReportType>("production");
  // Padrão: do início do mês do último dado até ele (com o banco, a janela pode ter muitos meses)
  const [range, setRange] = useState<DateRange>({ from: MONTH_RANGE.from < DATA_START ? DATA_START : MONTH_RANGE.from, to: DATA_END });
  const [machines, setMachines] = useState<Set<string>>(new Set(MACHINES.map((m) => m.id)));
  const [shifts, setShifts] = useState<Set<number>>(new Set(SHIFTS));
  const [format, setFormat] = useState<"PDF" | "XLSX">("PDF");
  const [sections, setSections] = useState<Set<string>>(new Set(SECTIONS.slice(0, 3)));
  const [generating, setGenerating] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  // Máquinas: linhas abertas para escolher uma a uma, e busca por nome
  const [openLines, setOpenLines] = useState<Set<Line>>(new Set());
  const [query, setQuery] = useState("");
  // Na demonstração a lista começa com dois relatórios de exemplo; com o banco, vazia
  const [generated, setGenerated] = useState<Generated[]>(DATA_ORIGIN === "backend" ? [] : [
    { id: "g2", name: "Produção mensal · fevereiro", period: "01/02/2026 a 27/02/2026", format: "PDF", createdAt: new Date(2026, 2, 2, 8, 30), size: "412 KB" },
    { id: "g1", name: "Apontamentos detalhados · fevereiro", period: "01/02/2026 a 27/02/2026", format: "XLSX", createdAt: new Date(2026, 2, 2, 8, 31), size: "184 KB" },
  ]);

  const machinesError = machines.size === 0 ? "Escolha pelo menos uma máquina" : null;
  const shiftsError = shifts.size === 0 ? "Escolha pelo menos um turno" : null;
  const hasErrors = !!(machinesError || shiftsError);

  const orders = useMemo(
    () => ALL_ORDERS.filter((o) => o.date >= range.from && o.date < endOfDay(range.to) && machines.has(o.machineId) && shifts.has(o.shift)),
    [range, machines, shifts],
  );
  const produced = goodQuantity(orders);
  const reworkQty = orders.filter((o) => o.rework).reduce((s, o) => s + o.quantity, 0);
  const chosen = MACHINES.filter((m) => machines.has(m.id));
  const workingDays = workingDatesIn(range).length;
  // Meta do recorte: só os turnos escolhidos em que cada máquina trabalha, proporcional aos dias úteis do período
  const target = chosen.reduce((s, m) => s + scopedTarget(m, [...shifts], range), 0);
  const producedWithTarget = goodQuantity(orders.filter((o) => machineById(o.machineId).hasTarget));
  const period = `${br(range.from)} a ${br(range.to)}`;
  const name = `${TYPES[type].title} · ${period}`;

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  const q = query.trim().toLowerCase();
  const lineMachines = (line: Line) => MACHINES.filter((m) => m.line === line);
  const setLine = (line: Line, on: boolean) =>
    setMachines((set) => {
      const next = new Set(set);
      for (const m of lineMachines(line)) {
        if (on) next.add(m.id); else next.delete(m.id);
      }
      return next;
    });

  const generate = async () => {
    if (hasErrors) {
      setShowErrors(true);
      notify("Revise as opções do relatório", "Há campos que precisam de ajuste.", "error");
      return;
    }
    setGenerating(true);
    const filename = `dash-producao-${type}-${iso(range.from)}-a-${iso(range.to)}.${format === "PDF" ? "pdf" : "xlsx"}`;
    try {
      // PDF (jsPDF) ou planilha no padrão do Dash (ExcelJS), os dois carregados sob demanda; o arquivo fica na lista
      const blob =
        format === "PDF"
          ? await buildReportPdf({
              type,
              title: TYPES[type].title,
              period,
              scope: `${machinesSummary} · ${shiftsSummary}`,
              site: "Tomadas & Interruptores · Itajaí",
              orders,
              machines: chosen,
              shifts: [...shifts],
              range,
              workingDays,
              sections,
            })
          : await (await import("./reportXlsx")).buildReportXlsx({
              type,
              title: TYPES[type].title,
              period,
              scope: `${machinesSummary} · ${shiftsSummary}`,
              orders,
              machines: chosen,
              shifts: [...shifts] as Shift[],
              range,
              author: session?.nome,
            });
      setGenerated((g) => [{ id: `g${Date.now()}`, name, period, format, createdAt: new Date(), size: sizeLabel(blob), file: { blob, filename } }, ...g]);
      const result = await saveFile(filename, blob);
      if (result === "saved") notify(format === "PDF" ? "Relatório baixado" : "Planilha baixada", `${filename} · ${sizeLabel(blob)}`);
      else notify("Download cancelado", "O relatório continua na lista abaixo.");
    } catch {
      notify("Não foi possível gerar o relatório", "Tente de novo. Se continuar, avise o suporte.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const columns: Column<Generated>[] = [
    { id: "name", header: "Relatório", className: "min-w-column-name", cell: (g) => <span className="font-medium text-default">{g.name}</span> },
    { id: "period", header: "Período", cell: (g) => <span className="tabular-nums text-subtle">{g.period}</span> },
    { id: "format", header: "Formato", cell: (g) => <Lozenge appearance={g.format === "PDF" ? "information" : "success"}>{g.format === "PDF" ? "PDF" : "Excel"}</Lozenge> },
    { id: "created", header: "Gerado em", cell: (g) => <span className="tabular-nums text-subtle">{dateTime.format(g.createdAt)}</span> },
    { id: "size", header: "Tamanho", align: "end", cell: (g) => <span className="tabular-nums text-subtle">{g.size}</span> },
    {
      id: "action",
      header: "",
      srHeader: "Ações",
      align: "end",
      className: "pr-150",
      cell: (g) => (
        <Button
          appearance="subtle"
          spacing="compact"
          iconBefore={Download}
          onClick={() =>
            g.file
              ? saveFile(g.file.filename, g.file.blob)
              : notify("Relatório de exemplo", "Este item só ilustra a lista. Gere um relatório para baixar o arquivo.")
          }
        >
          Baixar
        </Button>
      ),
    },
  ];

  const allMachines = machines.size === MACHINES.length;
  const machinesSummary = allMachines
    ? "Todas as máquinas"
    : LINES.every((l) => lineMachines(l).every((m) => machines.has(m.id)) || lineMachines(l).every((m) => !machines.has(m.id)))
      ? `Linha ${LINES.filter((l) => lineMachines(l).every((m) => machines.has(m.id))).join(" e ")}`
      : `${machines.size} de ${MACHINES.length} máquinas`;
  const shiftsSummary = shifts.size === 3 ? "todos os turnos" : [...shifts].sort().map((s) => `Turno ${s}`).join(", ");
  const GenerateIcon = format === "PDF" ? FileText : FileSpreadsheet;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Escolha o tipo, o recorte e o formato. A pré-visualização ao lado acompanha as escolhas."
      />
      <PageBody>
        <div className="flex flex-wrap items-start gap-300">
          {/* ---------- Opções, em etapas ---------- */}
          <form
            aria-label="Opções do relatório"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
            className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-300"
          >
            <Step n={1} title="Tipo de relatório">
              <div role="radiogroup" aria-label="Tipo de relatório" className="grid grid-cols-1 gap-100 xs:grid-cols-2">
                {(Object.keys(TYPES) as ReportType[]).map((k) => {
                  const t = TYPES[k];
                  const selected = type === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(k)}
                      className={cn(
                        "ds-pressable flex items-start gap-150 rounded-large border p-200 text-left",
                        selected ? "border-selected bg-selected" : "hover:bg-neutral-subtle-hovered",
                      )}
                    >
                      <t.icon aria-hidden className={cn("mt-025 size-icon-small shrink-0", selected ? "text-icon-selected" : "text-icon-subtle")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-heading-xsmall", selected ? "text-selected" : "text-default")}>{t.title}</span>
                        <span className="mt-025 block font-body-small text-subtle">{t.description}</span>
                      </span>
                      {selected && <Check aria-hidden className="size-icon-small shrink-0 text-icon-selected" />}
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step n={2} title="Recorte" hint="Período, máquinas e turnos que entram no relatório">
              <DateRangePicker
                label="Período"
                variant="field"
                value={range}
                defaultValue={{ from: DATA_START, to: DATA_END }}
                onChange={setRange}
                min={DATA_START}
                max={MONTH_RANGE.to}
                dataEnd={DATA_END}
              />

              {/* Máquinas por linha: marca a linha inteira ou abre para escolher uma a uma */}
              <div role="group" aria-labelledby="machines-label" className="flex flex-col gap-100">
                <div className="flex flex-wrap items-center justify-between gap-100">
                  <span id="machines-label" className="font-body-small font-semibold text-subtle">
                    Máquinas <span className="font-normal text-subtlest">· {machines.size} de {MACHINES.length}</span>
                  </span>
                  <span className="flex gap-050">
                    <Button appearance="subtle" spacing="compact" isDisabled={allMachines} onClick={() => setMachines(new Set(MACHINES.map((m) => m.id)))}>
                      Marcar todas
                    </Button>
                    <Button appearance="subtle" spacing="compact" isDisabled={machines.size === 0} onClick={() => setMachines(new Set())}>
                      Limpar
                    </Button>
                  </span>
                </div>
                <TextField
                  label="Buscar máquina"
                  hideLabel
                  placeholder="Buscar máquina pelo nome"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  elemAfter={<Search aria-hidden className="size-icon-small text-icon-subtle" />}
                />
                <ul className="flex flex-col overflow-hidden rounded-large border">
                  {LINES.map((line) => {
                    const list = lineMachines(line);
                    const shown = q ? list.filter((m) => m.name.toLowerCase().includes(q)) : list;
                    if (q && shown.length === 0) return null;
                    const count = list.filter((m) => machines.has(m.id)).length;
                    const expanded = !!q || openLines.has(line);
                    const panelId = `line-${line}`;
                    return (
                      <li key={line} className="border-b last:border-b-0">
                        <div className="flex items-center gap-100 px-150 py-100">
                          <Checkbox
                            label={`Linha ${line}`}
                            checked={count === list.length}
                            isIndeterminate={count > 0 && count < list.length}
                            onChange={() => setLine(line, count < list.length)}
                          />
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            disabled={!!q}
                            onClick={() => setOpenLines((s) => toggle(s, line))}
                            className="ds-pressable -my-050 flex min-w-0 flex-1 items-center gap-100 rounded-medium px-050 py-050 text-left hover:bg-neutral-subtle-hovered"
                          >
                            <Tag accent={LINE_ACCENT[line]}>{line}</Tag>
                            <span className="flex-1 font-body-small tabular-nums text-subtle">
                              {count === list.length ? `todas as ${list.length}` : `${count} de ${list.length}`}
                            </span>
                            <ChevronDown
                              aria-hidden
                              className={cn("size-icon-small text-icon-subtle transition-transform duration-hover ease-out", expanded && "rotate-180")}
                            />
                          </button>
                        </div>
                        {expanded && (
                          <ul id={panelId} className="flex flex-col border-t bg-surface-sunken py-050">
                            {shown.map((m) => (
                              <li key={m.id}>
                                <label className="flex cursor-pointer items-center gap-100 py-075 pl-500 pr-150 text-default hover:bg-neutral-subtle-hovered">
                                  <Checkbox label={m.name} checked={machines.has(m.id)} onChange={() => setMachines((s) => toggle(s, m.id))} />
                                  <span aria-hidden className="min-w-0">
                                    {m.name}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                  {q && !MACHINES.some((m) => m.name.toLowerCase().includes(q)) && (
                    <li className="px-150 py-150 font-body-small text-subtlest">Nenhuma máquina com “{query.trim()}”.</li>
                  )}
                </ul>
                {showErrors && machinesError && <p className="font-body-small text-danger">{machinesError}</p>}
              </div>

              {/* Turnos: botões de alternar, lado a lado */}
              <div role="group" aria-labelledby="shifts-label" className="flex flex-col gap-100">
                <span id="shifts-label" className="font-body-small font-semibold text-subtle">
                  Turnos
                </span>
                <div className="flex flex-wrap gap-100">
                  {SHIFTS.map((s) => {
                    const on = shifts.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setShifts((set) => toggle(set, s))}
                        className={cn(
                          "ds-pressable flex items-center gap-075 rounded-medium border px-150 py-075",
                          on ? "border-selected bg-selected text-selected" : "text-subtle hover:bg-neutral-subtle-hovered",
                        )}
                      >
                        {on ? <Check aria-hidden className="size-icon-small" /> : <span aria-hidden className="size-icon-small" />}
                        <span className="font-medium">{SHIFT_META[s].label}</span>
                      </button>
                    );
                  })}
                </div>
                {showErrors && shiftsError && <p className="font-body-small text-danger">{shiftsError}</p>}
              </div>
            </Step>

            <Step n={3} title="Formato">
              <SegmentedControl
                label="Formato"
                iconOnly={false}
                size="control"
                value={format}
                onChange={(v) => setFormat(v as "PDF" | "XLSX")}
                options={[
                  { value: "PDF", label: "PDF para imprimir", icon: FileText },
                  { value: "XLSX", label: "Planilha (Excel)", icon: FileSpreadsheet },
                ]}
              />
              {format === "PDF" ? (
                <div role="group" aria-labelledby="sections-label" className="flex flex-col gap-100">
                  <span id="sections-label" className="font-body-small font-semibold text-subtle">
                    Seções incluídas
                  </span>
                  <div className="grid grid-cols-1 gap-100 xs:grid-cols-2">
                    {SECTIONS.map((sec) => (
                      <label key={sec} className="flex items-center gap-100 text-default">
                        <Checkbox label={sec} checked={sections.has(sec)} onChange={() => setSections((s) => toggle(s, sec))} />
                        <span aria-hidden>{sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-body-small text-subtlest">Planilha no padrão do Dash: resumo com gráficos, tabela por máquina, mapa diário e todos os apontamentos.</p>
              )}
            </Step>
          </form>

          {/* ---------- Pré-visualização (fica visível enquanto o formulário rola) ---------- */}
          <section aria-labelledby="preview-title" className="flex min-w-0 flex-1 basis-chart-card-min flex-col gap-150 m:sticky m:top-300">
            <h2 id="preview-title" className="font-heading-small text-default">
              Pré-visualização
            </h2>
            <div className="rounded-xlarge bg-surface-sunken p-300">
              <article className="mx-auto flex max-w-search-width flex-col gap-200 rounded-small bg-surface-raised p-300 shadow-raised">
                <header className="flex items-start justify-between gap-150 border-b pb-150">
                  <div>
                    <p className="font-heading-small text-default">{TYPES[type].title}</p>
                    <p className="mt-025 font-body-small text-subtle">{period} · Tomadas &amp; Interruptores · Itajaí</p>
                  </div>
                  <WegMark className="w-500 text-brand" />
                </header>
                <p className="font-body-small text-subtle">
                  {machinesSummary} · {shiftsSummary} · {plural(orders.length, "apontamento", "apontamentos")}
                </p>
                {format === "PDF" ? (
                  <>
                    {sections.has("Indicadores") && (
                      <dl className="grid grid-cols-3 gap-100">
                        {[
                          ["Produção", formatNumber(produced)],
                          ["Atingimento", target ? `${Math.round((producedWithTarget / target) * 100)}%` : "—"],
                          ["Retrabalho", produced + reworkQty ? `${formatDecimal(reworkRate(reworkQty, produced))}%` : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-medium bg-neutral p-100">
                            <dt className="font-body-small text-subtle">{k}</dt>
                            <dd className="font-heading-small text-default xs:font-metric-small">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {sections.has("Gráficos") && (
                      <div aria-hidden className="flex h-800 items-end gap-050 rounded-medium bg-neutral p-100">
                        {[40, 65, 55, 80, 50, 70, 45, 90, 60, 75].map((h, i) => (
                          <span key={i} className="flex-1 rounded-t-xsmall bg-chart-brand opacity-disabled" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                    )}
                    {sections.has("Tabela por máquina") && (
                      <table className="w-full font-body-small">
                        <tbody>
                          {chosen.slice(0, 4).map((m) => (
                            <tr key={m.id} className="border-t">
                              <td className="py-050 text-default">{m.name}</td>
                              <td className="py-050 text-right tabular-nums text-subtle">
                                {formatNumber(goodQuantity(orders.filter((o) => o.machineId === m.id)))}
                              </td>
                            </tr>
                          ))}
                          {chosen.length > 4 && (
                            <tr className="border-t">
                              <td colSpan={2} className="py-050 text-subtlest">
                                e mais {chosen.length - 4}…
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                    {sections.has("Observações dos operadores") && (
                      <p className="rounded-medium bg-neutral p-100 font-body-small text-subtle">
                        {orders.filter((o) => o.note).length} observações registradas no período
                      </p>
                    )}
                    {sections.size === 0 && <p className="font-body-small text-subtlest">Nenhuma seção selecionada.</p>}
                  </>
                ) : (
                  <div className="scrollbar-thin overflow-x-auto">
                    <table className="w-full font-code">
                      <thead>
                        <tr className="text-left text-subtlest">
                          {["Data", "Máquina", "OP", "Material", "Qtd."].map((h) => (
                            <th key={h} className="pb-050 pr-150 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map((o) => (
                          <tr key={o.id} className="border-t text-default">
                            <td className="py-050 pr-150">{o.date.toLocaleDateString("pt-BR").slice(0, 5)}</td>
                            <td className="max-w-1000 truncate py-050 pr-150">{machineById(o.machineId).name}</td>
                            <td className="py-050 pr-150">{opLabel(o)}</td>
                            <td className="py-050 pr-150">{o.material || "–"}</td>
                            <td className="py-050 text-right">{formatNumber(o.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-100 font-body-small text-subtlest">Mostrando 5 de {orders.length} linhas</p>
                  </div>
                )}
              </article>
            </div>
            {/* Ação junto do resultado: o que vai ser gerado fica logo acima do botão */}
            <div className="flex flex-wrap items-center justify-between gap-150">
              <p className="min-w-0 font-body-small text-subtle">
                {hasErrors ? (
                  <span className="text-danger">{machinesError ?? shiftsError}</span>
                ) : (
                  <>
                    <span className="font-semibold text-default">{plural(orders.length, "apontamento", "apontamentos")}</span> · {format === "PDF" ? `${sections.size} seções` : "resumo com gráficos, máquinas, diário e apontamentos"}
                  </>
                )}
              </p>
              <Button appearance="primary" iconBefore={GenerateIcon} isLoading={generating} onClick={generate}>
                {format === "PDF" ? "Gerar PDF" : "Baixar planilha"}
              </Button>
            </div>
          </section>
        </div>

        <section aria-labelledby="generated" className="flex flex-col gap-150">
          <h2 id="generated" className="font-heading-small text-default">
            Relatórios gerados
          </h2>
          <DataTable
            caption="Relatórios gerados"
            columns={columns}
            rows={generated}
            getRowId={(g) => g.id}
            getRowLabel={(g) => g.name}
            selectable={false}
            footerLead={plural(generated.length, "relatório", "relatórios")}
          />
        </section>
      </PageBody>
    </>
  );
}
