import { useCallback, useMemo } from "react";
import { STATUS_META, type Machine, type plantSeries } from "@/data/machines";
import { formatCompact, formatLongDate, formatNumber, formatShortDate, readToken } from "@/lib/utils";
import { EChart } from "./EChart";
import { axisStyle, baseOption, tooltipBase, tooltipHtml, tooltipText, useChartTheme, type TooltipRow } from "./chartTheme";

/*
 * Gráficos do Dash em Apache ECharts. Este módulo é carregado sob demanda
 * (ver index.tsx): o ECharts só baixa quando um gráfico aparece.
 */

type Point = ReturnType<typeof plantSeries>[number];

/** Calha do eixo Y à esquerda, como nos demais gráficos do app */
function grid(top: string, right: string) {
  return {
    top: readToken(top),
    right: readToken(right),
    bottom: readToken("--ds-space-400"),
    left: readToken("--dash-size-chart-axis"),
  };
}

const lastIndex = <T,>(list: T[], has: (x: T) => boolean) => list.reduce((idx, x, i) => (has(x) ? i : idx), -1);

/* ---------- Acumulado vs meta (burn-up) ---------- */
export interface BurnupChartProps {
  series: Point[];
  label: string;
  /** altura (token); o Modo TV usa h-full */
  heightClass?: string;
  /** Modo TV: fonte grande, sem tooltip nem foco */
  variant?: "default" | "tv";
}

export function BurnupChart({ series, label, heightClass = "h-chart-large", variant = "default" }: BurnupChartProps) {
  const t = useChartTheme();
  const isTv = variant === "tv";
  const last = lastIndex(series, (p) => p.cumulative != null);

  const rows = useCallback(
    (p: Point): TooltipRow[] => [
      ...(p.cumulative != null
        ? [
            {
              value: formatNumber(p.cumulative),
              label: "Realizado acumulado",
              swatch: t.brand,
            },
          ]
        : []),
      {
        value: formatNumber(p.targetCumulative),
        label: "Meta acumulada",
        swatch: t.target,
        dashed: true,
      },
      p.cumulative != null
        ? {
            value: p.targetCumulative ? `${Math.round((p.cumulative / p.targetCumulative) * 100)}%` : "—",
            label: "da meta acumulada",
          }
        : { value: "—", label: "dia ainda não apontado" },
    ],
    [t],
  );

  const option = useMemo(() => {
    const font = isTv ? t.tvFontSize : t.fontSize;
    const line = isTv ? t.line * 2 : t.line;
    return {
      ...baseOption(t, font),
      grid: isTv
        ? {
            top: readToken("--ds-space-300"),
            right: readToken("--ds-space-300"),
            bottom: font * 2.5,
            left: font * 4.5,
          }
        : grid("--ds-space-300", "--ds-space-300"),
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: series.map((p) => formatShortDate(p.date)),
        ...axisStyle(t, font),
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        ...axisStyle(t, font),
        axisLine: { show: false },
        // margem proporcional à fonte: na TV o "0" não encosta no primeiro dia
        axisLabel: {
          ...axisStyle(t, font).axisLabel,
          formatter: formatCompact,
          margin: font * 0.75,
        },
      },
      tooltip: {
        ...tooltipBase,
        show: !isTv,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: t.target, width: 1 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const p = series[params[0].dataIndex];
          return tooltipHtml(formatLongDate(p.date), rows(p));
        },
      },
      series: [
        {
          name: "Realizado acumulado",
          type: "line",
          symbol: "circle",
          symbolSize: (isTv ? 2 : 1) * t.marker * 2,
          // Só o último dia apontado leva marcador: "onde o mês está hoje"
          data: series.map((p, i) => (i === last ? p.cumulative : { value: p.cumulative, symbol: "none" })),
          itemStyle: { color: t.brand },
          lineStyle: { width: line, color: t.brand },
          areaStyle: { color: t.brand, opacity: t.areaOpacity },
        },
        {
          name: "Meta acumulada",
          type: "line",
          data: series.map((p) => p.targetCumulative),
          symbol: "none",
          silent: true,
          lineStyle: { width: line, color: t.target, type: t.dash },
        },
      ],
    };
  }, [series, t, isTv, rows, last]);

  const end = series[last];
  const summary = end
    ? `${label}. Até ${formatShortDate(end.date)}: ${formatNumber(end.cumulative!)} realizados contra ${formatNumber(
        end.targetCumulative,
      )} previstos; meta do mês ${formatNumber(series[series.length - 1].targetCumulative)}.`
    : label;

  return (
    <EChart
      option={option}
      label={summary}
      className={heightClass}
      isStatic={isTv}
      keyboard={
        isTv
          ? undefined
          : {
              count: series.length,
              start: Math.max(0, last),
              axis: "x",
              describe: (i) => tooltipText(formatLongDate(series[i].date), rows(series[i])),
            }
      }
    />
  );
}

/* ---------- Produção diária em colunas ---------- */
export function DailyColumns({ series, label }: { series: Point[]; label: string }) {
  const t = useChartTheme();
  const target = series[0]?.dailyTarget ?? 0;
  const last = lastIndex(series, (p) => p.value != null);

  const rows = useCallback(
    (p: Point): TooltipRow[] =>
      p.value == null
        ? [{ value: "—", label: "dia ainda não apontado" }]
        : [
            {
              value: formatNumber(p.value),
              label: "Produção",
              swatch: p.value >= target ? t.brand : t.neutral,
            },
            {
              value: formatNumber(target),
              label: "Meta diária",
              swatch: t.target,
              dashed: true,
            },
            {
              value: target ? `${Math.round((p.value / target) * 100)}%` : "—",
              label: "da meta diária",
            },
          ],
    [t, target],
  );

  const option = useMemo(
    () => ({
      ...baseOption(t),
      grid: grid("--ds-space-200", "--ds-space-100"),
      xAxis: {
        type: "category",
        data: series.map((p) => formatShortDate(p.date)),
        ...axisStyle(t),
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        ...axisStyle(t),
        axisLine: { show: false },
        axisLabel: { ...axisStyle(t).axisLabel, formatter: formatCompact },
      },
      tooltip: {
        ...tooltipBase,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: t.gridline } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const p = series[params[0].dataIndex];
          return tooltipHtml(formatLongDate(p.date), rows(p));
        },
      },
      series: [
        {
          name: "Produção",
          type: "bar",
          barMaxWidth: readToken("--dash-size-bar-max"),
          // Destaque de hover/teclado: contorno, sem trocar a cor (a cor diz acima/abaixo da meta)
          emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
          data: series.map((p) => ({
            value: p.value,
            itemStyle: {
              color: (p.value ?? 0) >= target ? t.brand : t.neutral,
              borderRadius: [t.radius, t.radius, 0, 0],
            },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: t.target, width: t.line, type: t.dash },
            data: [{ yAxis: target }],
          },
        },
        {
          // Invisível: só faz o eixo Y sempre incluir a meta (o markLine não estica o eixo)
          name: "Meta diária",
          type: "line",
          data: series.map(() => target),
          symbol: "none",
          silent: true,
          lineStyle: { opacity: 0 },
          tooltip: { show: false },
        },
      ],
    }),
    [series, t, target, rows],
  );

  const elapsed = series.filter((p) => p.value != null);
  const above = elapsed.filter((p) => p.value! >= target).length;
  const summary = `${label}. ${above} de ${elapsed.length} dias úteis acima da meta diária de ${formatNumber(target)}.`;

  return (
    <EChart
      option={option}
      label={summary}
      className="h-chart"
      keyboard={{
        count: series.length,
        start: Math.max(0, last),
        axis: "x",
        describe: (i) => tooltipText(formatLongDate(series[i].date), rows(series[i])),
      }}
    />
  );
}

/* ---------- Atingimento por máquina (barras horizontais) ---------- */
/** Escala até 120% para caber quem passou da meta; a linha tracejada marca 100% */
const SCALE_MAX = 120;

export function AttainmentBars({
  machines,
  activeId,
  onSelect,
}: {
  machines: Machine[];
  activeId?: string | null;
  onSelect: (m: Machine) => void;
}) {
  const t = useChartTheme();
  const sorted = useMemo(() => [...machines].sort((a, b) => b.percent - a.percent), [machines]);
  const status = (m: Machine) => `${m.percent}% · ${STATUS_META[m.status].label}`;

  const rows = useCallback(
    (m: Machine): TooltipRow[] => [
      {
        value: `${m.percent}%`,
        label: `da meta · ${STATUS_META[m.status].label}`,
        swatch: t.status[m.status],
      },
      {
        value: formatNumber(m.produced),
        label: `produzidas de ${formatNumber(m.target)}`,
      },
    ],
    [t],
  );

  // A coluna de nomes acompanha a largura: no celular ocupa menos e as barras continuam legíveis
  const option = useCallback(
    (width: number) => {
      const narrow = width < readToken("--dash-size-chart-card-min");
      // Colunas de nome e de valor com largura reservada (o containLabel do ECharts erra a medida da Inter)
      const gap = readToken("--ds-space-100");
      // no celular o nome ganha espaço (com 30% todos viravam "Embaladora v…"); a barra continua visível
      const nameW = Math.min(readToken("--dash-size-bar-label-wide") / 2, width * (narrow ? 0.42 : 0.34));
      const valueW = readToken("--dash-size-chart-value") * (narrow ? 0.5 : 1);
      return {
        ...baseOption(t),
        grid: {
          top: readToken("--ds-space-300"),
          right: valueW,
          bottom: 0,
          left: nameW + gap,
        },
        xAxis: { type: "value", max: SCALE_MAX, show: false },
        yAxis: [
          {
            type: "category",
            inverse: true,
            data: sorted.map((m) => m.name),
            axisLine: { show: false },
            axisTick: { show: false },
            // clicável: abre a máquina, como a barra
            triggerEvent: true,
            axisLabel: {
              color: t.text,
              fontSize: t.fontSize,
              width: nameW,
              overflow: "truncate",
              margin: gap,
            },
          },
          {
            type: "category",
            inverse: true,
            position: "right",
            // no celular só o %; o status continua na cor, no tooltip e na tabela
            data: sorted.map((m) => (narrow ? `${m.percent}%` : status(m))),
            axisLine: { show: false },
            axisTick: { show: false },
            triggerEvent: true,
            axisLabel: { color: t.text, fontSize: t.fontSize, margin: gap },
          },
        ],
        tooltip: {
          ...tooltipBase,
          trigger: "item",
          formatter: ({ dataIndex }: { dataIndex: number }) => tooltipHtml(sorted[dataIndex].name, rows(sorted[dataIndex])),
        },
        series: [
          {
            type: "bar",
            cursor: "pointer",
            barMaxWidth: readToken("--dash-size-bar-max"),
            emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
            data: sorted.map((m) => ({
              value: Math.min(m.percent, SCALE_MAX),
              itemStyle: {
                color: t.status[m.status],
                borderRadius: [0, t.radius, t.radius, 0],
                // máquina aberta no painel: contorno forte
                borderWidth: activeId === m.id ? t.line : 0,
                borderColor: t.text,
              },
            })),
            markLine: {
              silent: true,
              symbol: "none",
              lineStyle: { color: t.target, width: 1, type: t.dash },
              label: {
                formatter: "Meta",
                position: "start",
                color: t.textSubtlest,
                fontSize: t.fontSize,
              },
              data: [{ xAxis: 100 }],
            },
          },
        ],
      };
    },
    [sorted, activeId, t, rows],
  );

  const height = sorted.length * readToken("--dash-size-row") + readToken("--ds-space-400");
  const reached = sorted.filter((m) => m.percent >= 100).length;

  return (
    <EChart
      option={option}
      label={`Atingimento da meta por máquina. ${reached} de ${sorted.length} máquinas atingiram a meta.`}
      style={{ height }}
      onClick={(p) => {
        // barra: pelo índice; rótulo do eixo: pelo texto (nome ou "77% · Atenção")
        const i =
          p.componentType === "series"
            ? p.dataIndex
            : sorted.findIndex((m) => m.name === p.value || status(m) === p.value || `${m.percent}%` === p.value);
        if (i >= 0) onSelect(sorted[i]);
      }}
      keyboard={{
        count: sorted.length,
        axis: "y",
        describe: (i) => tooltipText(sorted[i].name, rows(sorted[i])),
        onActivate: (i) => onSelect(sorted[i]),
      }}
    />
  );
}

/* ---------- Capacidade por dia, por processo (simulador) ---------- */
export interface CapacityItem {
  id: string;
  label: string;
  area: "montagem" | "embalagem";
  /** capacidade por dia no cenário atual */
  value: number;
  /** capacidade por dia na planilha */
  before: number;
  /** máquina nova, ainda sem peças/min */
  noRate: boolean;
}

/**
 * Barras horizontais da capacidade diária de cada processo, na cor da área.
 * Quando o cenário muda um processo, uma marca mostra o valor da planilha
 * e a diferença aparece colorida na coluna de valores.
 */
export function CapacityBars({ items, label }: { items: CapacityItem[]; label: string }) {
  const t = useChartTheme();
  const sorted = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items]);
  const color = (area: CapacityItem["area"]) => (area === "montagem" ? t.categorical[0] : t.categorical[1]);
  const delta = (i: CapacityItem) => Math.round(i.value - i.before);

  const rows = useCallback(
    (i: CapacityItem): TooltipRow[] =>
      i.noRate
        ? [{ value: "—", label: "máquina nova, sem peças/min definidas" }]
        : [
            {
              value: formatNumber(Math.round(i.value)),
              label: "peças/dia no cenário",
              swatch: color(i.area),
            },
            ...(delta(i) !== 0
              ? [
                  {
                    value: formatNumber(Math.round(i.before)),
                    label: "na planilha",
                    swatch: t.text,
                  },
                  {
                    value: `${delta(i) > 0 ? "+" : "−"}${formatNumber(Math.abs(delta(i)))}`,
                    label: "de diferença",
                  },
                ]
              : []),
          ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const option = useCallback(
    (width: number) => {
      const gap = readToken("--ds-space-100");
      const nameW = Math.min(readToken("--dash-size-bar-label-wide"), width * 0.4);
      return {
        ...baseOption(t),
        grid: {
          top: 0,
          right: readToken("--dash-size-chart-value"),
          bottom: 0,
          left: nameW + gap,
        },
        xAxis: { type: "value", show: false },
        yAxis: [
          {
            type: "category",
            inverse: true,
            data: sorted.map((i) => i.label),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              color: t.text,
              fontSize: t.fontSize,
              width: nameW,
              overflow: "truncate",
              margin: gap,
            },
          },
          {
            // valor e diferença à direita, com cor só na diferença
            type: "category",
            inverse: true,
            position: "right",
            data: sorted.map((i) => {
              if (i.noRate) return "{muted|sem taxa}";
              const d = delta(i);
              const diff = d === 0 ? "" : ` {${d > 0 ? "up" : "down"}|${d > 0 ? "+" : "−"}${formatNumber(Math.abs(d))}}`;
              return `{value|${formatNumber(Math.round(i.value))}}${diff}`;
            }),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: {
              fontSize: t.fontSize,
              margin: gap,
              rich: {
                value: { color: t.text, fontSize: t.fontSize, fontWeight: 600 },
                up: { color: t.textSuccess, fontSize: t.fontSize },
                down: { color: t.textDanger, fontSize: t.fontSize },
                muted: { color: t.textSubtlest, fontSize: t.fontSize },
              },
            },
          },
        ],
        tooltip: {
          ...tooltipBase,
          trigger: "item",
          formatter: ({ dataIndex }: { dataIndex: number }) => tooltipHtml(sorted[dataIndex].label, rows(sorted[dataIndex])),
        },
        series: [
          {
            type: "bar",
            barMaxWidth: readToken("--dash-size-bar-max") * 0.75,
            emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
            data: sorted.map((i) => ({
              value: i.noRate ? 0 : Math.round(i.value),
              itemStyle: {
                color: color(i.area),
                borderRadius: [0, t.radius, t.radius, 0],
              },
            })),
          },
          {
            // marca do valor da planilha (só nos processos alterados)
            type: "scatter",
            silent: true,
            symbol: "rect",
            symbolSize: [t.line, readToken("--dash-size-bar-max")],
            itemStyle: { color: t.text },
            tooltip: { show: false },
            data: sorted.map((i) => (delta(i) !== 0 && !i.noRate ? Math.round(i.before) : null)),
          },
        ],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorted, t, rows],
  );

  const changed = sorted.filter((i) => delta(i) !== 0).length;
  const total = sorted.reduce((s, i) => s + i.value, 0);
  return (
    <EChart
      option={option}
      label={`${label}. ${sorted.length} processos, ${formatNumber(Math.round(total))} peças por dia no total${
        changed ? `; ${changed} alterados em relação à planilha` : ""
      }.`}
      style={{ height: sorted.length * readToken("--dash-size-row") * 0.8 }}
      keyboard={{
        count: sorted.length,
        axis: "y",
        describe: (i) => tooltipText(sorted[i].label, rows(sorted[i])),
      }}
    />
  );
}

/* ---------- Colunas empilhadas por turno (Modo TV: OPs concluídas por dia) ---------- */
export function ShiftStackBars({
  days,
  label,
  unit,
}: {
  days: Array<{ date: Date; byShift: [number, number, number] }>;
  label: string;
  /** unidade no resumo acessível (ex.: "OPs concluídas") */
  unit: string;
}) {
  const t = useChartTheme();
  const option = useMemo(() => {
    const font = t.tvFontSize;
    return {
      ...baseOption(t, font),
      grid: {
        top: readToken("--ds-space-300"),
        right: readToken("--ds-space-200"),
        bottom: font * 2.5,
        left: font * 3,
      },
      xAxis: {
        type: "category",
        data: days.map((d) => formatShortDate(d.date)),
        ...axisStyle(t, font),
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitNumber: 4,
        ...axisStyle(t, font),
        axisLine: { show: false },
        axisLabel: { ...axisStyle(t, font).axisLabel, margin: font * 0.75 },
      },
      series: ([0, 1, 2] as const).map((s) => ({
        name: `Turno ${s + 1}`,
        type: "bar",
        stack: "shifts",
        barMaxWidth: readToken("--dash-size-bar-max") * 2,
        itemStyle: {
          color: t.categorical[s],
          borderRadius: s === 2 ? [t.radius, t.radius, 0, 0] : 0,
        },
        // total do dia em cima da pilha
        label:
          s === 2
            ? {
                show: true,
                position: "top",
                color: t.text,
                fontSize: font,
                formatter: ({ dataIndex }: { dataIndex: number }) =>
                  String(days[dataIndex].byShift.reduce((a, b) => a + b, 0) || ""),
              }
            : undefined,
        data: days.map((d) => d.byShift[s]),
      })),
    };
  }, [days, t]);
  const total = days.reduce((s, d) => s + d.byShift.reduce((a, b) => a + b, 0), 0);
  return (
    <EChart
      option={option}
      label={`${label}. ${total} ${unit} nos últimos ${days.length} dias úteis.`}
      className="h-full"
      isStatic
    />
  );
}

/* ---------- Colunas + linha (genérico): turnos, OPs, retrabalho, Pareto ---------- */
export type ComboColor = "brand" | "neutral" | "target" | "c1" | "c2" | "c3" | "danger";

export interface ComboSeries {
  name: string;
  kind: "bar" | "line";
  data: Array<number | null>;
  color: ComboColor;
  /** eixo da direita (ex.: % ou dias) */
  right?: boolean;
  /** colunas com o mesmo stack se empilham */
  stack?: string;
  format?: (v: number) => string;
}

export interface ComboChartProps {
  categories: string[];
  /** título do tooltip por categoria (ex.: data por extenso) */
  titles?: string[];
  series: ComboSeries[];
  /** resumo em texto (nome acessível) */
  label: string;
  leftFormat?: (v: number) => string;
  rightFormat?: (v: number) => string;
  rightMax?: number;
  /** linha de referência no eixo da direita (ex.: limite de retrabalho) */
  rightMark?: number;
  /** eixo esquerdo só com inteiros (contagens) */
  integer?: boolean;
}

export function ComboChart({
  categories,
  titles = categories,
  series,
  label,
  leftFormat = formatCompact,
  rightFormat,
  rightMax,
  rightMark,
  integer,
}: ComboChartProps) {
  const t = useChartTheme();
  const paint = useCallback(
    (c: ComboColor) =>
      ({
        brand: t.brand,
        neutral: t.neutral,
        target: t.target,
        c1: t.categorical[0],
        c2: t.categorical[1],
        c3: t.categorical[2],
        danger: t.status.critical,
      })[c],
    [t],
  );
  const hasRight = series.some((s) => s.right);

  const rows = useCallback(
    (i: number): TooltipRow[] =>
      series
        .filter((s) => s.data[i] != null)
        .map((s) => ({
          value: (s.format ?? formatNumber)(s.data[i]!),
          label: s.name,
          swatch: paint(s.color),
        })),
    [series, paint],
  );

  const option = useCallback(
    (width: number) => {
      const stacks = new Map<string, number>();
      series.forEach((s, i) => s.stack && stacks.set(s.stack, i));
      // largura real de cada rótulo: área de plotagem (eixos esquerdo e direito) dividida pelas categorias, menos um respiro
      const labelW =
        (width - readToken("--dash-size-chart-axis") - readToken(hasRight ? "--dash-size-chart-axis" : "--ds-space-100")) / categories.length -
        readToken("--ds-space-100");
      // Estreito demais para a palavra inteira (celular): rótulo inclinado, terminando em "…" (o nome completo fica no tooltip)
      const tilted = labelW < readToken("--ds-space-800");
      return {
        ...baseOption(t),
        grid: {
          ...grid("--ds-space-300", hasRight ? "--dash-size-chart-axis" : "--ds-space-100"),
          // rótulos que quebram linha (motivos, faixas) precisam de até três linhas embaixo
          ...(categories.length <= 6 ? { bottom: t.fontSize * 4.5 } : {}),
        },
        xAxis: {
          type: "category",
          data: categories,
          ...axisStyle(t),
          // poucas categorias com nome (motivos, faixas): todos os rótulos, quebrando linha
          ...(categories.length <= 6
            ? {
                axisLabel: tilted
                  ? {
                      ...axisStyle(t).axisLabel,
                      interval: 0,
                      rotate: 35,
                      // inclinado, todo rótulo termina no seu traço (o padrão do app alinha o 1º à esquerda)
                      alignMinLabel: "right",
                      alignMaxLabel: "right",
                      width: readToken("--ds-space-1000"),
                      overflow: "truncate",
                      ellipsis: "…",
                    }
                  : {
                      ...axisStyle(t).axisLabel,
                      interval: 0,
                      alignMinLabel: "center",
                      alignMaxLabel: "center",
                      width: labelW,
                      overflow: "break",
                    },
              }
            : {}),
          splitLine: { show: false },
        },
        yAxis: [
          {
            type: "value",
            splitNumber: 4,
            minInterval: integer ? 1 : undefined,
            ...axisStyle(t),
            axisLine: { show: false },
            axisLabel: { ...axisStyle(t).axisLabel, formatter: leftFormat },
          },
          ...(hasRight
            ? [
                {
                  type: "value",
                  splitNumber: 4,
                  min: 0,
                  max: rightMax,
                  ...axisStyle(t),
                  axisLine: { show: false },
                  splitLine: { show: false },
                  axisLabel: {
                    ...axisStyle(t).axisLabel,
                    formatter: rightFormat,
                  },
                },
              ]
            : []),
        ],
        tooltip: {
          ...tooltipBase,
          trigger: "axis",
          axisPointer: { type: "shadow", shadowStyle: { color: t.gridline } },
          formatter: (params: Array<{ dataIndex: number }>) => tooltipHtml(titles[params[0].dataIndex], rows(params[0].dataIndex)),
        },
        series: series.map((s, i) => {
          const c = paint(s.color);
          const top = !s.stack || stacks.get(s.stack) === i;
          return s.kind === "bar"
            ? {
                name: s.name,
                type: "bar",
                stack: s.stack,
                yAxisIndex: s.right ? 1 : 0,
                barMaxWidth: readToken("--dash-size-bar-max"),
                emphasis: {
                  itemStyle: { borderColor: t.text, borderWidth: 1 },
                },
                itemStyle: {
                  color: c,
                  borderRadius: top ? [t.radius, t.radius, 0, 0] : 0,
                },
                data: s.data,
              }
            : {
                name: s.name,
                type: "line",
                yAxisIndex: s.right ? 1 : 0,
                connectNulls: false,
                symbol: "circle",
                symbolSize: t.marker * 2,
                itemStyle: { color: c },
                lineStyle: { width: t.line, color: c },
                data: s.data,
                markLine:
                  s.right && rightMark != null
                    ? {
                        silent: true,
                        symbol: "none",
                        label: { show: false },
                        lineStyle: {
                          color: t.target,
                          width: t.line,
                          type: t.dash,
                        },
                        data: [{ yAxis: rightMark }],
                      }
                    : undefined,
              };
        }),
      };
    },
    [categories, titles, series, t, paint, rows, hasRight, leftFormat, rightFormat, rightMax, rightMark, integer],
  );

  return (
    <EChart
      option={option}
      label={label}
      className="h-chart"
      keyboard={{
        count: categories.length,
        start: 0,
        axis: "x",
        describe: (i) => tooltipText(titles[i], rows(i)),
      }}
    />
  );
}

/* ---------- Barras horizontais (genérico): ranking de máquinas ---------- */
export interface HBarItem {
  id: string;
  label: string;
  value: number;
  /** texto à direita da barra */
  display: string;
  /** linha de detalhe no tooltip */
  detail?: string;
}

export function HBars({
  items,
  label,
  unit,
  activeId,
  onSelect,
}: {
  items: HBarItem[];
  label: string;
  /** rótulo do valor no tooltip (ex.: "peças/min") */
  unit: string;
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const t = useChartTheme();
  const rows = useCallback(
    (i: HBarItem): TooltipRow[] => [
      { value: i.display, label: unit, swatch: t.brand },
      ...(i.detail ? [{ value: "", label: i.detail }] : []),
    ],
    [t, unit],
  );

  const option = useCallback(
    (width: number) => {
      const gap = readToken("--ds-space-100");
      const nameW = Math.min(readToken("--dash-size-bar-label-wide") / 2, width * 0.34);
      return {
        ...baseOption(t),
        grid: {
          top: 0,
          right: readToken("--dash-size-chart-value") / 2,
          bottom: 0,
          left: nameW + gap,
        },
        xAxis: { type: "value", show: false },
        yAxis: [
          {
            type: "category",
            inverse: true,
            data: items.map((i) => i.label),
            axisLine: { show: false },
            axisTick: { show: false },
            triggerEvent: !!onSelect,
            axisLabel: {
              color: t.text,
              fontSize: t.fontSize,
              width: nameW,
              overflow: "truncate",
              margin: gap,
            },
          },
          {
            type: "category",
            inverse: true,
            position: "right",
            data: items.map((i) => i.display),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: t.text, fontSize: t.fontSize, margin: gap },
          },
        ],
        tooltip: {
          ...tooltipBase,
          trigger: "item",
          formatter: ({ dataIndex }: { dataIndex: number }) => tooltipHtml(items[dataIndex].label, rows(items[dataIndex])),
        },
        series: [
          {
            type: "bar",
            cursor: onSelect ? "pointer" : "default",
            barMaxWidth: readToken("--dash-size-bar-max"),
            emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
            data: items.map((i) => ({
              value: i.value,
              itemStyle: {
                color: t.brand,
                borderRadius: [0, t.radius, t.radius, 0],
                borderWidth: activeId === i.id ? t.line : 0,
                borderColor: t.text,
              },
            })),
          },
        ],
      };
    },
    [items, activeId, t, rows, onSelect],
  );

  return (
    <EChart
      option={option}
      label={label}
      style={{ height: items.length * readToken("--dash-size-row") * 0.8 }}
      onClick={
        onSelect
          ? (p) => {
              const i = p.componentType === "series" ? p.dataIndex : items.findIndex((x) => x.label === p.value);
              if (i >= 0) onSelect(items[i].id);
            }
          : undefined
      }
      keyboard={{
        count: items.length,
        axis: "y",
        describe: (i) => tooltipText(items[i].label, rows(items[i])),
        onActivate: onSelect ? (i) => onSelect(items[i].id) : undefined,
      }}
    />
  );
}
