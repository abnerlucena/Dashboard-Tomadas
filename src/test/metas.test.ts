import { describe, it, expect } from "vitest";
import { exigeOperadores, metaDoTurno, dependeDaLotacao, rotuloDaBase } from "@/lib/metas";

describe("a meta do turno conforme a base (D39, D47)", () => {
  it("per_shift: a lotação não muda nada", () => {
    const m = metaDoTurno({ cadastrada: 13000, base: "per_shift", pessoas: 5, lotacaoPadrao: 2 });
    expect(m.valor).toBe(13000);
    expect(m.dependeDaLotacao).toBe(false);
  });

  it("sem base informada, trata como per_shift", () => {
    expect(metaDoTurno({ cadastrada: 500 }).valor).toBe(500);
    expect(metaDoTurno({ cadastrada: 500, base: null, pessoas: 9 }).valor).toBe(500);
  });

  it("per_operator: A Granél, 25.000 por pessoa", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 3, lotacaoPadrao: 1 }).valor)
      .toBe(75000);
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 1, lotacaoPadrao: 1 }).valor)
      .toBe(25000);
  });

  it("per_shift_prorated: horizontal com 3 das 4 pessoas rende 7.500", () => {
    const m = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 3, lotacaoPadrao: 4 });
    expect(m.valor).toBe(7500);
    expect(m.pessoas).toBe(3);
    expect(m.lotacaoPadrao).toBe(4);
  });

  it("per_shift_prorated: com a lotação cheia é a meta cheia", () => {
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 4, lotacaoPadrao: 4 }).valor)
      .toBe(10000);
  });

  // D49: o teto. Quem limita a produção é a máquina, não a quantidade de gente
  // — pôr uma quinta pessoa numa embaladora não a faz embalar mais rápido.
  it("per_shift_prorated: gente ACIMA da lotação padrão não aumenta a meta", () => {
    for (const pessoas of [5, 6, 8, 20]) {
      expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas, lotacaoPadrao: 4 }).valor)
        .toBe(10000);
    }
  });

  it("per_shift_prorated: gente a MENOS continua reduzindo proporcionalmente", () => {
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 2, lotacaoPadrao: 4 }).valor)
      .toBe(5000);
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: 1, lotacaoPadrao: 4 }).valor)
      .toBe(2500);
  });

  // O teto é no NÚMERO DE PESSOAS, não no valor da meta: trocar a meta só muda
  // a escala. E o teto acompanha a lotação padrão, que vem do cadastro.
  it("per_shift_prorated: a regra não depende do valor da meta nem da lotação", () => {
    expect(metaDoTurno({ cadastrada: 15000, base: "per_shift_prorated", pessoas: 3, lotacaoPadrao: 4 }).valor)
      .toBe(11250);
    expect(metaDoTurno({ cadastrada: 15000, base: "per_shift_prorated", pessoas: 9, lotacaoPadrao: 4 }).valor)
      .toBe(15000);
    // Lotação padrão 5: o teto se move junto.
    expect(metaDoTurno({ cadastrada: 15000, base: "per_shift_prorated", pessoas: 5, lotacaoPadrao: 5 }).valor)
      .toBe(15000);
    expect(metaDoTurno({ cadastrada: 15000, base: "per_shift_prorated", pessoas: 4, lotacaoPadrao: 5 }).valor)
      .toBe(12000);
  });

  // O teto vale só para a base rateada. Por pessoa, mais gente É mais meta:
  // ali cada pessoa embala por conta própria (A Granél).
  it("per_operator NÃO tem teto: cada pessoa acrescenta", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 5, lotacaoPadrao: 1 }).valor)
      .toBe(125000);
  });

  it("sem pessoas informadas, cai na lotação padrão — não em uma pessoa", () => {
    // Rateada: lotação padrão = meta cheia.
    expect(metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: "", lotacaoPadrao: 4 }).valor)
      .toBe(10000);
    // Por pessoa: a lotação padrão é o palpite do banco (A Granél tem 1).
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: null, lotacaoPadrao: 2 }).valor)
      .toBe(50000);
  });

  it("meta desconhecida: depende de gente, e não há nem pessoas nem lotação", () => {
    const m = metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: "", lotacaoPadrao: null });
    // Mesmo palpite da view: × 1 — mas marcado, para a tela pedir o dado.
    expect(m.valor).toBe(25000);
    expect(m.estimada).toBe(true);
    expect(m.cadastrada).toBe(25000);
    const h = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: null, lotacaoPadrao: null });
    expect(h.valor).toBe(10000);
    expect(h.estimada).toBe(true);
  });

  // Espelha os casos 13 e 14 de supabase/tests/06_meta_por_lotacao.sql (D48):
  // 0 pessoas nunca vira meta 0, que tiraria o turno do atingimento.
  it("0 pessoas é não informado: cai na lotação padrão, igual à view", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 0, lotacaoPadrao: 1 }).valor)
      .toBe(25000);
    const h = metaDoTurno({ cadastrada: 10000, base: "per_shift_prorated", pessoas: "0", lotacaoPadrao: 4 });
    expect(h.valor).toBe(10000);
    expect(h.estimada).toBe(false);
  });

  it("texto inválido no campo de pessoas conta como não informado", () => {
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: "abc", lotacaoPadrao: 2 }).valor)
      .toBe(50000);
    // Fração é arredondada para baixo: meia pessoa não existe no chão de fábrica.
    expect(metaDoTurno({ cadastrada: 25000, base: "per_operator", pessoas: 2.7, lotacaoPadrao: 1 }).valor)
      .toBe(50000);
  });

  it("quais bases dependem de gente, e como se chamam na tela", () => {
    expect(dependeDaLotacao("per_operator")).toBe(true);
    expect(dependeDaLotacao("per_shift_prorated")).toBe(true);
    expect(dependeDaLotacao("per_shift")).toBe(false);
    expect(dependeDaLotacao(undefined)).toBe(false);
    expect(rotuloDaBase("per_operator")).toBe("por pessoa");
    expect(rotuloDaBase("per_shift_prorated")).toBe("conforme a lotação");
    expect(rotuloDaBase("per_shift")).toBeNull();
  });
});

// ─── D54: onde o número é obrigatório ───────────────────────────────────────
// Espelha public.exige_numero_de_operadores. O gestor confirmou em 01/10/2026
// que a lotação padrão da A Granél é 1 E que o posto tem rotatividade: as duas
// coisas juntas faziam um turno de 3 pessoas ser comparado com a meta de uma.
describe("exigeOperadores", () => {
  it("exige só onde a meta é por pessoa", () => {
    expect(exigeOperadores("per_operator")).toBe(true);
  });

  it("não exige onde a meta é rateada: esquecer deixa a meta cheia, nunca maior", () => {
    expect(exigeOperadores("per_shift_prorated")).toBe(false);
  });

  it("não exige na meta fixa: o campo nem entra na conta", () => {
    expect(exigeOperadores("per_shift")).toBe(false);
  });

  it("base ausente se comporta como meta fixa", () => {
    expect(exigeOperadores(undefined)).toBe(false);
    expect(exigeOperadores(null)).toBe(false);
  });
});
