import { describe, it, expect } from "vitest";
import { contarNaoLidas, toWorkOrder, toWorkOrderMessage } from "@/lib/repositories/supabase/adapters";

// OPs (D62): o que o banco devolve, no formato que a tela usa.
const linhaOP = {
  id: "w1", order_number: "4501234", machine_id: 5, material_code: "10012345",
  material_description: "Módulo 4x2", planned_quantity: 20000, stage: "running",
  pause_reason: null, released_at: "2026-10-04T10:00:00Z", closed_at: null, source: "app",
  sap_synced_at: null, created_by: "u1", created_at: "2026-10-04T09:00:00Z",
  updated_by: null, updated_at: "2026-10-04T10:00:00Z",
  produced_quantity: 5000, rework_quantity: 300, entry_count: 2, last_entry_at: "2026-10-04T12:00:00Z",
};

describe("toWorkOrder", () => {
  it("traz a OP com o produzido e as não lidas", () => {
    expect(toWorkOrder(linhaOP, 2)).toMatchObject({
      id: "w1", orderNumber: "4501234", machineId: 5, materialCode: "10012345",
      plannedQuantity: 20000, producedQuantity: 5000, reworkQuantity: 300,
      stage: "running", source: "app", unread: 2,
    });
  });

  it("OP nascida no apontamento chega como 'a conferir'", () => {
    expect(toWorkOrder({ ...linhaOP, stage: "pending_review", source: "apontamento" }))
      .toMatchObject({ stage: "pending_review", source: "apontamento", unread: 0 });
  });

  it("OP sem apontamento tem produzido zero, não nulo", () => {
    expect(toWorkOrder({ ...linhaOP, produced_quantity: null, rework_quantity: null }).producedQuantity).toBe(0);
  });
});

describe("toWorkOrderMessage", () => {
  const names = new Map([["u1", "Gabriela Gestora"], ["u2", "Ana Operadora"]]);
  const base = { id: "m1", work_order_id: "w1", created_at: "2026-10-04T11:00:00Z", shift_id: null, is_rework: false };

  it("mensagem de alguém leva o nome", () => {
    expect(toWorkOrderMessage({ ...base, author_id: "u1", kind: "message", body: "Material às 10h." }, names))
      .toMatchObject({ kind: "message", author: "Gabriela Gestora", text: "Material às 10h." });
  });

  it("mensagem do sistema não tem autor", () => {
    expect(toWorkOrderMessage({ ...base, author_id: null, kind: "system", body: "OP liberada." }, names).author).toBe("");
  });

  it("a observação do operador vem com o turno e o retrabalho", () => {
    expect(toWorkOrderMessage({ ...base, author_id: "u2", kind: "operator_note", body: "Filme acabou", shift_id: 2, is_rework: true }, names))
      .toMatchObject({ kind: "operator_note", author: "Ana Operadora", shiftId: 2, rework: true });
  });
});

describe("contarNaoLidas", () => {
  const linhas = [
    { work_order_id: "w1", created_at: "2026-10-04T10:00:00Z", author_id: "u1" },
    { work_order_id: "w1", created_at: "2026-10-04T11:00:00Z", author_id: "u2" },
    { work_order_id: "w1", created_at: "2026-10-04T12:00:00Z", author_id: null },
    { work_order_id: "w2", created_at: "2026-10-04T09:00:00Z", author_id: "u2" },
  ];

  it("conta só o que veio depois da minha última leitura", () => {
    const lidas = new Map([["w1", "2026-10-04T10:30:00Z"]]);
    const n = contarNaoLidas(linhas, lidas, "eu");
    expect(n.get("w1")).toBe(2);
    expect(n.get("w2")).toBe(1);   // nunca li: tudo é novo
  });

  it("o que eu mesmo escrevi não conta como não lido", () => {
    expect(contarNaoLidas(linhas, new Map(), "u2").get("w1")).toBe(2);
  });
});
