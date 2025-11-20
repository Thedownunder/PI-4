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
   * Novos helpers integrados ao Supabase:
   * - addPatient: recebe o registro retornado pelo insert da tabela patients
   * - addReplacementFromDb: recebe o registro retornado pelo insert da tabela replacements
   */
  addPatient: (patientFromDb: NewPatientFromDb) => void;
  addReplacementFromDb: (replacementFromDb: ReplacementRowFromDb) => void;

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
    patients: [
      { id: "p1", name: "Ana Souza", contact: "ana@exemplo.com" },
      { id: "p2", name: "Bruno Lima", contact: "(11) 99999-0000" },
      { id: "p3", name: "Carla Mendes", contact: "carla@exemplo.com" },
      { id: "p4", name: "Carlos", contact: "3" },
    ],
    professionals: [
      { id: "r1", name: "Mariana", specialty: "Fono" },
      { id: "r2", name: "Pedro", specialty: "TO" },
      { id: "r3", name: "Luiza", specialty: "Psico" },
    ],
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

    return {
      board: data.board,
      filter: data.filter,
      catalog: data.catalog,

      setFilter: (q: string) =>
        setData((prev) => ({
          ...prev,
          filter: q,
        })),

      /** Fluxo antigo, usando catálogo estático (mantido p/ compatibilidade) */
      addPatientByIds: ({
        listId,
        professionalId,
        patientId,
        mode,
        partialAt,
      }) =>
        setData((prev) => {
          const { catalog, board } = prev;
          const patientInfo = catalog.patients.find((p) => p.id === patientId);
          const profInfo = catalog.professionals.find(
            (r) => r.id === professionalId
          );
          if (!patientInfo || !profInfo) return prev;

          const base: Replacement = {
            id: uid(),
            totalDuration: 50,
            completedFractions: [],
            closed: false,
          };

          if (mode === "full") {
            base.completedFractions.push({
              id: uid(),
              at: new Date().toISOString(),
              duration: 50,
            });
            base.closed = true;
          } else {
            if (!partialAt) return prev;
            base.completedFractions.push({
              id: uid(),
              at: partialAt,
              duration: 10,
            });
          }

          const lists = board.lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  patients: [
                    ...l.patients,
                    {
                      id: uid(),
                      name: patientInfo.name,
                      contact: patientInfo.contact,
                      mainProfessional: profInfo.name,
                      replacements: [base],
                    },
                  ],
                }
              : l
          );

          return { ...prev, board: { ...board, lists } };
        }),

      addPatient: (patientFromDb) =>
        setData((prev) => {
          const boardClone: Board = structuredClone(prev.board);
          const targetListId = patientFromDb.listId ?? 1;

          const targetList =
            boardClone.lists.find((l) => l.id === targetListId) ??
            boardClone.lists[0];

          if (!targetList) {
            return { ...prev, board: boardClone };
          }

          const newPatient: Patient = {
            id: patientFromDb.id,
            name: patientFromDb.name,
            contact: patientFromDb.contact ?? undefined,
            mainProfessional: patientFromDb.mainProfessional ?? undefined,
            replacements: [],
          };

          if (!targetList.patients.some((p) => p.id === newPatient.id)) {
            targetList.patients.push(newPatient);
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

      addReplacementFromDb: (row) =>
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

          if (!foundPatient) {
            // paciente ainda não foi colocado no board
            return prev;
          }

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

          const replacement: Replacement = {
            id: row.id,
            scheduledAt: at,
            totalDuration,
            completedFractions,
            closed,
          };

          if (!foundPatient.replacements) {
            foundPatient.replacements = [];
          }
          foundPatient.replacements.push(replacement);

          return { ...prev, board: b };
        }),

      getActiveReplacement,
      getFractions,
      getPendingMinutes,

      addPartial10: (patientId, atISO) =>
        setData((prev) => {
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
          const b: Board = structuredClone(prev.board);

          for (const list of b.lists) {
            const p = list.patients.find((pp) => pp.id === patientId);
            if (!p) continue;

            const r = getActiveReplacementForPatient(p);
            if (!r) break;

            // bloqueia se já houver qualquer parcial
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
    };
  }, [data]);

  return (
    <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
  );
}

/**
 * Hook com a mesma assinatura que o do Zustand:
 *   useBoard((s) => s.algumaCoisa)
 */
export function useBoard<T>(selector: (state: State) => T): T {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard deve ser usado dentro de BoardProvider");
  }
  return selector(ctx);
}
