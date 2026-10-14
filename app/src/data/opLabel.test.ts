import { describe, expect, it } from "vitest";
import { NO_OP, hasOp, opLabel } from "./machines";

describe("OP não informada", () => {
  it("o número reservado aparece como Não informado e não conta como OP", () => {
    expect(opLabel({ opId: NO_OP })).toBe("Não informado");
    expect(opLabel({ opId: "OP 0" })).toBe("Não informado");
    expect(hasOp({ opId: NO_OP })).toBe(false);
  });
  it("OP de verdade e linha sem OP seguem como antes", () => {
    expect(opLabel({ opId: "4511111" })).toBe("4511111");
    expect(opLabel({ opId: "" })).toBe("–");
    expect(hasOp({ opId: "4511111" })).toBe(true);
    expect(hasOp({ opId: "" })).toBe(false);
  });
});
