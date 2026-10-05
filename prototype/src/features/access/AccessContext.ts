import { createContext, useContext } from "react";
import type { Session } from "../../../../src/lib/api";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";
import type { AccessClient } from "./client";
import type { Permission } from "./permissions";

export interface AccessState {
  client: AccessClient;
  session: Session | null;
  /** Tem a permissão? (esconder na tela é conveniência; quem barra é o banco) */
  can: (permission: Permission) => boolean;
  /** Pode abrir a tela desta rota? */
  canOpen: (route: string) => boolean;
  /** Lança o erro da camada de dados (use codigoDoErro/mensagemDeErro) */
  login: (email: string, password: string, badgeNumber?: string) => Promise<void>;
  logout: (notice?: string) => Promise<void>;
  /** Visita que veio do link de recuperação de senha */
  recovery: EstadoRecuperacao | null;
  clearRecovery: () => void;
  /** Aviso para a tela de entrar (ex.: sessão encerrada em outra aba) */
  notice: string | null;
}

export const AccessCtx = createContext<AccessState | null>(null);

export function useAccess() {
  const ctx = useContext(AccessCtx);
  if (!ctx) throw new Error("useAccess fora do AccessProvider");
  return ctx;
}
