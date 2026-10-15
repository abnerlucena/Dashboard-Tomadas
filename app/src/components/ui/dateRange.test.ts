import { describe, expect, it } from "vitest";
import { checkTypedRange, maskBrDate, parseBrDate, rangeLabel } from "./dateRange";

describe("data digitada", () => {
  it("põe as barras enquanto digita e ignora letras", () => {
    expect(maskBrDate("10")).toBe("10");
    expect(maskBrDate("1001")).toBe("10/01");
    expect(maskBrDate("10012026")).toBe("10/01/2026");
    expect(maskBrDate("10/01/2026x9")).toBe("10/01/2026");
  });
  it("só aceita dia que existe", () => {
    expect(parseBrDate("10/01/2026")).toEqual(new Date(2026, 0, 10));
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("10/01/26")).toBeNull();
  });
  it("confere o período: limites, ordem e incompleto sem erro", () => {
    const min = new Date(2026, 0, 1);
    const max = new Date(2026, 11, 31);
    expect(checkTypedRange("10/01/2026", "10/11/2026", min, max)).toEqual({ range: { from: new Date(2026, 0, 10), to: new Date(2026, 10, 10) } });
    expect(checkTypedRange("10/01/2026", "10/1", min, max)).toEqual({ error: null });
    expect(checkTypedRange("10/11/2026", "10/01/2026", min, max)).toEqual({ error: "A data final vem antes da inicial." });
    expect(checkTypedRange("10/01/2025", "10/01/2026", min, max)).toEqual({ error: "Escolha datas entre 01/01/2026 e 31/12/2026." });
    expect(checkTypedRange("30/02/2026", "10/03/2026", min, max)).toEqual({ error: "Essa data não existe. Confira o dia e o mês." });
  });
  it("período em anos diferentes mostra o ano", () => {
    expect(rangeLabel({ from: new Date(2025, 11, 10), to: new Date(2026, 0, 10) })).toBe("10/12/2025 – 10/01/2026");
  });
});
