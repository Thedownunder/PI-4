import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../services/supabaseClient";

export type Fraction = { id: string; at: string; duration: number };

export type Replacement = {
  id: string;
  scheduledAt?: string;
  totalDuration: number;
  completedFractions: Fraction[];
  closed?: boolean;
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

type FractionRowFromDb = {
  id: string;
  replacement_id: string;
  minutes: number;
  created_at: string;
};

type State = {
  board: Board;
  filter: string;
  catalog: Catalog;

  setFilter: (q: string) => void;
  addPatientByIds: (args: any) => void;

  upsertPatient: (patientFromDb: NewPatientFromDb) => void;
  removePatient: (patientId: string) => void;
  upsertReplacement: (
    replacementFromDb: ReplacementRowFromDb,
    initialFractions?: FractionRowFromDb[]
  ) => void;
  removeReplacement: (replacementId: string) => void;
  
  upsertFraction: (fractionFromDb: FractionRowFromDb) => void;

  addProfessional?: (prof: { id: string; name: string }) => void;
  movePatient: (patientId: string, toListId: number, toIndex: number) => void;
  getActiveReplacement: (p: Patient) => Replacement | null;
  getPendingMinutes: (p: Patient) => number;
  getFractions: (p: Patient) => Fraction[];
};

/* ------------ helpers puros --------- */
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

/* --------------------------- Estado Inicial --------------------------- */
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
  return { patients: [], professionals: [] };
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
    const getActiveReplacement = (p: Patient) => getActiveReplacementForPatient(p);
    const getFractions = (p: Patient): Fraction[] => getActiveReplacementForPatient(p)?.completedFractions ?? [];
    const getPendingMinutes = (p: Patient) => getPendingMinutesForPatient(p);

    // -------------------------------------------------------------
    // LÓGICA DE DISTRIBUIÇÃO AUTOMÁTICA
    // 1. Coletar todos os pacientes de todas as listas (flat)
    // 2. Redistribuir baseado em 'pendingMinutes'
    // -------------------------------------------------------------
    const allPatients = data.board.lists.flatMap((list) => list.patients);

    const pendingList: Patient[] = [];
    const doneList: Patient[] = [];

    for (const p of allPatients) {
      const pending = getPendingMinutesForPatient(p);
      if (pending > 0) {
        pendingList.push(p);
      } else {
        doneList.push(p);
      }
    }

    // Ordenação Alfabética (opcional, mas recomendada para listas automáticas)
    pendingList.sort((a, b) => a.name.localeCompare(b.name));
    doneList.sort((a, b) => a.name.localeCompare(b.name));

    // Recria as listas do Board visual
    const automatedLists: List[] = [
      { id: 1, title: "Reposições Pendentes", patients: pendingList },
      { id: 2, title: "Sem Pendências", patients: doneList },
    ];

    // Aplica filtro de busca
    const term = data.filter.toLowerCase().trim();
    const filteredLists = automatedLists.map((list) => ({
      ...list,
      patients: list.patients.filter((p) => {
        if (!term) return true;
        const matchName = p.name.toLowerCase().includes(term);
        const matchContact = p.contact?.toLowerCase().includes(term);
        return matchName || matchContact;
      }),
    }));

    const visibleBoard = { ...data.board, lists: filteredLists };

    return {
      board: visibleBoard,
      filter: data.filter,
      catalog: data.catalog,
      setFilter: (q: string) => setData((prev) => ({ ...prev, filter: q })),
      addPatientByIds: () => setData((prev) => prev),

      upsertPatient: (patientFromDb) =>
        setData((prev) => {
          // Armazenamos todos os pacientes na primeira lista internamente
          // A distribuição visual é feita no useMemo acima
          const boardClone = structuredClone(prev.board);
          
          // Remove se já existir para atualizar dados
          let all = boardClone.lists.flatMap(l => l.patients);
          const existingIdx = all.findIndex(p => p.id === patientFromDb.id);
          
          let patientObj: Patient;

          if (existingIdx >= 0) {
            patientObj = all[existingIdx];
            patientObj.name = patientFromDb.name;
            patientObj.contact = patientFromDb.contact ?? patientObj.contact;
            patientObj.mainProfessional = patientFromDb.mainProfessional ?? patientObj.mainProfessional;
          } else {
            patientObj = {
              id: patientFromDb.id,
              name: patientFromDb.name,
              contact: patientFromDb.contact ?? undefined,
              mainProfessional: patientFromDb.mainProfessional ?? undefined,
              replacements: [],
            };
            // Adiciona na lista 1 (storage default)
            boardClone.lists[0].patients.push(patientObj);
          }

          // Nota: Não precisamos remover e readicionar se já existe, 
          // pois estamos mutando a referência do objeto que já está dentro de boardClone
          
          return { ...prev, board: boardClone };
        }),

      removePatient: (patientId) =>
        setData((prev) => {
          const boardClone = structuredClone(prev.board);
          boardClone.lists.forEach((list) => {
            list.patients = list.patients.filter((p) => p.id !== patientId);
          });
          return { ...prev, board: boardClone };
        }),

      upsertReplacement: (row, initialFractions) =>
        setData((prev) => {
          const b = structuredClone(prev.board);
          
          // Helper para buscar paciente em qualquer lista
          let foundPatient: Patient | undefined;
          for (const list of b.lists) {
            foundPatient = list.patients.find((p) => p.id === row.patient_id);
            if (foundPatient) break;
          }
          
          if (!foundPatient) return prev;

          const dbMinutes = row.minutes && row.minutes > 0 ? row.minutes : 50;
          const targetDuration = Math.max(50, dbMinutes);

          if (!foundPatient.replacements) foundPatient.replacements = [];

          const existingIdx = foundPatient.replacements.findIndex((r) => r.id === row.id);
          
          let mappedFractions: Fraction[] = [];
          if (initialFractions) {
            mappedFractions = initialFractions.map(f => ({
              id: f.id,
              at: f.created_at,
              duration: f.minutes
            }));
          } else if (existingIdx >= 0) {
            mappedFractions = foundPatient.replacements[existingIdx].completedFractions;
          }

          const done = mappedFractions.reduce((acc, f) => acc + f.duration, 0);
          const closed = done >= targetDuration;

          const replacementData: Replacement = {
            id: row.id,
            scheduledAt: row.scheduled_for ?? new Date().toISOString(),
            totalDuration: targetDuration,
            completedFractions: mappedFractions,
            closed,
          };

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
          b.lists.forEach((l) => {
            l.patients.forEach((p) => {
              if (p.replacements) p.replacements = p.replacements.filter((r) => r.id !== replacementId);
            });
          });
          return { ...prev, board: b };
        }),

      upsertFraction: (row) =>
        setData((prev) => {
          const b = structuredClone(prev.board);
          let foundReplacement: Replacement | undefined;

          // Busca em todo o board
          outerLoop:
          for (const list of b.lists) {
            for (const p of list.patients) {
              if (!p.replacements) continue;
              const r = p.replacements.find(rep => rep.id === row.replacement_id);
              if (r) {
                foundReplacement = r;
                break outerLoop;
              }
            }
          }

          if (!foundReplacement) return prev;

          const fracIndex = foundReplacement.completedFractions.findIndex(f => String(f.id) === String(row.id));
          
          const newFraction: Fraction = {
            id: row.id,
            at: row.created_at,
            duration: row.minutes
          };

          if (fracIndex >= 0) {
            foundReplacement.completedFractions[fracIndex] = newFraction;
          } else {
            foundReplacement.completedFractions.push(newFraction);
          }

          const done = foundReplacement.completedFractions.reduce((acc, f) => acc + f.duration, 0);
          if (done >= foundReplacement.totalDuration) {
            foundReplacement.closed = true;
          }

          return { ...prev, board: b };
        }),

      addProfessional: (prof) => setData((prev) => {
         const exists = prev.catalog.professionals.some(p => p.id === prof.id);
         if(exists) return prev;
         return {
           ...prev,
           catalog: {
             ...prev.catalog,
             professionals: [...prev.catalog.professionals, { id: prof.id, name: prof.name, specialty: "" }]
           }
         };
      }),

      movePatient: (patientId, toListId, toIndex) => {
        // MODO AUTOMÁTICO:
        // Não permitimos mover pacientes manualmente entre colunas ou reordenar
        // pois a coluna é definida pelo status da reposição e a ordem é alfabética.
        console.log("Movimentação manual desativada: Colunas são automáticas.");
      },

      getActiveReplacement,
      getFractions,
      getPendingMinutes,
    };
  }, [data]);

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

export function useBoard<T>(selector: (state: State) => T): T {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoard deve ser usado dentro de BoardProvider");
  return selector(ctx);
}