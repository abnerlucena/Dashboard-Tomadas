import { createContext, useContext } from "react";
import type { Shift } from "@/data/machines";
import type { Absence, Collaborator, CollaboratorDraft, Material, MaterialShortage } from "./occurrences";
import type { AbsenceInput, ShortageInput } from "./occurrencesApi";

export interface OccurrencesState {
  /** false até a fonte responder (ou se ela falhar): as telas mostram o estado */
  available: boolean;
  status: "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
  /** collaborators.manage: vê os nomes nas faltas, cadastra e inativa */
  canSeeNames: boolean;
  collaborators: Collaborator[];
  absences: Absence[];
  shortages: MaterialShortage[];
  /** materiais conhecidos: os das OPs e os que já faltaram */
  materials: Material[];
  /** As escritas lançam o erro do banco (mensagem pronta): a tela mostra como veio */
  addCollaborator: (d: CollaboratorDraft) => Promise<Collaborator>;
  updateCollaborator: (id: string, d: CollaboratorDraft) => Promise<void>;
  /** inativar devolve quantas faltas perderam o nome */
  setCollaboratorActive: (id: string, active: boolean) => Promise<number>;
  saveAbsence: (a: AbsenceInput) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;
  saveShortage: (s: ShortageInput) => Promise<void>;
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
