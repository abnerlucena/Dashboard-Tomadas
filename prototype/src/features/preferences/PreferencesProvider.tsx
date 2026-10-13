import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAccess } from "@/features/access/AccessContext";
import { clearUserDrafts } from "@/features/entry/draft";
import { FACTORY_PREFS, localPrefsStore, type Prefs, type PrefsStore } from "./prefs";
import { PrefsCtx, userKeyOf, type PrefsState } from "./PreferencesContext";

export function PreferencesProvider({ children, store = localPrefsStore }: { children: ReactNode; store?: PrefsStore }) {
  const { session } = useAccess();
  const user = userKeyOf(session);
  const [state, setState] = useState(() => ({ user, prefs: store.load(user) }));

  // Outra pessoa entrou neste computador: carrega as preferências dela
  if (state.user !== user) setState({ user, prefs: store.load(user) });

  const update = useCallback(
    (next: Prefs) => {
      setState((s) => ({ ...s, prefs: next }));
      store.save(user, next);
    },
    [store, user],
  );

  const setPref = useCallback<PrefsState["setPref"]>(
    (key, value) => {
      if (key === "rascunho" && value === false) clearUserDrafts(user);
      update({ ...state.prefs, [key]: value });
    },
    [state.prefs, update, user],
  );
  const reset = useCallback(() => {
    clearUserDrafts(user);
    update({ ...FACTORY_PREFS });
  }, [update, user]);

  const value = useMemo<PrefsState>(() => ({ prefs: state.prefs, user, setPref, reset, store }), [state.prefs, user, setPref, reset, store]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}
