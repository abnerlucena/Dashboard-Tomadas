import { clsx, type ClassValue } from "clsx";

// Sem tailwind-merge: os nomes de token (text-subtle, font-body…) não são
// reconhecidos por ele e seriam "mesclados" incorretamente.
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

const numberFormat = new Intl.NumberFormat("pt-BR");
export const formatNumber = (n: number) => numberFormat.format(n);

const compactFormat = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
/** "27 mil", "1,8 mi" — para eixos e células estreitas */
export const formatCompact = (n: number) => compactFormat.format(n);
const compactShortFormat = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
/** "81 mil" — para células muito estreitas (calendário) */
export const formatCompactShort = (n: number) => compactShortFormat.format(n);

const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const formatDecimal = (n: number) => percentFormat.format(n);

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
/** "21 mar" (sem o ponto de abreviação) */
export const formatShortDate = (d: Date) => shortDate.format(d).replace(".", "").replace(" de ", " ");

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "long" });
export const formatLongDate = (d: Date) => longDate.format(d).replace(".", "");

/** Lê um token do tokens.css: tamanhos em px (rem/px), durações em ms (ms/s) ou número puro. */
export function readToken(name: string): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.endsWith("rem")) {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parseFloat(raw) * root;
  }
  if (raw.endsWith("ms")) return parseFloat(raw);
  if (raw.endsWith("s")) return parseFloat(raw) * 1000;
  return parseFloat(raw);
}

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado / armazenamento bloqueado: segue sem persistir */
  }
}

/** Dispara uma notificação (flag) no canto inferior */
export interface FlagAction {
  label: string;
  onClick: () => void;
}
export type Notify = (
  title: string,
  description?: string,
  appearance?: "success" | "error",
  action?: FlagAction,
) => void;

/* ---------- Download de arquivo ---------- */
type DownloadsApi = { save: (req: { filename: string; data: string | Blob }) => Promise<{ status: string }> };
type ClaudeHost = { use?: (name: "downloads") => Promise<DownloadsApi | null> };

/**
 * Salva um arquivo gerado pela página. Dentro do visualizador do claude.ai usa a
 * capacidade "downloads" (o viewer confirma); fora dele, um link de download comum.
 * Resolve "saved" ou "declined".
 */
export async function saveFile(filename: string, data: Blob): Promise<"saved" | "declined"> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  const downloads = host?.use ? await host.use("downloads").catch(() => null) : null;
  if (downloads) {
    try {
      await downloads.save({ filename, data });
      return "saved";
    } catch {
      return "declined";
    }
  }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return "saved";
}

/** "1 máquina", "6 máquinas" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
