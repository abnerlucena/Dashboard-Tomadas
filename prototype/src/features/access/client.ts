import type { Session } from "../../../../src/lib/api";
import type { DataSource, DataSourceKind } from "../../../../src/lib/repositories/types";
import type { EstadoRecuperacao } from "../../../../src/lib/recovery";
import type { ReadSource } from "@/data/fromBackend";

/*
 * O que a área de acesso usa da camada de dados. É um recorte do contrato
 * (src/lib/repositories/types.ts) — a tela escreve contra ele, não contra a
 * implementação.
 *
 * Qual fonte:
 * - VITE_DATA_SOURCE definido ("supabase" ou "mock", no .env.local da
 *   raiz): a camada de dados da sessão do banco, carregada sob demanda. O
 *   "mock" dela só liga em desenvolvimento (nunca num build).
 * - Sem configuração: a fonte de demonstração desta pasta (demoClient.ts), para
 *   o protótipo — inclusive o HTML único, que é um build — abrir sozinho.
 */
export interface AccessClient {
  kind: DataSourceKind | "demo";
  auth: Pick<
    DataSource["auth"],
    "login" | "register" | "logout" | "isSessionValid" | "watchSession" | "requestPasswordReset" | "setNewPassword"
  >;
  users: Pick<
    DataSource["users"],
    "listUsers" | "approveUser" | "listRoles" | "toggleUser" | "listPermissions" | "getPermissions" | "setPermissions"
  >;
  /** Sessão guardada no navegador (chave própria da UI nova, ver `realStore`) */
  store: { load(): Session | null; save(s: Session): void; clear(): void };
  /** Se esta visita veio do link de recuperação de senha, em que tela começa */
  recovery(): EstadoRecuperacao | null;
  /**
   * Leitura dos dados de produção (adaptador em src/data/fromBackend.ts).
   * null = demonstração: as telas usam os dados gerados em machines.ts.
   */
  reads: ReadSource | null;
}

/*
 * Sessão da interface no modo real: uma chave por fonte (`dash-proto.session.supabase`,
 * `.gas`, `.mock`), para uma sessão de uma fonte nunca ser lida como de outra ao
 * trocar `VITE_DATA_SOURCE`. O login do Supabase em si (sb-…-auth-token) é guardado
 * pelo supabase-js.
 */
function realStore(kind: string): AccessClient["store"] {
  const key = `dash-proto.session.${kind}`;
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key) || "null") as Session | null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        localStorage.setItem(key, JSON.stringify(s));
      } catch {
        /* sem localStorage: a sessão vale só nesta aba */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* sem localStorage */
      }
    },
  };
}

export const configuredSource = import.meta.env.VITE_DATA_SOURCE as string | undefined;

export async function loadAccessClient(): Promise<AccessClient> {
  if (configuredSource === "supabase" || configuredSource === "mock") {
    const [repo, rec] = await Promise.all([import("../../../../src/lib/repositories"), import("../../../../src/lib/recovery")]);
    // Antes da primeira tela: liga o mock (se for o caso) e tira o token do endereço
    await repo.carregarModoDemonstracao();
    await rec.prepararRecuperacaoDeSenha();
    // `repo.data` é ligação viva: lida depois do carregamento, já é o mock
    const { data } = repo;
    return {
      kind: data.kind,
      auth: data.auth,
      users: data.users,
      store: realStore(data.kind),
      recovery: rec.recuperacaoEmAndamento,
      reads: data,
    };
  }
  const { demoClient } = await import("./demoClient");
  return demoClient;
}
