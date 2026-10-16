import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { mensagemDeErro } from "../../../../src/lib/erros";
import { DATA_END, DATA_ORIGIN, toIsoDate } from "@/data/machines";
import { useAccess } from "@/features/access/AccessContext";
import { useOps } from "@/features/ops/OpsStore";
import { tidyName, uniqueMaterials, type Absence, type Collaborator, type MaterialShortage } from "./occurrences";
import { DEMO_CONSUMABLES, backendApi, demoApi, type AbsenceInput, type OccurrencesApi } from "./occurrencesApi";
import { OccurrencesCtx, type OccurrencesState } from "./OccurrencesStore";

/** O banco aceita até 400 dias por leitura: a tela carrega os 400 até hoje (o Histórico e as contagens cabem nisso) */
const WINDOW_DAYS = 399;

/**
 * Fonte das ocorrências do turno e do cadastro de colaboradores. Com o banco,
 * o contrato `occurrences` (D70); na demonstração (e no mock), a fonte em
 * memória com as mesmas regras. Recarrega depois de cada escrita.
 */
export function OccurrencesProvider({ children }: { children: ReactNode }) {
  const { client, session, can } = useAccess();
  const { ops } = useOps();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const live = client.kind === "supabase" && !!client.reads?.occurrences;
  const api = useMemo<OccurrencesApi>(
    () => (live ? backendApi(client.reads!.occurrences, () => sessionRef.current) : demoApi(() => sessionRef.current)),
    // A sessão muda de objeto a cada renovação de token: a fonte lê a atual pela ref
    [live, client],
  );

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [shortages, setShortages] = useState<MaterialShortage[]>([]);
  const [status, setStatus] = useState<OccurrencesState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  /**
   * Quem não é gestor não recebe o nome das faltas. Logo depois de registrar, a
   * página ainda sabe quem foi: guarda aqui (só na memória) para a pessoa
   * conferir o que acabou de lançar. Ao recarregar, vale a regra do banco.
   */
  const memory = useRef(new Map<string, Pick<Absence, "collaboratorId" | "name" | "time" | "note">>());

  const end = toIsoDate(DATA_ORIGIN === "backend" ? new Date() : DATA_END);
  const start = useMemo(() => {
    const d = new Date(`${end}T12:00:00`);
    d.setDate(d.getDate() - WINDOW_DAYS);
    return toIsoDate(d);
  }, [end]);

  const load = useCallback(async () => {
    const [people, occ] = await Promise.all([api.listCollaborators(), api.listShiftOccurrences(start, end)]);
    setCollaborators(people);
    setAbsences(
      occ.absences.map((a) => {
        const known = a.id && !a.name ? memory.current.get(a.id) : undefined;
        return known ? { ...a, ...known } : a;
      }),
    );
    setShortages(occ.shortages);
  }, [api, start, end]);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    load()
      .then(() => alive && setStatus("ready"))
      .catch((e) => {
        if (!alive) return;
        setError(mensagemDeErro(e, "Não foi possível carregar as ocorrências."));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [load, attempt]);

  const materials = useMemo(
    () =>
      uniqueMaterials([
        ...ops.map((op) => ({ code: op.material, description: op.product.toUpperCase() })),
        ...(live ? [] : DEMO_CONSUMABLES),
        ...shortages.map((s) => ({ code: s.materialCode, description: s.materialDescription })),
      ]),
    [ops, shortages, live],
  );

  /** Escreve e recarrega; o erro do banco sobe para a tela */
  const write = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      const out = await fn();
      await load();
      return out;
    },
    [load],
  );

  const value = useMemo<OccurrencesState>(
    () => ({
      available: status === "ready",
      status,
      error,
      retry: () => setAttempt((n) => n + 1),
      canSeeNames: can("collaborators.manage"),
      collaborators,
      absences,
      shortages,
      materials,
      addCollaborator: async (d) => {
        const id = await write(() => api.createCollaborator(d));
        return { id, name: tidyName(d.name), badge: d.badge.trim() || null, shift: d.shift, process: d.process, active: true };
      },
      updateCollaborator: (id, d) => write(() => api.updateCollaborator(id, d)),
      setCollaboratorActive: (id, active) => write(() => api.setCollaboratorActive(id, active)),
      saveAbsence: async (a: AbsenceInput) => {
        await write(async () => {
          const id = await api.saveAbsence(a);
          const name = collaborators.find((c) => c.id === a.collaboratorId)?.name ?? null;
          memory.current.set(id, { collaboratorId: a.collaboratorId, name, time: a.time, note: a.note });
          return id;
        });
      },
      removeAbsence: async (id) => {
        await write(() => api.removeAbsence(id));
        memory.current.delete(id);
      },
      saveShortage: async (s) => {
        await write(() => api.saveShortage(s));
      },
      removeShortage: (id) => write(() => api.removeShortage(id)),
    }),
    [status, error, can, collaborators, absences, shortages, materials, write, api],
  );
  return <OccurrencesCtx.Provider value={value}>{children}</OccurrencesCtx.Provider>;
}
