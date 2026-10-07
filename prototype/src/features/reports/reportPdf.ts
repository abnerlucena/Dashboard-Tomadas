import {
  LINES,
  REWORK_REASONS,
  WORKING_DAYS,
  goodQuantity,
  machineById,
  statusFor,
  STATUS_META,
  workingDatesIn,
  type DateRange,
  type Machine,
  type ProductionOrder,
} from "@/data/machines";
import { formatDecimal, formatNumber } from "@/lib/utils";
import { reworkRate } from "@/features/machines/insights";

/*
 * PDF dos relatórios, gerado no navegador com jsPDF + autotable.
 * As bibliotecas só baixam quando o primeiro PDF é gerado (import dinâmico).
 * Cores: lidas dos tokens do tema CLARO (papel branco), mesmo com a tela no escuro.
 */

export type ReportType = "production" | "entries" | "rework" | "metas";
export type ReportSection = "Indicadores" | "Gráficos" | "Tabela por máquina" | "Observações dos operadores";

export interface ReportInput {
  type: ReportType;
  title: string;
  /** "01/03/2026 a 27/03/2026" */
  period: string;
  /** "Todas as máquinas · todos os turnos" */
  scope: string;
  site: string;
  orders: ProductionOrder[];
  machines: Machine[];
  /** turnos escolhidos (meta proporcional) */
  shifts: number[];
  /** período escolhido (meta do recorte) */
  range: DateRange;
  /** dias úteis do período (linha de meta diária) */
  workingDays: number;
  sections: Set<string>;
}

type Rgb = [number, number, number];

/** Cor de um token no tema claro, já opaca (misturada ao branco quando tem transparência) */
function tokenColor(name: string): Rgb {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-color-mode", "light");
  wrap.style.display = "none";
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  wrap.appendChild(probe);
  document.body.appendChild(wrap);
  const [r, g, b, a = 1] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
  wrap.remove();
  const mix = (c: number) => Math.round(c * a + 255 * (1 - a));
  return [mix(r), mix(g), mix(b)];
}

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);
const pct = (v: number) => `${Math.round(v)}%`;
/** Taxa de retrabalho: uma casa decimal, como nas telas */
const reworkPct = (rework: number, good: number) => (rework + good ? `${formatDecimal(reworkRate(rework, good))}%` : "—");
const dayMonth = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Meta de cada máquina no recorte, só nos turnos escolhidos. Com o banco, a soma
 * das metas efetivas dos turnos apontados (nunca meta × turnos × dias). Na
 * demonstração, a meta do mês proporcional aos turnos em que o centro trabalha
 * (um centro de 2 turnos não tem meta no Turno 3) e aos dias úteis do período.
 */
export function scopedTarget(m: Machine, shifts: number[], range: DateRange) {
  if (!m.hasTarget) return 0;
  if (m.backend)
    return Math.round(
      m.backend.targets.reduce((s, e) => s + (shifts.includes(e.shift) && e.date >= range.from && e.date <= range.to ? e.target : 0), 0),
    );
  const share = workingDatesIn(range).length / Math.max(1, WORKING_DAYS);
  return Math.round((m.target / m.regime) * shifts.filter((s) => s <= m.regime).length * share);
}

export async function buildReportPdf(input: ReportInput): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14; // margem
  const C = {
    brand: tokenColor("--ds-chart-brand"),
    text: tokenColor("--ds-text"),
    subtle: tokenColor("--ds-text-subtle"),
    subtlest: tokenColor("--ds-text-subtlest"),
    border: tokenColor("--ds-border"),
    neutral: tokenColor("--ds-background-neutral"),
    target: tokenColor("--ds-chart-target"),
    danger: tokenColor("--ds-background-danger-bold"),
    surface: tokenColor("--ds-surface"),
  };
  const { orders, machines, sections } = input;
  // Produção = só a boa (D11); o retrabalho tem conta própria
  const produced = goodQuantity(orders);
  const reworkQty = sum(
    orders.filter((o) => o.rework),
    (o) => o.quantity,
  );
  const target = sum(machines, (m) => scopedTarget(m, input.shifts, input.range));
  // Atingimento só com as máquinas que têm meta (as "por demanda" produzem, mas não entram na conta)
  const withTarget = new Set(machines.filter((m) => m.hasTarget).map((m) => m.id));
  const producedWithTarget = goodQuantity(orders.filter((o) => withTarget.has(o.machineId)));
  let y = 0;

  /* ---------- Cabeçalho ---------- */
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, W, 2, "F");
  doc.setTextColor(...C.text);
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(input.title, M, 16);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.subtle);
  doc.text(`${input.period} · ${input.site}`, M, 22);
  doc.text(`${input.scope} · ${formatNumber(orders.length)} apontamentos`, M, 27);
  doc.setDrawColor(...C.border);
  doc.line(M, 31, W - M, 31);
  y = 38;

  const heading = (text: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...C.text);
    doc.text(text, M, y);
    y += 4;
  };
  /** `right`: índices das colunas numéricas (alinhadas à direita) */
  const table = (head: string[], body: (string | number)[][], right: number[] = []) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map(String)),
      margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, textColor: C.text, lineColor: C.border, lineWidth: 0.1 },
      headStyles: { fillColor: C.neutral, textColor: C.subtle, fontStyle: "bold" },
      bodyStyles: { fillColor: C.surface },
      alternateRowStyles: { fillColor: C.surface },
      columnStyles: Object.fromEntries(head.map((_, i) => [i, { halign: right.includes(i) ? "right" : "left" }])),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  /* ---------- Indicadores ---------- */
  if (sections.has("Indicadores")) {
    const kpis: Array<[string, string]> = [
      ["Produção", formatNumber(produced)],
      ["Atingimento", target ? pct((producedWithTarget / target) * 100) : "—"],
      ["Retrabalho", reworkPct(reworkQty, produced)],
      ["Observações", formatNumber(orders.filter((o) => o.note).length)],
    ];
    const gap = 4;
    const bw = (W - 2 * M - gap * (kpis.length - 1)) / kpis.length;
    kpis.forEach(([label, value], i) => {
      const x = M + i * (bw + gap);
      doc.setFillColor(...C.neutral);
      doc.roundedRect(x, y, bw, 18, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.subtle);
      doc.text(label, x + 3, y + 6);
      doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...C.text);
      doc.text(value, x + 3, y + 14);
    });
    y += 26;
  }

  /* ---------- Gráfico: produção por dia, com a meta diária ---------- */
  if (sections.has("Gráficos")) {
    const byDay = new Map<string, { date: Date; qty: number; rw: number }>();
    for (const o of orders) {
      // com a linha de meta, as barras são só das máquinas com meta (mesma base da meta diária)
      if (input.type !== "rework" && !withTarget.has(o.machineId)) continue;
      const k = o.date.toDateString();
      const e = byDay.get(k) ?? { date: o.date, qty: 0, rw: 0 };
      if (o.rework) e.rw += o.quantity;
      else e.qty += o.quantity;
      byDay.set(k, e);
    }
    const days = [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    const daily = input.workingDays ? target / input.workingDays : 0;
    heading(input.type === "rework" ? "Retrabalho por dia (peças)" : "Produção por dia · máquinas com meta");
    const h = 48;
    const top = y + 2;
    const values = days.map((d) => (input.type === "rework" ? d.rw : d.qty));
    const max = Math.max(1, ...values, input.type === "rework" ? 0 : daily) * 1.1;
    const plotW = W - 2 * M;
    const step = days.length ? plotW / days.length : plotW;
    doc.setDrawColor(...C.border);
    doc.line(M, top + h, W - M, top + h);
    days.forEach((d, i) => {
      const v = values[i];
      const bh = (v / max) * h;
      doc.setFillColor(...(input.type === "rework" ? C.danger : C.brand));
      doc.rect(M + i * step + step * 0.15, top + h - bh, step * 0.7, bh, "F");
      if (days.length <= 31 && i % Math.ceil(days.length / 11) === 0) {
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...C.subtlest);
        doc.text(dayMonth(d.date), M + i * step + step / 2, top + h + 4, { align: "center" });
      }
    });
    if (input.type !== "rework" && daily) {
      const ty = top + h - (daily / max) * h;
      doc.setDrawColor(...C.target);
      doc.setLineDashPattern([1.5, 1], 0);
      doc.line(M, ty, W - M, ty);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7).setTextColor(...C.subtle);
      doc.text(`Meta diária ${formatNumber(Math.round(daily))}`, W - M, ty - 1.5, { align: "right" });
    }
    y = top + h + 12;
  }

  /* ---------- Tabela principal (depende do tipo) ---------- */
  if (sections.has("Tabela por máquina") || input.type === "entries") {
    const ofMachine = (m: Machine) => orders.filter((o) => o.machineId === m.id);
    const ordered = [...machines].sort((a, b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || sum(ofMachine(b), (o) => o.quantity) - sum(ofMachine(a), (o) => o.quantity));
    if (input.type === "entries") {
      heading("Apontamentos");
      table(
        ["Data", "Máquina", "Turno", "OP", "Material", "Descrição", "Qtd.", "Retrab.", "Operador"],
        [...orders]
          .sort((a, b) => a.date.getTime() - b.date.getTime() || a.shift - b.shift)
          .map((o) => [
            dayMonth(o.date),
            machineById(o.machineId).name,
            // o cabeçalho já diz "Turno": só o número, sem quebrar a linha
            String(o.shift),
            o.opId.replace("OP ", ""),
            o.material,
            o.product,
            formatNumber(o.quantity),
            o.rework ? "Sim" : "",
            o.operator,
          ]),
        [6],
      );
    } else if (input.type === "rework") {
      heading("Retrabalho por máquina");
      table(
        ["Máquina", "Linha", "Produção", "Retrabalho", "Taxa", "Principal motivo"],
        ordered.map((m) => {
          const list = ofMachine(m);
          const total = goodQuantity(list);
          const rw = list.filter((o) => o.rework);
          const reasons = REWORK_REASONS.map((r) => ({ r, n: rw.filter((o) => o.reworkReason === r).length })).sort((a, b) => b.n - a.n);
          return [m.name, m.line, formatNumber(total), formatNumber(sum(rw, (o) => o.quantity)), reworkPct(sum(rw, (o) => o.quantity), total), reasons[0]?.n ? reasons[0].r : "—"];
        }),
        [2, 3, 4],
      );
      heading("Motivos");
      const rwOrders = orders.filter((o) => o.rework);
      table(
        ["Motivo", "Ocorrências", "% do total"],
        REWORK_REASONS.map((r) => ({ r, n: rwOrders.filter((o) => o.reworkReason === r).length }))
          .filter((x) => x.n)
          .sort((a, b) => b.n - a.n)
          .map((x) => [x.r, x.n, pct((x.n / rwOrders.length) * 100)]),
        [1, 2],
      );
    } else {
      heading(input.type === "metas" ? "Meta e realizado por máquina" : "Produção por máquina");
      table(
        ["Máquina", "Linha", "Dias", "Produção", "Meta", "Atingimento"],
        ordered.map((m) => {
          const list = ofMachine(m);
          const total = goodQuantity(list);
          const t = scopedTarget(m, input.shifts, input.range);
          const p = t ? Math.round((total / t) * 100) : null;
          return [
            m.name,
            m.hasTarget ? m.line : `${m.line} · por demanda`,
            new Set(list.map((o) => o.date.toDateString())).size,
            formatNumber(total),
            t ? formatNumber(t) : "—",
            p == null ? "—" : `${p}% · ${STATUS_META[statusFor(p)].label}`,
          ];
        }),
        [2, 3, 4],
      );
    }
  }

  /* ---------- Observações dos operadores ---------- */
  if (sections.has("Observações dos operadores")) {
    const notes = orders.filter((o) => o.note).sort((a, b) => a.date.getTime() - b.date.getTime());
    heading(`Observações dos operadores (${notes.length})`);
    table(
      ["Data", "Máquina", "Turno", "Operador", "Observação"],
      notes.map((o) => [dayMonth(o.date), machineById(o.machineId).name, String(o.shift), o.note!.author, o.note!.text]),
    );
  }

  /* ---------- Rodapé em todas as páginas ---------- */
  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...C.subtlest);
    doc.text(`Dash de Produção · gerado em ${stamp}`, M, H - 8);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 8, { align: "right" });
  }

  return doc.output("blob");
}
