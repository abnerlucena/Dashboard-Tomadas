// ─── Tipos que a interface e a camada de dados compartilham ──────
// Só tipos. Até 05/10/2026 este arquivo também falava com o Google Apps
// Script (o sistema legado) e guardava a sessão e um cache do app antigo;
// tudo isso saiu quando o Apps Script foi aposentado (D64).
//
// Os formatos ainda são os que o Apps Script devolvia (status "ativo",
// turno "TURNO 1", data em texto): a interface converte a partir deles.
// Simplificá-los é mudança de contrato, a combinar com a sessão da interface.

export interface Session {
  token: string;
  nome: string;
  role: "admin" | "user";
  expiresAt?: string;
  // "gas" fica só enquanto a interface tiver ramos do Apps Script (ver DataSourceKind, D64).
  source?: "gas" | "supabase" | "mock";
  userId?: string;
  permissions?: string[];
  /**
   * Nome do perfil em português ("Gestor", "Distribuidor"). A tela mostrava
   * um rótulo deduzido das permissões, que acertava por acaso: duas pessoas
   * com o mesmo conjunto apareciam iguais mesmo tendo perfis diferentes.
   */
  roleName?: string;
  accountType?: "personal" | "shared" | "display";
}

export interface Machine {
  id: number;
  name: string;
  hasMeta: boolean;
  defaultMeta: number;
  status?: string;
  /** Só modo Supabase: lotação padrão do posto (`standard_operator_count`).
   *  Serve para ratear a meta das horizontais pela lotação real (D47). */
  standardOperatorCount?: number | null;
  /**
   * Linha do centro de trabalho (D37): montagem ou embalagem. Vem da coluna
   * `machines.process`, que todo centro tem. A interface agrupava pela linha
   * adivinhando pelo nome, e um centro renomeado mudaria de linha sem ninguém
   * pedir. "Granel" não é linha: é um agrupamento só de tela.
   */
  process?: "assembly" | "packaging";
}

export interface Holiday {
  id: string;
  date: string;
  label: string;
  type: "feriado" | "dia_anulado";
  createdBy?: string;
  createdAt?: string;
  // Modo Supabase: tipo original do evento e turnos afetados (vazio = dia inteiro).
  eventType?: "holiday" | "special_event" | "excluded_day";
  shiftIds?: number[];
  /**
   * De onde vem o evento (D61): feriado nacional, estadual (SC), municipal
   * (Itajaí) ou da empresa (paradas, férias coletivas). Só modo Supabase.
   */
  scope?: HolidayScope;
}

export type HolidayScope = "national" | "state" | "municipal" | "company";

export interface OrdemProducao {
  ordemId: string;
  quantidade: number;
  obs?: string;
  retrabalho?: boolean;
}

export interface ProdRecord {
  id?: string;
  date: string;
  turno: string;
  machineId: number;
  machineName: string;
  meta: number;
  producao: number;
  savedBy: string;
  savedAt?: string;
  editUser?: string;
  editTime?: string;
  obs?: string;
  ordensProducao?: OrdemProducao[];
  // Campos só do modo Supabase (ver src/lib/repositories/supabase/adapters.ts).
  workMode?: "regular" | "overtime";
  goodQuantity?: number;
  reworkQuantity?: number;
  /** Meta efetiva do turno: já multiplicada pelas pessoas quando a meta da
   *  máquina é por operador (A Granél, D39/D46). Diferente de `meta`, que vai a
   *  zero quando o apontamento não conta para meta (hora extra, dia anulado). */
  targetQuantity?: number;
  countsTowardTarget?: boolean;
  isExcludedDay?: boolean;
  operatorCount?: number | null;
}
