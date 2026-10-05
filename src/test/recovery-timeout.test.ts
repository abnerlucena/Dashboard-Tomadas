// A chegada pelo link de recuperação acontece ANTES de a tela montar (main.tsx
// espera `prepararRecuperacaoDeSenha()` para poder tirar o token do endereço).
// Sem limite de tempo, rede ruim ou Supabase fora do ar deixariam a pessoa
// olhando uma tela branca, sem mensagem nem botão.
//
// Aqui se testa o limite com relógio falso: nada espera 8 segundos de verdade.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Quanto o `getSession()` finge demorar em cada teste. */
let demora = 0;
/** O que ele devolve quando responde a tempo. */
let sessao: { user: { id: string } } | null = null;

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: () =>
        new Promise(resolve => setTimeout(() => resolve({ data: { session: sessao } }), demora)),
    },
  }),
}));
vi.mock("@/lib/repositories", () => ({ isSupabase: true, isMock: false }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  window.history.replaceState(null, "", "/?recuperar=1#access_token=abc&type=recovery");
});
afterEach(() => vi.useRealTimers());

/** Roda a preparação deixando o relógio falso avançar até ela terminar. */
async function preparar() {
  const mod = await import("@/lib/recovery");
  const p = mod.prepararRecuperacaoDeSenha();
  await vi.advanceTimersByTimeAsync(20000);
  await p;
  return mod.recuperacaoEmAndamento();
}

describe("limite de tempo na chegada pelo link (item 8 da revisão)", () => {
  it("responde a tempo com sessão: vai para a tela de senha nova", async () => {
    demora = 200;
    sessao = { user: { id: "u1" } };
    expect(await preparar()).toEqual({ tela: "novaSenha" });
  });

  it("responde a tempo sem sessão: link inválido", async () => {
    demora = 200;
    sessao = null;
    const r = await preparar();
    expect(r?.tela).toBe("recuperar");
    expect(r && "erro" in r && r.erro).toMatch(/expirou ou já foi usado/i);
  });

  // O caso que motivou o item: sem o limite, isto nunca terminaria e a tela
  // não montaria. Repare que a mensagem é OUTRA — dizer "o link expirou"
  // quando o problema foi a rede mandaria a pessoa para o caminho errado.
  it("demora demais: cai na tela de pedir novo e-mail, com a mensagem da demora", async () => {
    demora = 30000;
    sessao = { user: { id: "u1" } };
    const r = await preparar();
    expect(r?.tela).toBe("recuperar");
    expect(r && "erro" in r && r.erro).toMatch(/demorou para responder/i);
  });

  it("o token sai do endereço mesmo quando o servidor demora", async () => {
    demora = 30000;
    sessao = null;
    await preparar();
    // Token na barra do navegador e no histórico é o que não se quer deixar.
    expect(window.location.hash).toBe("#/");
    expect(window.location.href).not.toContain("access_token");
  });
});
