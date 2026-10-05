// ─── Mensagem de erro para mostrar na tela ────────────────────
// Em `catch`, o que vem não é garantidamente um Error: pode ser texto, um
// objeto do Supabase, ou qualquer coisa que alguém tenha lançado. Ler `.message`
// direto obriga a tipar o erro como `any` — e, quando não existe, a tela mostra
// "undefined" para quem está no chão de fábrica.
//
// Esta função é o único lugar que precisa saber disso.

export function mensagemDeErro(e: unknown, padrao = "Erro inesperado. Tente novamente."): string {
  if (e instanceof Error && e.message) return e.message;
  // Erros do Supabase chegam como objeto com `message`.
  if (typeof e === "object" && e !== null) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  if (typeof e === "string" && e) return e;
  return padrao;
}

/** O código do erro, quando quem lançou pôs um (ex.: `BADGE_REQUIRED`). */
export function codigoDoErro(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}
