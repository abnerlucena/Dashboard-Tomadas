import { describe, expect, it } from "vitest";
import { filterLabel, filterToken, parseMachineFilter } from "./machineFilter";

const ids = ["m1", "m2", "m3", "m4", "m5", "m6"];
const machines = ids.map((id) => ({ id, name: `Máquina ${id}` }));

describe("filtro de máquinas do Histórico", () => {
  it("sem pedaço no endereço, todas entram", () => {
    expect([...parseMachineFilter(undefined, ids)]).toEqual(ids);
  });

  it("um id só mantém o link antigo do Histórico da máquina", () => {
    expect([...parseMachineFilter("m3", ids)]).toEqual(["m3"]);
    expect(filterToken(new Set(["m3"]), ids)).toBe("m3");
  });

  it("sem: tira as listadas, so: deixa só as listadas", () => {
    expect([...parseMachineFilter("sem:m2,m3", ids)]).toEqual(["m1", "m4", "m5", "m6"]);
    expect([...parseMachineFilter("so:m2,m3", ids)]).toEqual(["m2", "m3"]);
  });

  it("id que não existe é ignorado; lista vazia ou inválida volta a todas", () => {
    expect([...parseMachineFilter("sem:m2,zzz", ids)]).toEqual(["m1", "m3", "m4", "m5", "m6"]);
    expect([...parseMachineFilter("sem:zzz", ids)]).toEqual(ids);
    expect([...parseMachineFilter("so:", ids)]).toEqual(ids);
    expect([...parseMachineFilter("zzz", ids)]).toEqual(ids);
  });

  it("o link guarda o lado menor e volta ao mesmo conjunto", () => {
    expect(filterToken(new Set(ids), ids)).toBeNull();
    const semDois = new Set(ids.filter((id) => id !== "m2" && id !== "m3"));
    expect(filterToken(semDois, ids)).toBe("sem:m2,m3");
    const poucas = new Set(["m1", "m2"]);
    expect(filterToken(poucas, ids)).toBe("so:m1,m2");
    for (const set of [semDois, poucas, new Set(["m4", "m5", "m6"])]) {
      expect(new Set(parseMachineFilter(filterToken(set, ids) ?? undefined, ids))).toEqual(set);
    }
  });

  it("o texto do botão diz o que está na conta", () => {
    expect(filterLabel(new Set(ids), machines)).toBe("Todas");
    expect(filterLabel(new Set(), machines)).toBe("Nenhuma");
    expect(filterLabel(new Set(["m2"]), machines)).toBe("Máquina m2");
    expect(filterLabel(new Set(["m1", "m2", "m3", "m4", "m5"]), machines)).toBe("Sem 1 máquina");
    expect(filterLabel(new Set(["m1", "m2", "m3", "m4"]), machines)).toBe("Sem 2 máquinas");
    expect(filterLabel(new Set(["m1", "m2"]), machines)).toBe("2 máquinas");
  });
});
