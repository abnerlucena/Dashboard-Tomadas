import { describe, expect, it } from "vitest";
import { changesOf, draftOf, newDraftRow, validateDraft, type EditOriginal } from "./editPlan";

const original = (o: Partial<EditOriginal> = {}): EditOriginal => ({
  orders: [
    { op: "4511111", quantity: 5000, rework: false, note: "troca de bobina" },
    { op: "4511112", quantity: 300, rework: true, note: "", reason: "Rebarba na peça" },
  ],
  date: "2026-10-02",
  shift: 2,
  overtime: false,
  operatorCount: 3,
  notes: "Parada de 20 min",
  ...o,
});
const TODAY = "2026-10-04";

describe("changesOf", () => {
  it("sem mudança, nada a salvar", () => {
    expect(changesOf(draftOf(original()), original())).toBeNull();
  });

  it("manda só o que mudou, e a lista inteira de OPs com a observação de cada uma", () => {
    const d = draftOf(original());
    d.rows[0].qty = "5200";
    d.shift = 3;
    const c = changesOf(d, original());
    expect(c).toEqual({
      turno: "TURNO 3",
      ordensProducao: [
        { ordemId: "4511111", quantidade: 5200, retrabalho: false, obs: "troca de bobina" },
        { ordemId: "4511112", quantidade: 300, retrabalho: true, motivoRetrabalho: "Rebarba na peça" },
      ],
    });
  });

  it("corrigir outra coisa não apaga o motivo do retrabalho; desmarcar o retrabalho não o manda", () => {
    const d = draftOf(original());
    d.rows[1].qty = "320";
    expect(changesOf(d, original())?.ordensProducao?.[1]).toEqual({
      ordemId: "4511112",
      quantidade: 320,
      retrabalho: true,
      motivoRetrabalho: "Rebarba na peça",
    });
    d.rows[1].rework = false;
    expect(changesOf(d, original())?.ordensProducao?.[1]).toEqual({ ordemId: "4511112", quantidade: 320, retrabalho: false });
  });

  it("observação vazia apaga; nº de pessoas vazio vira 0 (apaga)", () => {
    const d = draftOf(original());
    d.notes = "  ";
    d.people = "";
    expect(changesOf(d, original())).toEqual({ obs: "", operatorCount: 0 });
  });

  it("tirar todas as OPs manda lista vazia; linha em branco não conta", () => {
    const d = draftOf(original());
    d.rows = [newDraftRow()];
    expect(changesOf(d, original())).toEqual({ ordensProducao: [] });
  });

  it("data e hora extra", () => {
    const d = draftOf(original());
    d.date = "2026-10-01";
    d.overtime = true;
    expect(changesOf(d, original())).toEqual({ date: "2026-10-01", workMode: "overtime" });
  });
});

describe("validateDraft", () => {
  it("OP só com números, até 15 dígitos, e quantidade positiva", () => {
    const d = draftOf(original());
    d.rows[0].op = "45A";
    d.rows[1].qty = "0";
    d.rows.push(newDraftRow({ op: "1234567890123456", qty: "10" }));
    const e = validateDraft(d, original(), TODAY);
    expect(e.any).toBe(true);
    expect(e.rows[d.rows[0].key].op).toMatch(/só números/);
    expect(e.rows[d.rows[1].key].qty).toMatch(/maior que zero/);
    expect(e.rows[d.rows[2].key].op).toMatch(/15 dígitos/);
  });

  it("IMPORTADO só vale no apontamento importado", () => {
    const imported = original({ orders: [{ op: "IMPORTADO", quantity: 8000, rework: false, note: "" }] });
    const d = draftOf(imported);
    d.rows[0].qty = "7500";
    expect(validateDraft(d, imported, TODAY).any).toBe(false);
    const fromApp = draftOf(original());
    fromApp.rows[0].op = "IMPORTADO";
    expect(validateDraft(fromApp, original(), TODAY).any).toBe(true);
  });

  it("data futura e nº de pessoas fora da faixa", () => {
    const d = draftOf(original());
    d.date = "2026-10-05";
    d.people = "0";
    const e = validateDraft(d, original(), TODAY);
    expect(e.date).toMatch(/futuras/);
    expect(e.people).toMatch(/1 a 99/);
  });
});
