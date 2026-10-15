import { createContext, useContext } from "react";
import type { Shift } from "@/data/machines";
import type { Absence, Collaborator, CollaboratorDraft, Material, MaterialShortage } from "./occurrences";

export interface OccurrencesState {
  /** false com o banco, até ele ter as tabelas: as telas escondem a seção e o cadastro */
  available: boolean;
  collaborators: Collaborator[];
  absences: Absence[];
  shortages: MaterialShortage[];
  /** materiais conhecidos: os das OPs e os que já faltaram */
  materials: Material[];
  addCollaborator: (d: CollaboratorDraft) => Promise<Collaborator>;
  updateCollaborator: (id: string, d: CollaboratorDraft) => Promise<void>;
  setCollaboratorActive: (id: string, active: boolean) => Promise<void>;
  /** sem `id` cadastra; com `id` substitui */
  saveAbsence: (a: Omit<Absence, "id"> & { id?: string }) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;
  saveShortage: (s: Omit<MaterialShortage, "id"> & { id?: string }) => Promise<void>;
  removeShortage: (id: string) => Promise<void>;
}

// Contexto e hook ficam fora do provedor: um arquivo que exporta componente E
// hook perde o recarregamento a quente (react-refresh).
export const OccurrencesCtx = createContext<OccurrencesState | null>(null);

export function useOccurrences() {
  const ctx = useContext(OccurrencesCtx);
  if (!ctx) throw new Error("useOccurrences fora do OccurrencesProvider");
  return ctx;
}

/** As ocorrências de um turno (data aaaa-mm-dd) */
export function occurrencesOf(state: Pick<OccurrencesState, "absences" | "shortages">, date: string, shift: Shift) {
  return {
    absences: state.absences.filter((a) => a.date === date && a.shift === shift),
    shortages: state.shortages.filter((s) => s.date === date && s.shift === shift),
  };
}
