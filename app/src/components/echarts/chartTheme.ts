// ─── Tema e peças comuns dos gráficos ─────────────────────────
// Fora de EChart.tsx de propósito: um arquivo que exporta o componente E estes
// ajudantes perde o recarregamento a quente (react-refresh/only-export-components).
import { useEffect, useState } from "react";
import { readToken } from "@/lib/utils";

/** Cores e medidas do tema atual, lidas do tokens.css (o ECharts não entende var()). */
export interface ChartTheme {
  brand: string;
  neutral: string;
  gridline: string;
  target: string;
  text: string;
  textSubtle: string;
  textSubtlest: string;
  textSuccess: string;
  textDanger: string;
  /** paleta categórica validada (montagem, embalagem, …) */
  categorical: [string, string, string];
  status: { critical: string; attention: string; near: string; achieved: string };
  areaOpacity: number;
  line: number;
  marker: number;
  radius: number;
  fontFamily: string;
  fontSize: number;
  tvFontSize: number;
  dash: number[];
  duration: number;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
/** Tamanho de um token de fonte ("400 0.75rem / 1rem Inter…") em px */
const fontPx = (name: string) => parseFloat(css(name).match(/([\d.]+)rem/)?.[1] ?? "0") * rootPx();

/**
 * Cor de token → rgb()/rgba(). O ECharts não interpreta a sintaxe moderna
 * "hsl(207 100% 62%)" ao animar cores (as séries sumiam na troca de tema);
 * o navegador faz a conversão.
 */
let probe: HTMLSpanElement | null = null;
const color = (name: string) => {
  if (!probe) {
    probe = document.createElement("span");
    probe.style.display = "none";
    document.body.appendChild(probe);
  }
  probe.style.color = css(name);
  return getComputedStyle(probe).color;
};

function readTheme(): ChartTheme {
  return {
    brand: color("--ds-chart-brand"),
    neutral: color("--ds-chart-neutral"),
    gridline: color("--ds-chart-gridline"),
    target: color("--ds-chart-target"),
    text: color("--ds-text"),
    textSubtle: color("--ds-text-subtle"),
    textSubtlest: color("--ds-text-subtlest"),
    textSuccess: color("--ds-text-success"),
    textDanger: color("--ds-text-danger"),
    categorical: [color("--ds-chart-categorical-1"), color("--ds-chart-categorical-2"), color("--ds-chart-categorical-3")],
    status: {
      critical: color("--ds-background-danger-bold"),
      attention: color("--ds-background-warning-bold"),
      near: color("--ds-background-information-bold"),
      achieved: color("--ds-background-success-bold"),
    },
    areaOpacity: readToken("--ds-opacity-chart-area"),
    line: readToken("--dash-chart-line"),
    marker: readToken("--dash-chart-marker"),
    radius: readToken("--ds-radius-small"),
    fontFamily: css("--ds-font-family-body"),
    fontSize: fontPx("--ds-font-body-small"),
    tvFontSize: fontPx("--dash-font-tv-body"),
    dash: css("--dash-chart-dash").split(/\s+/).map(Number),
    // Entrada curta como o resto da interface; zero com "reduzir movimento"
    duration: readToken("--ds-motion-duration-panel"),
  };
}

/** Tema do gráfico; relê os tokens quando o modo de cor muda (data-color-mode no <html>). */
export function useChartTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

/** Base comum: fonte e animação. A descrição acessível é nossa (em pt-BR), não a do ECharts. */
export function baseOption(t: ChartTheme, fontSize = t.fontSize) {
  return {
    animationDuration: t.duration,
    animationDurationUpdate: t.duration,
    animationEasing: "cubicOut" as const,
    animationEasingUpdate: "cubicOut" as const,
    textStyle: { fontFamily: t.fontFamily, fontSize, color: t.textSubtlest },
  };
}

/**
 * Tooltip no visual do protótipo. O container do ECharts fica transparente
 * (ele existe mesmo escondido); a caixa vem no HTML, com as classes do ChartTooltip.
 * confine: nunca sai da área do gráfico (nem corta na borda do card).
 */
export const tooltipBase = {
  confine: true,
  backgroundColor: "transparent",
  borderWidth: 0,
  padding: 0,
  extraCssText: "box-shadow: none;",
  transitionDuration: 0,
};

/** Eixos no padrão dos gráficos do app: sem traços, grade sutil, rótulos subtlest. */
export function axisStyle(t: ChartTheme, fontSize = t.fontSize) {
  return {
    axisLine: { lineStyle: { color: t.gridline } },
    axisTick: { show: false },
    // primeiro/último rótulo alinhados para dentro: não cortam na borda
    // (o ECharts não herda o tamanho global nos eixos: vai explícito)
    axisLabel: { color: t.textSubtlest, fontSize, hideOverlap: true, alignMinLabel: "left" as const, alignMaxLabel: "right" as const },
    splitLine: { lineStyle: { color: t.gridline } },
  };
}

export interface TooltipRow {
  value: string;
  label: string;
  swatch?: string;
  dashed?: boolean;
}

/** HTML do tooltip: valor em destaque, rótulo depois (mesmo padrão do resto do app). */
export function tooltipHtml(title: string, rows: TooltipRow[]) {
  const items = rows
    .map(
      (r) =>
        `<li class="flex items-center gap-100">${
          r.swatch
            ? `<span class="w-150 shrink-0 ${r.dashed ? "border-t-thick border-dashed" : "h-splitter-line rounded-full"}" style="${
                r.dashed ? `border-color:${r.swatch}` : `background:${r.swatch}`
              }"></span>`
            : ""
        }<span class="font-semibold tabular-nums text-default">${r.value}</span><span class="font-body-small text-subtle">${r.label}</span></li>`,
    )
    .join("");
  return `<div class="w-chart-tooltip rounded-medium bg-surface-overlay p-150 shadow-overlay"><p class="pb-075 font-body-small text-subtlest">${title}</p><ul class="flex flex-col gap-050">${items}</ul></div>`;
}

/** Mesma informação do tooltip, em texto corrido, para o leitor de tela */
export const tooltipText = (title: string, rows: TooltipRow[]) => `${title}: ${rows.map((r) => `${r.value} ${r.label}`).join(", ")}`;
