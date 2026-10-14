import { describe, expect, it } from "vitest";
import { TARGET_MACHINES, dayKey } from "@/data/machines";
import { ordersByDay } from "./panelDays";

describe("painel da máquina: ordens por dia", () => {
  const m1 = TARGET_MACHINES.find((m) => m.id === "m1")!;
  const days = ordersByDay(m1.orders);

  it("o total do dia é a produção boa, igual à aba Detalhado (D11)", () => {
    // Composé nº 1 em 27/03: 5.918 peças boas + 4.562 de retrabalho
    const d27 = days.find((d) => d.date.getDate() === 27)!;
    expect(d27.total).toBe(m1.daily.get(dayKey(new Date(2026, 2, 27))));
    for (const d of days) expect(d.total).toBe(m1.daily.get(dayKey(d.date)) ?? 0);
  });

  it("do dia mais recente para o mais antigo, com a chave do dia local", () => {
    const times = days.map((d) => d.date.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(days[0].key).toBe("2026-03-27");
  });
});
