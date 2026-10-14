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

describe("não produziu (D67)", () => {
  it("marcar a parada num apontamento com peças manda motivo, marcação e lista vazia", () => {
    const d = draftOf(original());
    d.stopOpen = true;
    d.stop = "Manutenção";
    d.stopPlanned = true;
    expect(changesOf(d, original())).toEqual({ ordensProducao: [], motivoParada: "Manutenção", paradaPlanejada: true });
  });

  it("exige o motivo quando o painel está aberto, e ignora as OPs em branco ou erradas", () => {
    const d = draftOf(original());
    d.stopOpen = true;
    d.rows[0].qty = "0";
    expect(validateDraft(d, original(), TODAY).stop).toBeTruthy();
    expect(validateDraft(d, original(), TODAY).rows).toEqual({});
    d.stop = "Sem OP";
    expect(validateDraft(d, original(), TODAY).any).toBe(false);
  });

  it("trocar só a marcação manda os dois campos; sem mudança, nada", () => {
    const o = original({ orders: [], stopReason: "Setup / troca", stopPlanned: true });
    const d = draftOf(o);
    expect(d.stopOpen).toBe(true);
    expect(changesOf(d, o)).toBeNull();
    d.stopPlanned = false;
    expect(changesOf(d, o)).toEqual({ motivoParada: "Setup / troca", paradaPlanejada: false });
  });

  it("desmarcar a parada manda motivo vazio; com peças novas, manda as OPs também", () => {
    const o = original({ orders: [], stopReason: "Sem OP", stopPlanned: false });
    const d = draftOf(o);
    d.stopOpen = false;
    d.stop = "";
    expect(changesOf(d, o)).toEqual({ motivoParada: "" });
    d.rows[0].op = "4512222";
    d.rows[0].qty = "900";
    expect(changesOf(d, o)).toEqual({ motivoParada: "", ordensProducao: [{ ordemId: "4512222", quantidade: 900, retrabalho: false }] });
  });
});

describe("OP não informada (ajuste temporário)", () => {
  it("o número reservado aparece como campo vazio e volta igual se nada mudar", () => {
    const o = original({ orders: [{ op: "0", quantity: 700, rework: false, note: "" }] });
    const d = draftOf(o);
    expect(d.rows[0].op).toBe("");
    expect(changesOf(d, o)).toBeNull();
  });

  it("linha com quantidade e sem OP é válida e vai como 0", () => {
    const o = original();
    const d = draftOf(o);
    d.rows = [newDraftRow({ qty: "900" })];
    expect(validateDraft(d, o, TODAY).any).toBe(false);
    expect(changesOf(d, o)?.ordensProducao).toEqual([{ ordemId: "0", quantidade: 900, retrabalho: false }]);
  });

  it("OP digitada errada continua recusada", () => {
    const o = original();
    const d = draftOf(o);
    d.rows = [newDraftRow({ op: "45A", qty: "900" })];
    expect(validateDraft(d, o, TODAY).any).toBe(true);
  });
});
