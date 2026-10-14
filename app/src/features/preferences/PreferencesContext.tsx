import { createContext, useContext } from "react";
import type { Prefs, PrefsStore } from "./prefs";

export interface PrefsState {
  prefs: Prefs;
  /** chave da pessoa de quem são as preferências */
  user: string;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** volta tudo ao padrão */
  reset: () => void;
  store: PrefsStore;
}

export const PrefsCtx = createContext<PrefsState | null>(null);

/** Quem é a pessoa para fins de preferência e rascunho: o id da conta, ou o nome onde não há id */
export const userKeyOf = (s: { userId?: string; nome: string } | null | undefined) => s?.userId ?? s?.nome ?? "anon";

export function usePrefs() {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs precisa estar dentro de <PreferencesProvider>");
  return ctx;
}
