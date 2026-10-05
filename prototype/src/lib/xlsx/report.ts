import type { Borders, Cell, Workbook, Worksheet } from "exceljs";
import type { Status } from "@/data/machines";
import { COLOR, NUM, STATUS_BREAKS, STATUS_COLOR, XLSX_FONT } from "./theme";

/*
 * Padrão das planilhas do Dash. Toda exportação monta o arquivo por aqui, para
 * todas saírem iguais:
 *
 * - faixa de título azul WEG em toda aba, com o período e os filtros embaixo;
 * - aba "Resumo" primeiro: quadro de informações (período, filtros, quem gerou,
 *   de onde vêm os dados), cartões de indicadores, gráficos e notas;
 * - abas de tabela: cabeçalho fixo e com filtro, linhas zebradas, números no
 *   formato do Excel (somam e filtram), situação colorida como na tela, barra de
 *   dados na coluna principal e linha de totais com SUBTOTAL (respeita o filtro);
 * - abas de matriz (mapa de calor): dia × máquina, com escala de cor;
 * - impressão em paisagem, uma página de largura, rodapé com página.
 *
 * O ExcelJS é carregado só na hora de exportar (não pesa na abertura do site).
 */

export type CellValue = string | number | Date | null | undefined | { formula: string; result?: number | string };
export type Format = keyof typeof NUM | "text";

export interface ReportMeta {
  /** "Dashboard de produção" */
  title: string;
  /** "Setembro de 2026" */
  period: string;
  /** Filtros aplicados, para quem abrir saber o recorte */
  filters?: Array<[string, string]>;
  author?: string;
  /** "Dados do banco" ou "Demonstração (dados fictícios)" */
  source: string;
}

export interface Kpi {
  label: string;
  value: number | string;
  format?: Format;
  /** linha de baixo do cartão */
  note?: string;
  status?: Status | null;
}

export interface Column<T> {
  header: string;
  value: (row: T) => CellValue;
  format?: Format;
  width?: number;
  /** total da coluna: soma ou média (respeitam o filtro do Excel) ou fórmula própria com {col:Letra} */
  total?: "sum" | "avg" | ((ref: (header: string) => string, first: number, last: number) => string);
  /** colore a célula como o lozenge da tela */
  status?: (row: T) => Status | null;
  /** barra de dados (conditional formatting) */
  dataBar?: boolean;
  /** percentual colorido pelas faixas de atingimento */
  attainment?: boolean;
  wrap?: boolean;
}

export interface TableOptions<T> {
  title: string;
  description?: string;
  columns: Column<T>[];
  rows: T[];
  totals?: boolean;
  /** cor da aba */
  tab?: string;
  /** colunas fixas à esquerda (além do cabeçalho) */
  freezeColumns?: number;
}

export interface MatrixOptions {
  title: string;
  description?: string;
  corner: string;
  columns: string[];
  rows: Array<{ label: string; values: Array<number | null>; sub?: string }>;
  format?: Format;
  /** "scale": branco → azul (volume); "attainment": vermelho → verde (fração da meta) */
  color: "scale" | "attainment";
  totals?: boolean;
}

const THIN = (argb: string) => ({ style: "thin" as const, color: { argb } });
const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const fmt = (f: Format | undefined) => (f && f !== "text" ? NUM[f] : undefined);

/** "A", "B"… "AA" */
export const colLetter = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/** Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\ */
const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

export class Report {
  readonly wb: Workbook;
  private readonly meta: ReportMeta;
  private summary: Worksheet | null = null;
  private summaryRow = 0;

  constructor(ExcelJS: typeof import("exceljs"), meta: ReportMeta) {
    this.wb = new ExcelJS.Workbook();
    this.wb.creator = meta.author || "Dash de Produção";
    this.wb.created = new Date();
    this.wb.title = `${meta.title} · ${meta.period}`;
    this.meta = meta;
  }

  /* ---------- Estrutura comum a todas as abas ---------- */

  private sheet(name: string, width: number, tab = COLOR.brand) {
    const ws = this.wb.addWorksheet(sheetName(name), {
      properties: { tabColor: { argb: tab }, defaultRowHeight: 18 },
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: "landscape",
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
      },
      headerFooter: {
        oddFooter: `&L&8Dash de Produção · WEG Tomadas & Interruptores, Itajaí&C&8${this.meta.title} · ${this.meta.period}&R&8Página &P de &N`,
      },
    });
    // Faixa de título (linha 1) e linha de contexto (linha 2)
    ws.mergeCells(1, 1, 1, width);
    const t = ws.getCell(1, 1);
    t.value = name === "Resumo" ? this.meta.title : `${this.meta.title} · ${name}`;
    t.font = { name: XLSX_FONT, size: 16, bold: true, color: { argb: COLOR.white } };
    t.fill = solid(COLOR.brand);
    t.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, width);
    const s = ws.getCell(2, 1);
    const filters = (this.meta.filters ?? []).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    s.value = [this.meta.period, ...filters, this.meta.source].join("   ·   ");
    s.font = { name: XLSX_FONT, size: 10, color: { argb: COLOR.white } };
    s.fill = solid(COLOR.brandDark);
    s.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(2).height = 20;
    return ws;
  }

  private style(
    c: Cell,
    opts: {
      size?: number;
      bold?: boolean;
      color?: string;
      fill?: string;
      format?: Format;
      align?: "left" | "right" | "center";
      wrap?: boolean;
      italic?: boolean;
    },
  ) {
    c.font = { name: XLSX_FONT, size: opts.size ?? 10, bold: opts.bold, italic: opts.italic, color: { argb: opts.color ?? COLOR.text } };
    if (opts.fill) c.fill = solid(opts.fill);
    const f = fmt(opts.format);
    if (f) c.numFmt = f;
    c.alignment = { vertical: "middle", horizontal: opts.align, wrapText: opts.wrap };
  }

  /* ---------- Aba Resumo ---------- */

  /** Quadro de informações e cartões de indicadores; gráficos e notas vêm depois */
  addSummary(kpis: Kpi[], info: Array<[string, string]> = []) {
    const perRow = 4;
    const width = perRow * 3; // cada cartão ocupa 3 colunas
    const ws = this.sheet("Resumo", width);
    ws.columns = Array.from({ length: width }, () => ({ width: 13 }));
    let r = 4;

    // Quadro de informações
    const rowsInfo: Array<[string, string]> = [
      ["Período", this.meta.period],
      ...(this.meta.filters ?? []).filter(([, v]) => v),
      ...info,
      ["Origem dos dados", this.meta.source],
      ["Gerado em", new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })],
      ...(this.meta.author ? ([["Gerado por", this.meta.author]] as Array<[string, string]>) : []),
    ];
    for (const [k, v] of rowsInfo) {
      ws.mergeCells(r, 1, r, 3);
      ws.mergeCells(r, 4, r, width);
      this.style(ws.getCell(r, 1), { bold: true, color: COLOR.subtle, fill: COLOR.zebra });
      ws.getCell(r, 1).value = k;
      this.style(ws.getCell(r, 4), {});
      ws.getCell(r, 4).value = v;
      ws.getCell(r, 4).border = { bottom: THIN(COLOR.border) };
      ws.getCell(r, 1).border = { bottom: THIN(COLOR.border) };
      r++;
    }
    r++;

    // Cartões: rótulo, valor grande e nota; borda à esquerda na cor da situação
    for (let i = 0; i < kpis.length; i += perRow) {
      kpis.slice(i, i + perRow).forEach((k, j) => {
        const c1 = j * 3 + 1;
        const c2 = c1 + 2;
        const accent = k.status ? STATUS_COLOR[k.status].bold : COLOR.brand;
        const fill = COLOR.zebra;
        [r, r + 1, r + 2].forEach((row) => ws.mergeCells(row, c1, row, c2));
        const label = ws.getCell(r, c1);
        label.value = k.label.toUpperCase();
        this.style(label, { size: 8, bold: true, color: COLOR.subtle, fill });
        const value = ws.getCell(r + 1, c1);
        value.value = k.value;
        this.style(value, {
          size: 20,
          bold: true,
          color: k.status ? STATUS_COLOR[k.status].text : COLOR.text,
          fill,
          format: k.format,
          align: "left",
        });
        const note = ws.getCell(r + 2, c1);
        note.value = k.note ?? "";
        this.style(note, { size: 9, color: k.status ? STATUS_COLOR[k.status].text : COLOR.subtle, fill, wrap: true });
        for (const row of [r, r + 1, r + 2]) {
          ws.getCell(row, c1).border = { left: { style: "thick", color: { argb: accent } } };
        }
      });
      ws.getRow(r).height = 18;
      ws.getRow(r + 1).height = 32;
      ws.getRow(r + 2).height = 30;
      r += 4;
    }
    this.summary = ws;
    this.summaryRow = r;
    return this;
  }

  /** Gráfico (PNG) na aba Resumo, dois por linha; `wide` ocupa a linha inteira */
  private chartCol = 0;
  /** linhas ocupadas pela fileira de gráficos atual */
  private chartRows = 0;
  private chartsAdded = 0;
  addChart(title: string, image: { png: string; width: number; height: number }, opts: { wide?: boolean } = {}) {
    const ws = this.summary;
    if (!ws) throw new Error("addSummary antes de addChart");
    const cols = opts.wide ? 12 : 6;
    // Fileira nova de gráficos começa em página nova (impressão), menos a primeira
    // Impressão: os gráficos começam na página 2 (a 1 é do quadro e dos cartões), duas fileiras por página
    if (this.chartCol === 0 && this.chartsAdded++ % 2 === 0) ws.getRow(this.summaryRow - 1).addPageBreak();
    if (this.chartCol + cols > 12) {
      this.chartCol = 0;
      this.summaryRow += this.chartRows;
      this.chartRows = 0;
    }
    const c = this.chartCol + 1;
    ws.mergeCells(this.summaryRow, c, this.summaryRow, c + cols - 1);
    const t = ws.getCell(this.summaryRow, c);
    t.value = title;
    this.style(t, { size: 11, bold: true, color: COLOR.brandDark });
    t.border = { bottom: { style: "medium", color: { argb: COLOR.brand } } };
    const id = this.wb.addImage({ base64: image.png, extension: "png" });
    // Mantém a proporção do desenho; a altura vira linhas (18 px cada) para o próximo gráfico não sobrepor
    const w = cols * 92 - 14;
    const h = Math.round((w * image.height) / image.width);
    ws.addImage(id, { tl: { col: c - 1 + 0.1, row: this.summaryRow + 0.2 }, ext: { width: w, height: h } });
    this.chartRows = Math.max(this.chartRows, Math.ceil(h / 20) + 2);
    this.chartCol += cols;
    if (this.chartCol >= 12) {
      this.chartCol = 0;
      this.summaryRow += this.chartRows;
      this.chartRows = 0;
    }
    return this;
  }

  /** Notas no pé do Resumo: o que significa cada número */
  addNotes(notes: string[]) {
    const ws = this.summary;
    if (!ws) return this;
    let r = this.summaryRow + (this.chartCol ? this.chartRows : 0) + 1;
    ws.getRow(r - 1).addPageBreak();
    ws.mergeCells(r, 1, r, 12);
    this.style(ws.getCell(r, 1), { bold: true, size: 11, color: COLOR.brandDark });
    ws.getCell(r, 1).value = "Como ler";
    ws.getCell(r, 1).border = { bottom: { style: "medium", color: { argb: COLOR.brand } } };
    for (const n of notes) {
      r++;
      ws.mergeCells(r, 1, r, 12);
      ws.getCell(r, 1).value = `•  ${n}`;
      this.style(ws.getCell(r, 1), { color: COLOR.subtle, wrap: true });
      ws.getRow(r).height = n.length > 140 ? 30 : 18;
    }
    return this;
  }

  /* ---------- Aba de tabela ---------- */

  addTable<T>(name: string, o: TableOptions<T>) {
    const n = o.columns.length;
    const ws = this.sheet(name, n, o.tab);
    let r = 3;
    if (o.description) {
      ws.mergeCells(r, 1, r, n);
      ws.getCell(r, 1).value = o.description;
      this.style(ws.getCell(r, 1), { italic: true, color: COLOR.subtle, wrap: true });
      ws.getRow(r).height = o.description.length > 160 ? 30 : 20;
      r++;
    }
    r++;
    const head = r;
    const border: Partial<Borders> = { bottom: THIN(COLOR.border) };

    // Cabeçalho
    o.columns.forEach((c, i) => {
      const cell = ws.getCell(head, i + 1);
      cell.value = c.header;
      this.style(cell, {
        bold: true,
        color: COLOR.white,
        fill: COLOR.brand,
        wrap: true,
        align: c.format && c.format !== "text" ? "right" : "left",
      });
      cell.border = { bottom: { style: "medium", color: { argb: COLOR.brandDark } } };
    });
    ws.getRow(head).height = 32;

    // Linhas
    o.rows.forEach((row, i) => {
      const rr = head + 1 + i;
      const zebra = i % 2 ? COLOR.zebra : undefined;
      o.columns.forEach((c, j) => {
        const cell = ws.getCell(rr, j + 1);
        const v = c.value(row);
        cell.value = v === undefined ? null : (v as Cell["value"]);
        const st = c.status?.(row) ?? null;
        this.style(cell, {
          format: c.format,
          fill: st ? STATUS_COLOR[st].fill : zebra,
          color: st ? STATUS_COLOR[st].text : COLOR.text,
          bold: !!st,
          align: c.format && c.format !== "text" ? "right" : st ? "center" : "left",
          wrap: c.wrap,
        });
        cell.border = border;
      });
    });
    const first = head + 1;
    const last = head + Math.max(o.rows.length, 1);

    // Largura: a informada ou pelo conteúdo (com teto)
    o.columns.forEach((c, j) => {
      const longest = Math.max(
        c.header.length * 0.9,
        ...o.rows.slice(0, 300).map((row) => {
          const v = c.value(row);
          return v instanceof Date ? 11 : typeof v === "number" ? String(Math.round(v)).length * 1.35 + 2 : String(v ?? "").length;
        }),
      );
      ws.getColumn(j + 1).width = c.width ?? Math.min(48, Math.max(9, longest + 3));
    });

    // Formatação condicional: barras e faixas de atingimento (seguem valendo se alguém editar)
    o.columns.forEach((c, j) => {
      const ref = `${colLetter(j + 1)}${first}:${colLetter(j + 1)}${last}`;
      if (c.dataBar && o.rows.length > 1)
        ws.addConditionalFormatting({
          ref,
          rules: [
            { type: "dataBar", priority: 1, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: "FF7DB6E8" } } as never,
          ],
        });
      if (c.attainment)
        ws.addConditionalFormatting({
          ref,
          rules: (
            [
              ["lessThan", [STATUS_BREAKS.attention], "critical"],
              ["between", [STATUS_BREAKS.attention, STATUS_BREAKS.near - 0.0001], "attention"],
              ["between", [STATUS_BREAKS.near, STATUS_BREAKS.achieved - 0.0001], "near"],
              ["greaterThanOrEqual", [STATUS_BREAKS.achieved], "achieved"],
            ] as const
          ).map(([operator, formulae, st], k) => ({
            type: "cellIs" as const,
            operator: operator as "lessThan",
            formulae: [...formulae],
            priority: 2 + k,
            style: { font: { color: { argb: STATUS_COLOR[st].text }, bold: true } },
          })),
        });
    });

    // Totais (SUBTOTAL ignora as linhas escondidas pelo filtro)
    if (o.totals && o.rows.length) {
      const tr = last + 1;
      const ref = (header: string) => colLetter(o.columns.findIndex((c) => c.header === header) + 1);
      o.columns.forEach((c, j) => {
        const cell = ws.getCell(tr, j + 1);
        const L = colLetter(j + 1);
        if (j === 0) cell.value = "Total (linhas visíveis)";
        else if (c.total === "sum") cell.value = { formula: `SUBTOTAL(109,${L}${first}:${L}${last})` };
        else if (c.total === "avg") cell.value = { formula: `SUBTOTAL(101,${L}${first}:${L}${last})` };
        else if (typeof c.total === "function") cell.value = { formula: c.total(ref, first, last) };
        this.style(cell, { bold: true, fill: COLOR.totalFill, format: j === 0 ? undefined : c.format, align: j === 0 ? "left" : "right" });
        cell.border = { top: { style: "medium", color: { argb: COLOR.brand } }, bottom: { style: "medium", color: { argb: COLOR.brand } } };
      });
    }

    ws.autoFilter = { from: { row: head, column: 1 }, to: { row: head, column: n } };
    ws.views = [{ state: "frozen", xSplit: o.freezeColumns ?? 1, ySplit: head, showGridLines: false }];
    ws.pageSetup.printTitlesRow = `${head}:${head}`;
    return this;
  }

  /* ---------- Aba de matriz (mapa de calor) ---------- */

  addMatrix(name: string, o: MatrixOptions) {
    const n = o.columns.length + 2 + (o.totals ? 1 : 0);
    const ws = this.sheet(name, n);
    let r = 3;
    if (o.description) {
      ws.mergeCells(r, 1, r, n);
      ws.getCell(r, 1).value = o.description;
      this.style(ws.getCell(r, 1), { italic: true, color: COLOR.subtle, wrap: true });
      r++;
    }
    r++;
    const head = r;
    const headers = [o.corner, ...o.columns, ...(o.totals ? [o.color === "attainment" ? "Média" : "Total"] : [])];
    headers.forEach((h, i) => {
      const c = ws.getCell(head, i + 1);
      c.value = h;
      this.style(c, { bold: true, color: COLOR.white, fill: COLOR.brand, align: i ? "center" : "left", size: 9 });
    });
    ws.getRow(head).height = 26;
    o.rows.forEach((row, i) => {
      const rr = head + 1 + i;
      const label = ws.getCell(rr, 1);
      label.value = row.label;
      this.style(label, { bold: true, fill: i % 2 ? COLOR.zebra : undefined });
      label.border = { right: THIN(COLOR.borderStrong) };
      row.values.forEach((v, j) => {
        const c = ws.getCell(rr, j + 2);
        c.value = v;
        this.style(c, { format: o.format, align: "center", size: 9, color: v == null ? COLOR.subtlest : COLOR.text });
        c.border = { right: THIN(COLOR.white), bottom: THIN(COLOR.white) };
      });
      if (o.totals) {
        const L1 = colLetter(2);
        const L2 = colLetter(o.columns.length + 1);
        const c = ws.getCell(rr, o.columns.length + 2);
        c.value = { formula: o.color === "attainment" ? `IFERROR(AVERAGE(${L1}${rr}:${L2}${rr}),"")` : `SUM(${L1}${rr}:${L2}${rr})` };
        this.style(c, { bold: true, format: o.format, fill: COLOR.totalFill, align: "right" });
      }
    });
    const last = head + o.rows.length;
    const ref = `${colLetter(2)}${head + 1}:${colLetter(o.columns.length + 1)}${last}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        o.color === "attainment"
          ? ({
              type: "colorScale",
              priority: 1,
              cfvo: [
                { type: "num", value: 0.5 },
                { type: "num", value: 0.85 },
                { type: "num", value: 1.05 },
              ],
              color: [{ argb: "FFF4A6A6" }, { argb: "FFFFE08A" }, { argb: "FF9CD8B1" }],
            } as never)
          : ({
              type: "colorScale",
              priority: 1,
              cfvo: [{ type: "min" }, { type: "max" }],
              color: [{ argb: "FFF6F8FA" }, { argb: "FF5FA3E0" }],
            } as never),
      ],
    });
    if (o.totals && o.rows.length) {
      const tr = last + 1;
      const c0 = ws.getCell(tr, 1);
      c0.value = o.color === "attainment" ? "Média" : "Total";
      this.style(c0, { bold: true, fill: COLOR.totalFill });
      for (let j = 2; j <= o.columns.length + 2; j++) {
        const L = colLetter(j);
        const c = ws.getCell(tr, j);
        c.value = {
          formula: o.color === "attainment" ? `IFERROR(AVERAGE(${L}${head + 1}:${L}${last}),"")` : `SUM(${L}${head + 1}:${L}${last})`,
        };
        this.style(c, { bold: true, format: o.format, fill: COLOR.totalFill, align: "center", size: 9 });
        c.border = { top: { style: "medium", color: { argb: COLOR.brand } } };
      }
    }
    ws.getColumn(1).width = 34;
    for (let j = 2; j <= n; j++) ws.getColumn(j).width = o.color === "attainment" ? 7 : 9;
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: head, showGridLines: false }];
    return this;
  }

  async toBlob() {
    const buf = await this.wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

/** Carrega o ExcelJS sob demanda */
export async function loadExcel(): Promise<typeof import("exceljs")> {
  const m = (await import("exceljs")) as unknown as { default?: typeof import("exceljs") } & typeof import("exceljs");
  return m.default ?? m;
}
