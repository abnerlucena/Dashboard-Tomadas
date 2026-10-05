// ─── Fachada da camada de dados ───────────────────────────────
// Ponto único que as telas e o AuthContext usam para ler e gravar dados.
//
// Chave: variável de ambiente VITE_DATA_SOURCE
//   "supabase" → banco Supabase (precisa de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY)
//   "mock"     → dados de mentira para construir telas (ver ./mock/index.ts).
//                Só em desenvolvimento: um build de produção nunca liga o mock.
// Qualquer outro valor cai no Supabase, a única fonte real. Até 05/10/2026 o
// padrão era o Google Apps Script, aposentado (D64).
import type { DataSource, DataSourceKind } from "./types";
import { supabaseDataSource } from "./supabase";

function escolher(): DataSourceKind {
  const pedido = import.meta.env.VITE_DATA_SOURCE;
  // import.meta.env.DEV é falso em qualquer `vite build`: esquecer a variável
  // num .env nunca publica o site com contas de mentira.
  if (pedido === "mock" && import.meta.env.DEV) return "mock";
  return "supabase";
}

export const DATA_SOURCE: DataSourceKind = escolher();

export const isSupabase = DATA_SOURCE === "supabase";
export const isMock = DATA_SOURCE === "mock";
/** Modos com login por e-mail, cadastro com aprovação e permissões (D19–D23). */
export const usaAcessoPorEmail = isSupabase || isMock;

/**
 * A fonte de dados em uso.
 *
 * É `let` e não `const` de propósito: o modo de demonstração é carregado sob
 * demanda (ver `carregarModoDemonstracao`), e quem importa isto enxerga a
 * troca — em ESM, `import { data }` é uma ligação viva, não uma cópia.
 *
 * Nenhuma tela guarda esta referência: todas chamam `data.algo()` na hora.
 */
export let data: DataSource = supabaseDataSource;

/**
 * Carrega o modo de demonstração, se for o caso. Chamado uma vez em main.tsx,
 * antes de a tela montar.
 *
 * O `import()` aqui é dinâmico por um motivo concreto: com importação estática,
 * o empacotador punha as contas e a senha de mentira no pacote PUBLICADO.
 * O modo nunca ligava em produção — isso já estava protegido —, mas o arquivo
 * ia junto e era legível por quem abrisse o código do site. Porta trancada com
 * a chave pendurada do lado de fora.
 *
 * Como o `import()` está atrás de `isMock`, que é falso em qualquer build, o
 * empacotador consegue deixar esse pedaço fora do pacote.
 */
export async function carregarModoDemonstracao(): Promise<void> {
  // `import.meta.env.DEV` vira o literal `false` em qualquer build, então o
  // empacotador vê `if (false && ...)` e joga o bloco inteiro fora — junto com
  // o `import()` e tudo que ele alcança. Testar só `isMock` não bastava: o
  // empacotador não conseguia provar que aquilo nunca seria verdade, e as
  // contas de mentira continuavam no pacote publicado.
  if (import.meta.env.DEV && isMock) {
    const { mockDataSource } = await import("./mock");
    data = mockDataSource;
    console.warn("[dados] Modo de demonstração (mock): contas e senhas são de mentira. Ver src/lib/repositories/mock/contas.ts.");
  }
}

export { BadgeRequiredError } from "./supabase";
export type * from "./types";
