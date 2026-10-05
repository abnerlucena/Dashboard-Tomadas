import { describe, it, expect } from "vitest";
import { toAuthError } from "@/lib/repositories/supabase/helpers";
import { codigoDoErro, mensagemDeErro } from "@/lib/erros";

describe("mensagens de erro do login/cadastro (modo Supabase)", () => {
  it("limite de e-mails do Supabase tem mensagem própria", () => {
    expect(toAuthError({ message: "email rate limit exceeded" }).message).toMatch(/limite de envio de e-mails/);
  });
  it("outros limites continuam com a mensagem genérica", () => {
    expect(toAuthError({ message: "Request rate limit reached" }).message).toBe("Muitas tentativas em pouco tempo. Aguarde alguns minutos.");
  });
  it("senha errada e e-mail já cadastrado", () => {
    expect(toAuthError({ message: "Invalid login credentials" }).message).toBe("E-mail ou senha incorretos.");
    expect(toAuthError({ message: "User already registered" }).message).toBe("Este e-mail já está cadastrado.");
  });
});

// O helper que toda tela usa no catch. Antes cada uma lia `e.message` com o erro
// tipado como `any`, e mostrava "undefined" quando não havia mensagem.
describe("mensagem de erro para a tela", () => {
  it("usa a mensagem do Error", () => {
    expect(mensagemDeErro(new Error("Meta inválida."))).toBe("Meta inválida.");
  });
  it("aceita objeto com message (como os erros do Supabase)", () => {
    expect(mensagemDeErro({ message: "RLS negou a escrita." })).toBe("RLS negou a escrita.");
  });
  it("aceita texto solto", () => {
    expect(mensagemDeErro("falha feia")).toBe("falha feia");
  });
  it("cai no padrão quando não há mensagem nenhuma", () => {
    expect(mensagemDeErro(undefined, "Erro ao salvar")).toBe("Erro ao salvar");
    expect(mensagemDeErro({}, "Erro ao salvar")).toBe("Erro ao salvar");
    expect(mensagemDeErro(new Error(""), "Erro ao salvar")).toBe("Erro ao salvar");
  });
  it("lê o código quando quem lançou pôs um", () => {
    expect(codigoDoErro({ code: "BADGE_REQUIRED" })).toBe("BADGE_REQUIRED");
    expect(codigoDoErro(new Error("sem código"))).toBeUndefined();
  });
});
