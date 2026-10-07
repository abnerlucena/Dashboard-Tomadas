import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import path from "node:path";

/*
 * Mapeamento Tailwind → tokens.css
 *
 * A paleta, a escala de espaçamento, raios, sombras e fontes padrão do
 * Tailwind são SUBSTITUÍDOS (não estendidos): só existem classes que
 * apontam para um token. Ex.: bg-brand-bold, text-subtlest, p-200,
 * rounded-medium, shadow-overlay, font-heading-large.
 */

const v = (name: string) => `var(--${name})`;
const map = (keys: string[], toVar: (k: string) => string) =>
  Object.fromEntries(keys.map((k) => [k, toVar(k)]));

const ACCENTS = ["blue", "teal", "green", "lime", "yellow", "orange", "red", "magenta", "purple", "gray"];
const STATUS = ["information", "success", "warning", "danger", "discovery"];
const withStates = (base: string) => [base, `${base}-hovered`, `${base}-pressed`];

/* ---------- color.background.* e elevation.surface.* ---------- */
const backgroundKeys = [
  "disabled",
  ...withStates("input"),
  ...withStates("neutral"),
  ...withStates("neutral-subtle"),
  ...withStates("neutral-bold"),
  ...withStates("brand-subtlest"),
  ...withStates("brand-bold"),
  "brand-boldest",
  ...withStates("selected"),
  ...withStates("selected-bold"),
  ...STATUS.flatMap((s) => [...withStates(s), ...withStates(`${s}-bold`)]),
  ...withStates("inverse-subtle"),
  ...ACCENTS.flatMap((c) => ["subtlest", "subtler", "subtle", "bolder"].map((e) => `accent-${c}-${e}`)),
];
const surfaceKeys = [
  ...withStates("surface"),
  "surface-sunken",
  ...withStates("surface-raised"),
  ...withStates("surface-overlay"),
];

/* ---------- color.text.* ---------- */
const textKeys = [
  "subtle",
  "subtlest",
  "disabled",
  "inverse",
  "brand",
  "selected",
  "link",
  "link-pressed",
  "warning-inverse",
  ...STATUS,
  ...ACCENTS.flatMap((c) => [`accent-${c}`, `accent-${c}-bolder`]),
];

/* ---------- color.icon.* (ícones lucide usam currentColor) ---------- */
const iconKeys = [
  "subtle",
  "subtlest",
  "disabled",
  "inverse",
  "brand",
  "selected",
  ...STATUS,
  ...ACCENTS.map((c) => `accent-${c}`),
];

/* ---------- color.border.* ---------- */
const borderKeys = [
  "bold",
  "input",
  "focused",
  "selected",
  "brand",
  "disabled",
  "inverse",
  ...STATUS,
  ...ACCENTS.map((c) => `accent-${c}`),
];

const spaceKeys = ["0", "025", "050", "075", "100", "150", "200", "250", "300", "400", "500", "600", "800", "1000"];
const sizeKeys = [
  "icon-small",
  "icon-medium",
  "icon-large",
  "control",
  "control-compact",
  "nav-item",
  "row",
  "row-header",
  "lozenge",
  "badge",
  "checkbox",
  "avatar-small",
  "avatar-medium",
  "tile",
  "dot",
  "status-dot",
  "segment-width",
  "segment-height",
  "sparkline-bar",
  "sparkline-height",
  "empty-icon",
  "search-width",
  "menu-min",
  "popover",
  "inbox",
  "range-presets",
  "chat",
  "bubble",
  "flag",
  "tooltip-max",
  "column-name",
  "column-text",
  "field-search",
  "table-min",
  "touch-target",
  "content-max",
  "kbd",
  "modal",
  "field-op",
  "calendar",
  "field-quantity",
  "field-count",
  "field-rate",
  "modal-max-height",
  "modal-gutter",
  "kpi-min",
  "kpi-min-compact",
  "chart",
  "chart-large",
  "chart-axis",
  "bar-max",
  "heat-cell",
  "stacked-bar",
  "chart-tooltip",
  "chart-card-min",
];

const spacing = {
  ...map(spaceKeys, (k) => v(`ds-space-${k}`)),
  ...Object.fromEntries(
    spaceKeys.filter((k) => k !== "0").map((k) => [`negative-${k}`, v(`ds-space-negative-${k}`)]),
  ),
  px: v("ds-border-width"),
  ...map(sizeKeys, (k) => v(`dash-size-${k}`)),
  topnav: v("dash-topnav-height"),
  banner: v("dash-banner-height"),
  sidenav: v("dash-sidenav-width"),
  "sidenav-overlay": v("dash-sidenav-overlay-width"),
  panel: v("dash-panel-width"),
  splitter: v("dash-splitter-hit-area"),
  "splitter-line": v("dash-splitter-line"),
};

const fontTokens = [
  "heading-xxlarge",
  "heading-xlarge",
  "heading-large",
  "heading-medium",
  "heading-small",
  "heading-xsmall",
  "heading-xxsmall",
  "body-large",
  "body",
  "body-small",
  "metric-large",
  "metric-medium",
  "metric-small",
  "code",
];
const TV_FONTS = ["tv-hero", "tv-metric", "tv-title", "tv-body"];
const TIGHT = new Set(["heading-xxlarge", "heading-xlarge", "heading-large", "metric-large", "metric-medium"]);

export default {
  future: { hoverOnlyWhenSupported: true },
  content: [path.join(__dirname, "index.html"), path.join(__dirname, "src/**/*.{ts,tsx}")],
  theme: {
    screens: {
      xs: "480px",
      s: "768px",
      m: "1024px",
      l: "1440px",
      xl: "1768px",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
    },
    backgroundColor: {
      transparent: "transparent",
      current: "currentColor",
      ...map(backgroundKeys, (k) => v(`ds-background-${k}`)),
      ...map(surfaceKeys, (k) => v(`ds-${k}`)),
      ...Object.fromEntries(["brand","neutral","gridline","target","categorical-1","categorical-2","categorical-3"].map((k) => [`chart-${k}`, v(`ds-chart-${k}`)])),
      blanket: v("ds-blanket"),
      // pontos decorativos e barras de status usam cores de ícone como preenchimento: bg-icon-*
      ...Object.fromEntries(
        ["brand", "information", "success", "warning", "danger", "subtlest", ...ACCENTS.map((c) => `accent-${c}`)].map(
          (k) => [`icon-${k}`, v(`ds-icon-${k}`)],
        ),
      ),
      "border-focused": v("ds-border-focused"),
      border: v("ds-border"),
    },
    textColor: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      default: v("ds-text"),
      ...map(textKeys, (k) => v(`ds-text-${k}`)),
      icon: v("ds-icon"),
      // Marcas de gráfico em SVG usam currentColor: text-chart-* + fill-current/stroke-current
      ...Object.fromEntries(["brand","neutral","gridline","target","categorical-1","categorical-2","categorical-3"].map((k) => [`chart-${k}`, v(`ds-chart-${k}`)])),
      ...Object.fromEntries(iconKeys.map((k) => [`icon-${k}`, v(`ds-icon-${k}`)])),
    },
    borderColor: {
      DEFAULT: v("ds-border"),
      transparent: "transparent",
      current: "currentColor",
      default: v("ds-border"),
      surface: v("ds-surface"),
      "chart-target": v("ds-chart-target"),
      ...map(borderKeys, (k) => v(`ds-border-${k}`)),
    },
    outlineColor: {
      focused: v("ds-border-focused"),
      transparent: "transparent",
    },
    fill: { current: "currentColor", none: "none", transparent: "transparent" },
    // anel de 2px na cor da superfície em marcadores de gráfico
    stroke: { current: "currentColor", none: "none", "surface-raised": v("ds-surface-raised") },
    spacing,
    borderRadius: {
      none: "0",
      xsmall: v("ds-radius-xsmall"),
      small: v("ds-radius-small"),
      medium: v("ds-radius-medium"),
      large: v("ds-radius-large"),
      xlarge: v("ds-radius-xlarge"),
      full: v("ds-radius-full"),
    },
    borderWidth: {
      DEFAULT: v("ds-border-width"),
      0: "0",
      thick: v("ds-border-width-selected"),
    },
    outlineWidth: { focused: v("ds-border-width-focused") },
    outlineOffset: { focused: v("ds-focus-ring-offset"), inset: "calc(var(--ds-focus-ring-offset) * -1)" },
    boxShadow: {
      none: "none",
      raised: v("ds-shadow-raised"),
      overlay: v("ds-shadow-overlay"),
      overflow: v("ds-shadow-overflow"),
    },
    fontFamily: {
      "family-body": v("ds-font-family-body"),
      "family-code": v("ds-font-family-code"),
    },
    // pesos gerados pelo plugin, DEPOIS dos atalhos de fonte (senão "font" zera o peso)
    fontWeight: {},
    // font-size/line-height vêm só dos tokens de fonte (plugin abaixo)
    fontSize: {},
    lineHeight: {},
    letterSpacing: {
      tight: v("ds-font-tracking-tight"),
      normal: v("ds-font-tracking-normal"),
    },
    opacity: {
      0: "0",
      100: "1",
      disabled: v("ds-opacity-disabled"),
      "chart-area": v("ds-opacity-chart-area"),
      refetch: v("ds-opacity-refetch"),
    },
    zIndex: {
      0: "0",
      sticky: v("dash-z-sticky"),
      topnav: v("dash-z-topnav"),
      banner: v("dash-z-banner"),
      "panel-overlay": v("dash-z-panel-overlay"),
      modal: v("dash-z-modal"),
      "sidenav-overlay": v("dash-z-sidenav-overlay"),
      menu: v("dash-z-menu"),
      tooltip: v("dash-z-tooltip"),
      flag: v("dash-z-flag"),
      "skip-link": v("dash-z-skip-link"),
    },
    transitionDuration: {
      0: "0ms",
      press: v("ds-motion-duration-press"),
      hover: v("ds-motion-duration-hover"),
      menu: v("ds-motion-duration-menu"),
      panel: v("ds-motion-duration-panel"),
    },
    transitionTimingFunction: {
      out: v("ds-motion-easing-out"),
    },
    extend: {
      gridTemplateColumns: {
        // nome da máquina | trilho da barra
        // no celular o nome fica com até 40%: o trilho da barra nunca some
        attainment: "minmax(0, min(var(--dash-size-column-name), 40%)) minmax(0, 1fr) var(--dash-size-attainment-value)",
        "attainment-wide": "minmax(0, min(var(--dash-size-bar-label-wide), 40%)) minmax(0, 1fr) var(--dash-size-attainment-value)",
        tv: "minmax(0, var(--dash-size-tv-label)) minmax(0, 1fr) var(--dash-size-tv-value)",
        // posição | nome | trilho | valor | variação | peças/min
        "tv-rank": "var(--dash-size-tv-position) minmax(0, var(--dash-size-tv-label)) minmax(0, 1fr) var(--dash-size-tv-position) var(--dash-size-tv-position) var(--dash-size-tv-position)",
        "tv-cards": "repeat(auto-fill, minmax(var(--dash-size-tv-card), 1fr))",
      },
      transformOrigin: {
        menu: "var(--radix-dropdown-menu-content-transform-origin)",
        popover: "var(--radix-popover-content-transform-origin)",
      },
      width: {
        "sidenav-flyout": v("dash-sidenav-width"),
      },
      maxWidth: {
        "sidenav-max": `calc(100vw * var(--dash-sidenav-max-ratio))`,
      },
      scale: {
        press: v("ds-motion-press-scale"),
      },
      keyframes: {
        "ds-menu-in": {
          from: { opacity: "0", transform: `scale(var(--ds-motion-enter-scale))` },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "ds-menu-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: `scale(var(--ds-motion-enter-scale))` },
        },
        "ds-flyout-in": {
          from: { opacity: "0", transform: "translateX(var(--ds-motion-flyout-offset))" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "ds-flyout-out": {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(var(--ds-motion-flyout-offset))" },
        },
        "ds-panel-in": {
          from: { opacity: "0", transform: "translateX(var(--ds-motion-panel-offset))" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "ds-panel-out": {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(var(--ds-motion-panel-offset))" },
        },
        "ds-fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "ds-fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "ds-skeleton": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "var(--ds-opacity-loading-pulse)" } },
        "ds-spin": { to: { transform: "rotate(360deg)" } },
        "ds-progress": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "menu-in": "ds-menu-in var(--ds-motion-duration-menu) var(--ds-motion-easing-out)",
        "menu-out": "ds-menu-out var(--ds-motion-duration-hover) var(--ds-motion-easing-out) both",
        "flyout-in": "ds-flyout-in var(--ds-motion-duration-panel) var(--ds-motion-easing-out) both",
        "flyout-out": "ds-flyout-out var(--ds-motion-duration-panel) var(--ds-motion-easing-out) both",
        "panel-in": "ds-panel-in var(--ds-motion-duration-panel) var(--ds-motion-easing-out) both",
        "panel-out": "ds-panel-out var(--ds-motion-duration-panel) var(--ds-motion-easing-out) both",
        "fade-in": "ds-fade-in var(--ds-motion-duration-menu) var(--ds-motion-easing-out)",
        "fade-out": "ds-fade-out var(--ds-motion-duration-hover) var(--ds-motion-easing-out) both",
        skeleton: "ds-skeleton var(--ds-motion-duration-skeleton) ease-in-out infinite",
        spin: "ds-spin var(--ds-motion-duration-spin) linear infinite",
        "tv-progress": "ds-progress var(--dash-tv-slide-duration) linear both",
      },
    },
  },
  corePlugins: {
    // sem preflight de cor/fonte do Tailwind fora dos tokens (base.css cuida disso)
    container: false,
  },
  plugins: [
    plugin(({ addUtilities }) => {
      // font.heading.* / font.body.* / font.metric.* → shorthand "font"
      addUtilities(
        Object.fromEntries(
          fontTokens.map((t) => [
            `.font-${t}`,
            {
              font: v(`ds-font-${t}`),
              letterSpacing: TIGHT.has(t) ? v("ds-font-tracking-tight") : v("ds-font-tracking-normal"),
            },
          ]),
        ),
      );
      addUtilities(
        Object.fromEntries(
          TV_FONTS.map((t) => [`.font-${t}`, { font: v(`dash-font-${t}`), letterSpacing: v("ds-font-tracking-tight") }]),
        ),
      );
      addUtilities(
        Object.fromEntries(
          ["regular", "medium", "semibold", "bold"].map((w) => [`.font-${w}`, { fontWeight: v(`ds-font-weight-${w}`) }]),
        ),
      );
      addUtilities({
        ".tabular-nums": { fontVariantNumeric: "tabular-nums" },
        ".focus-ring": {
          outline: `var(--ds-border-width-focused) solid var(--ds-border-focused)`,
          outlineOffset: v("ds-focus-ring-offset"),
        },
      });
    }),
  ],
} satisfies Config;
