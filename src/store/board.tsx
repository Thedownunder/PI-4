import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type Fraction = { id: string; at: string; duration: number }; // 10 min nas parciais

export type Replacement = {
  id: string;
  scheduledAt?: string;
  totalDuration: number; // sempre 50
  completedFractions: Fraction[]; // soma até 50
  closed?: boolean; // sessão encerrada
};

export type Patient = {
  id: string;
  name: string;
  contact?: string;
  mainProfessional?: string;
  replacements: Replacement[];
};

export type List = { id: number; title: string; patients: Patient[] };
export type Board = { year: number; lists: List[] };

const uid = () => crypto.randomUUID();

type Catalog = {
  patients: { id: string; name: string; contact: string }[];
  professionals: { id: string; name: string; specialty: string }[];
};

type NewPatientFromDb = {
  id: string;
  name: string;
  contact?: string | null;
  mainProfessional?: string | null;
  listId?: number | null;
};

type ReplacementRowFromDb = {
  id: string;
  patient_id: string;
  kind?: "full" | "partial" | null;
  minutes?: number | null;
  scheduled_for?: string | null;
  status?: string | null;
  list_id?: number | null;
};

type State = {
  board: Board;
  filter: string;
  catalog: Catalog;

  setFilter: (q: string) => void;

  /** Fluxo antigo baseado em catálogo estático */
  addPatientByIds: (args: {
    listId: number;
    professionalId: string;
    patientId: string;
    mode: "full" | "partial";
    partialAt?: string; // obrigatório quando mode = partial
  }) => void;

  /**
   * Novos helpers integrados ao Supabase (Realtime):
   */
  upsertPatient: (patientFromDb: NewPatientFromDb) => void;
  removePatient: (patientId: string) => void;

  upsertReplacement: (replacementFromDb: ReplacementRowFromDb) => void;
  removeReplacement: (replacementId: string) => void;

  addProfessional?: (prof: { id: string; name: string }) => void;

  addPartial10: (patientId: string, atISO: string) => void;
  completeFull50: (patientId: string, atISO?: string) => void;

  movePatient: (patientId: string, toListId: number, toIndex: number) => void;

  getActiveReplacement: (p: Patient) => Replacement | null;
  getPendingMinutes: (p: Patient) => number;
  getFractions: (p: Patient) => Fraction[];
};

/* ------------ helpers puros para trabalhar com Patient/Replacement --------- */

function getActiveReplacementForPatient(p: Patient): Replacement | null {
  if (!p.replacements?.length) return null;
  const last = p.replacements[p.replacements.length - 1];
  if (last.closed) return null;
  return last;
}

function getPendingMinutesForPatient(p: Patient): number {
  const r = getActiveReplacementForPatient(p);
  if (!r) return 0;
  const done = r.completedFractions.reduce((s, f) => s + f.duration, 0);
  return Math.max(0, r.totalDuration - done);
}

/* --------------------------- estado inicial --------------------------- */

type DataState = {
  board: Board;
  filter: string;
  catalog: Catalog;
};

function createInitialBoard(): Board {
  return {
    year: new Date().getFullYear(),
    lists: [
      { id: 1, title: "Reposições Pendentes", patients: [] },
      { id: 2, title: "Sem Pendências", patients: [] },
    ],
  };
}

function createInitialCatalog(): Catalog {
  return {
    patients: [],
    professionals: [],
  };
}

/* --------------------------- Contexto React --------------------------- */

const BoardContext = createContext<State | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState>(() => ({
    board: createInitialBoard(),
    filter: "",
    catalog: createInitialCatalog(),
  }));

  const value = useMemo<State>(() => {
    const getActiveReplacement = (p: Patient) =>
      getActiveReplacementForPatient(p);

    const getFractions = (p: Patient): Fraction[] =>
      getActiveReplacementForPatient(p)?.completedFractions ?? [];

    const getPendingMinutes = (p: Patient) => getPendingMinutesForPatient(p);

    // --- LÓGICA DE FILTRAGEM (BUSCA) ---
    const term = data.filter.toLowerCase().trim();

    // Cria uma versão filtrada das listas apenas para visualização
    const filteredLists = data.board.lists.map((list) => ({
      ...list,
      patients: list.patients.filter((p) => {
        if (!term) return true; // Se não tem busca, mostra tudo

        const matchName = p.name.toLowerCase().includes(term);
        const matchContact = p.contact?.toLowerCase().includes(term);
        const matchProf = p.mainProfessional?.toLowerCase().includes(term);

        return matchName || matchContact || matchProf;
      }),
    }));

    // O board "visível" é o que será retornado no contexto
    const visibleBoard = { ...data.board, lists: filteredLists };
    // -----------------------------------

    return {
      board: visibleBoard, // Retorna o board filtrado
      filter: data.filter,
      catalog: data.catalog,

      setFilter: (q: string) =>
        setData((prev) => ({
          ...prev,
          filter: q,
        })),

      /** Fluxo antigo (mantido p/ compatibilidade) */
      addPatientByIds: ({}) =>
        setData((prev) => {
          return prev;
        }),

      /* ----------------- REALTIME ACTIONS ----------------- */

      upsertPatient: (patientFromDb) =>
        setData((prev) => {
          const boardClone: Board = structuredClone(prev.board);
          const targetListId = patientFromDb.listId ?? 1;

          let existingPatient: Patient | undefined;
          let existingList: List | undefined;

          for (const list of boardClone.lists) {
            const p = list.patients.find((pp) => pp.id === patientFromDb.id);
            if (p) {
              existingPatient = p;
              existingList = list;
              break;
            }
          }

          if (existingPatient && existingList) {
            // ATUALIZAÇÃO
            existingPatient.name = patientFromDb.name;
            existingPatient.contact =
              patientFromDb.contact ?? existingPatient.contact;
            existingPatient.mainProfessional =
              patientFromDb.mainProfessional ?? existingPatient.mainProfessional;
          } else {
            // INSERÇÃO
            const targetList =
              boardClone.lists.find((l) => l.id === targetListId) ??
              boardClone.lists[0];

            if (targetList) {
              targetList.patients.push({
                id: patientFromDb.id,
                name: patientFromDb.name,
                contact: patientFromDb.contact ?? undefined,
                mainProfessional: patientFromDb.mainProfessional ?? undefined,
                replacements: [],
              });
            }
          }

          const updatedCatalogPatients = [
            ...prev.catalog.patients.filter((p) => p.id !== patientFromDb.id),
            {
              id: patientFromDb.id,
              name: patientFromDb.name,
              contact: patientFromDb.contact ?? "",
            },
          ];

          return {
            ...prev,
            board: boardClone,
            catalog: { ...prev.catalog, patients: updatedCatalogPatients },
          };
        }),

      removePatient: (patientId) =>
        setData((prev) => {
          const boardClone = structuredClone(prev.board);
          boardClone.lists.forEach((list) => {
            list.patients = list.patients.filter((p) => p.id !== patientId);
          });

          const updatedCatalogPatients = prev.catalog.patients.filter(
            (p) => p.id !== patientId
          );

          return {
            ...prev,
            board: boardClone,
            catalog: { ...prev.catalog, patients: updatedCatalogPatients },
          };
        }),

      upsertReplacement: (row) =>
        setData((prev) => {
          const b: Board = structuredClone(prev.board);
          const patientId = row.patient_id;
          if (!patientId) return prev;

          let foundPatient: Patient | undefined;
          for (const list of b.lists) {
            const p = list.patients.find((pp) => pp.id === patientId);
            if (p) {
              foundPatient = p;
              break;
            }
          }

          if (!foundPatient) return prev;

          const at = row.scheduled_for ?? new Date().toISOString();
          const kind: "full" | "partial" =
            row.kind === "partial" ? "partial" : "full";

          const minutes =
            typeof row.minutes === "number" && row.minutes > 0
              ? row.minutes
              : kind === "full"
              ? 50
              : 10;

          const totalDuration = 50;
          const completedFractions: Fraction[] = [
            {
              id: uid(),
              at,
              duration: minutes,
            },
          ];

          const done = minutes;
          const closed = kind === "full" && done >= totalDuration;

          const replacementData: Replacement = {
            id: row.id,
            scheduledAt: at,
            totalDuration,
            completedFractions,
            closed,
          };

          if (!foundPatient.replacements) {
            foundPatient.replacements = [];
          }

          const existingIdx = foundPatient.replacements.findIndex(
            (r) => r.id === row.id
          );

          if (existingIdx >= 0) {
            foundPatient.replacements[existingIdx] = replacementData;
          } else {
            foundPatient.replacements.push(replacementData);
          }

          return { ...prev, board: b };
        }),

      removeReplacement: (replacementId) =>
        setData((prev) => {
          const b = structuredClone(prev.board);
          b.lists.forEach((list) => {
            list.patients.forEach((p) => {
              if (p.replacements) {
                p.replacements = p.replacements.filter(
                  (r) => r.id !== replacementId
                );
              }
            });
          });
          return { ...prev, board: b };
        }),

      addProfessional: (prof) =>
        setData((prev) => ({
          ...prev,
          catalog: {
            ...prev.catalog,
            professionals: [
              ...prev.catalog.professionals.filter((p) => p.id !== prof.id),
              { id: prof.id, name: prof.name, specialty: "" },
            ],
          },
        })),

      addPartial10: (patientId, atISO) =>
        setData((prev) => {
          // Lógica local para adicionar parcial (feedback otimista)
          // O Realtime irá sobrescrever isso com o dado real do banco depois
          // Mas mantemos para interação imediata se necessário.
          if (!atISO) return prev;
          const b: Board = structuredClone(prev.board);

          for (const list of b.lists) {
            const p = list.patients.find((pp) => pp.id === patientId);
            if (!p) continue;

            const r = getActiveReplacementForPatient(p);
            if (!r) break;

            const done = r.completedFractions.reduce(
              (s, f) => s + f.duration,
              0
            );
            const remaining = Math.max(0, r.totalDuration - done);
            if (remaining === 0) break;

            const add = Math.min(10, remaining);
            r.completedFractions.push({ id: uid(), at: atISO, duration: add });

            if (done + add >= r.totalDuration) r.closed = true;
            break;
          }
          return { ...prev, board: b };
        }),

      completeFull50: (patientId, atISO) =>
        setData((prev) => {
          // Lógica local para completar sessão
          const b: Board = structuredClone(prev.board);

          for (const list of b.lists) {
            const p = list.patients.find((pp) => pp.id === patientId);
            if (!p) continue;

            const r = getActiveReplacementForPatient(p);
            if (!r) break;

            if (r.completedFractions.length > 0) break;

            const remaining = 50;
            r.completedFractions.push({
              id: uid(),
              at: atISO ?? new Date().toISOString(),
              duration: remaining,
            });
            r.closed = true;
            break;
          }
          return { ...prev, board: b };
        }),

      movePatient: (patientId, toListId, toIndex) =>
        setData((prev) => {
          const b: Board = structuredClone(prev.board);
          const fromList = b.lists.find((l) =>
            l.patients.some((p) => p.id === patientId)
          );
          if (!fromList) return prev;

          const i = fromList.patients.findIndex((p) => p.id === patientId);
          if (i === -1) return prev;

          const patient = fromList.patients.splice(i, 1)[0];
          const toList = b.lists.find((l) => l.id === toListId);
          if (!toList || !patient) return prev;

          toList.patients.splice(toIndex, 0, patient);
          return { ...prev, board: b };
        }),

      getActiveReplacement,
      getFractions,
      getPendingMinutes,
    };
  }, [data]);

  return (
    <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
  );
}

export function useBoard<T>(selector: (state: State) => T): T {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard deve ser usado dentro de BoardProvider");
  }
  return selector(ctx);
}