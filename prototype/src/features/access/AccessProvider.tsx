import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "../../../../src/lib/api";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";
import { AccessCtx, type AccessState } from "./AccessContext";
import { loadAccessClient, type AccessClient } from "./client";
import { can as canWith, canOpen as canOpenWith } from "./permissions";

/**
 * Sessão da UI nova. Carrega a fonte (real ou demonstração), restaura a sessão
 * guardada, confere se ela ainda vale e acompanha trocas de login em outra aba.
 * Enquanto carrega, mostra `fallback` (a tela não pisca a de login à toa).
 */
export function AccessProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [client, setClient] = useState<AccessClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState<EstadoRecuperacao | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    let alive = true;
    loadAccessClient().then((c) => {
      if (!alive) return;
      // Quem chega pelo link de recuperação troca a senha primeiro: sessão guardada não vale
      const recovering = c.recovery();
      if (recovering) c.store.clear();
      const saved = recovering ? null : c.store.load();
      setClient(c);
      setRecovery(recovering);
      setSession(saved);
      // A sessão guardada ainda vale? (usuário bloqueado, senha trocada, token vencido)
      if (saved)
        c.auth
          .isSessionValid(saved)
          .then((ok) => {
            if (ok || !alive) return;
            c.store.clear();
            setSession(null);
            setNotice("Sua sessão expirou. Entre de novo.");
          })
          .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(
    async (message?: string) => {
      if (!client) return;
      const current = sessionRef.current;
      client.store.clear();
      setSession(null);
      setNotice(message ?? null);
      try {
        await client.auth.logout(current);
      } catch {
        /* sem rede: a sessão local já saiu */
      }
    },
    [client],
  );

  // Outra aba entrou com outro usuário, ou saiu (modo Supabase)
  useEffect(() => {
    if (!client) return;
    return client.auth.watchSession((s) => {
      const current = sessionRef.current;
      if (!current) return; // na tela de entrar: quem cuida é o login()
      if (!s) {
        client.store.clear();
        setSession(null);
        setNotice("Sua sessão foi encerrada (saída ou entrada feita em outra aba).");
      } else if (s.userId !== current.userId) {
        client.store.save(s);
        setSession(s);
      }
    });
  }, [client]);

  const value = useMemo<AccessState | null>(
    () =>
      client && {
        client,
        session,
        can: (p) => canWith(session, p),
        canOpen: (route) => canOpenWith(session, route),
        login: async (email, password, badge) => {
          const { session: s } = await client.auth.login(email.trim(), password, badge?.trim() || undefined);
          client.store.save(s);
          setNotice(null);
          setRecovery(null);
          setSession(s);
        },
        logout,
        adopt: (s) => {
          client.store.save(s);
          setSession(s);
        },
        recovery,
        clearRecovery: () => setRecovery(null),
        notice,
      },
    [client, session, recovery, notice, logout],
  );

  if (!value) return <>{fallback}</>;
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}
