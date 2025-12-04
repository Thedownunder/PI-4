import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type Fraction = { id: string; at: string; duration: number };

export type Replacement = {
  id: string;
  kind?: string;
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
  kind?: string | null;
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
  
  // ALTERAÇÃO: Retorna lista de ativas, não apenas uma
  getActiveReplacements: (p: Patient) => Replacement[];
  
  getPendingMinutes: (p: Patient) => number;
  getFractions: (p: Patient) => Fraction[];
};

/* ------------ helpers puros --------- */
// ALTERAÇÃO: Helper agora retorna array de todas as abertas
function getActiveReplacementsForPatient(p: Patient): Replacement[] {
  if (!p.replacements?.length) return [];
  // Retorna todas que não estão fechadas (closed !== true)
  return p.replacements.filter((r) => !r.closed);
}

function getPendingMinutesForPatient(p: Patient): number {
  const activeList = getActiveReplacementsForPatient(p);
  if (!activeList.length) return 0;
  
  // Soma pendência de todas as ativas
  return activeList.reduce((totalPending, r) => {
    const done = r.completedFractions.reduce((s, f) => s + f.duration, 0);
    return totalPending + Math.max(0, r.totalDuration - done);
  }, 0);
}

// Helper interno para mover paciente com base no status
function checkAndMovePatient(board: Board, patientId: string) {
  let foundListIdx = -1;
  let foundPatientIdx = -1;
  let patient: Patient | undefined;

  // 1. Encontra o paciente
  for (let i = 0; i < board.lists.length; i++) {
    const pIdx = board.lists[i].patients.findIndex(p => p.id === patientId);
    if (pIdx >= 0) {
      foundListIdx = i;
      foundPatientIdx = pIdx;
      patient = board.lists[i].patients[pIdx];
      break;
    }
  }

  if (!patient || foundListIdx === -1) return;

  // 2. Verifica se tem alguma reposição ABERTA
  const hasPending = patient.replacements.some(r => !r.closed);
  const targetListId = hasPending ? 1 : 2; // 1 = Pendentes, 2 = Sem Pendências

  const currentListId = board.lists[foundListIdx].id;

  // 3. Se estiver na lista errada, move
  if (currentListId !== targetListId) {
    // Remove da lista atual
    board.lists[foundListIdx].patients.splice(foundPatientIdx, 1);
    
    // Adiciona na nova lista
    const targetList = board.lists.find(l => l.id === targetListId);
    if (targetList) {
      targetList.patients.push(patient);
    }
  }
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
    const getActiveReplacements = (p: Patient) => getActiveReplacementsForPatient(p);
    
    // getFractions agora retorna todas as frações de todas as ativas (apenas para manter compatibilidade se usado em outro lugar)
    const getFractions = (p: Patient): Fraction[] => {
      const actives = getActiveReplacementsForPatient(p);
      return actives.flatMap(r => r.completedFractions);
    };
    
    const getPendingMinutes = (p: Patient) => getPendingMinutesForPatient(p);

    // Filtragem
    const term = data.filter.toLowerCase().trim();
    const filteredLists = data.board.lists.map((list) => ({
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
          const boardClone: Board = structuredClone(prev.board);
          const targetListId = patientFromDb.listId ?? 2;
          let existingPatient: Patient | undefined;

          for (const list of boardClone.lists) {
            const p = list.patients.find((pp) => pp.id === patientFromDb.id);
            if (p) {
              existingPatient = p;
              p.name = patientFromDb.name;
              p.contact = patientFromDb.contact ?? p.contact;
              p.mainProfessional = patientFromDb.mainProfessional ?? p.mainProfessional;
              break;
            }
          }

          if (!existingPatient) {
            const targetList =
              boardClone.lists.find((l) => l.id === targetListId) ??
              boardClone.lists[1]; 
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
            kind: row.kind ?? undefined,
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

          checkAndMovePatient(b, patientId);

          return { ...prev, board: b };
        }),

      removeReplacement: (replacementId) =>
        setData((prev) => {
          const b = structuredClone(prev.board);
          let affectedPatientId: string | null = null;

          b.lists.forEach((l) => {
            l.patients.forEach((p) => {
              if (p.replacements) {
                const initialLen = p.replacements.length;
                p.replacements = p.replacements.filter((r) => r.id !== replacementId);
                if (p.replacements.length !== initialLen) {
                  affectedPatientId = p.id;
                }
              }
            });
          });

          if (affectedPatientId) {
            checkAndMovePatient(b, affectedPatientId);
          }

          return { ...prev, board: b };
        }),

      upsertFraction: (row) =>
        setData((prev) => {
          const b: Board = structuredClone(prev.board);
          let foundReplacement: Replacement | undefined;
          let affectedPatientId: string | null = null;

          outerLoop:
          for (const list of b.lists) {
            for (const p of list.patients) {
              if (!p.replacements) continue;
              const r = p.replacements.find(rep => rep.id === row.replacement_id);
              if (r) {
                foundReplacement = r;
                affectedPatientId = p.id;
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
          } else {
            foundReplacement.closed = false;
          }

          if (affectedPatientId) {
            checkAndMovePatient(b, affectedPatientId);
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

      movePatient: (patientId, toListId, toIndex) => setData((prev) => {
          const b = structuredClone(prev.board);
          const fromList = b.lists.find(l => l.patients.some(p => p.id === patientId));
          if(!fromList) return prev;
          
          const i = fromList.patients.findIndex(p => p.id === patientId);
          const p = fromList.patients.splice(i, 1)[0];
          
          const toList = b.lists.find(l => l.id === toListId);
          if(toList) toList.patients.splice(toIndex, 0, p);
          
          return { ...prev, board: b };
      }),

      getActiveReplacements,
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