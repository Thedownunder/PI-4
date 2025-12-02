import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

import { useBoard, BoardProvider } from "../store/board";
import List from "../components/List";
import BoardHeader from "../components/BoardHeader";
import { supabase } from "../services/supabaseClient";
import AddPatientModal from "../components/AddPatientModal";
import AddReplacementModal from "../components/AddReplacementModal";
import AddProfessionalModal from "../components/AddProfessionalModal";

type BoardPageProps = {
  onLogout?: () => void;
};

type Professional = {
  id: string;
  name: string;
};

function BoardInner({ onLogout }: BoardPageProps) {
  const board = useBoard((s) => s.board);
  const movePatient = useBoard((s) => s.movePatient);

  const upsertPatient = useBoard((s) => s.upsertPatient);
  const removePatient = useBoard((s) => s.removePatient);
  const upsertReplacement = useBoard((s) => s.upsertReplacement);
  const removeReplacement = useBoard((s) => s.removeReplacement);
  const upsertFraction = useBoard((s) => s.upsertFraction);

  const addProfessionalToStore = useBoard(
    (s: any) => s.addProfessional ?? (() => {})
  );

  const allPatients = useBoard((s) =>
    s.board.lists.flatMap((l) => l.patients)
  );

  const [professionals, setProfessionals] = useState<Professional[]>([]);

  /* Sensores do DnD */
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 120, tolerance: 5 },
  });

  const sensors = useSensors(pointerSensor, touchSensor);

  /* Estado do drag overlay */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overListId, setOverListId] = useState<number | null>(null);

  /* Modais */
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isProfessionalModalOpen, setIsProfessionalModalOpen] = useState(false);
  const [replacementListId, setReplacementListId] = useState<number | null>(
    null
  );

  /* Carregamento inicial do Supabase */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // 1) Pacientes
        // Removido list_id pois a coluna é calculada automaticamente
        const { data: patientsRows, error: pErr } = await supabase
          .from("patients")
          .select("*");

        if (pErr) throw pErr;

        patientsRows?.forEach((row: any) => {
          if (cancelled) return;
          upsertPatient({
            id: row.id,
            name: row.name,
            contact: row.phone ?? undefined,
            mainProfessional: undefined,
            listId: undefined, // Automático
          });
        });

        // 2) Reposições com Frações (Join)
        const { data: replRows, error: rErr } = await supabase
          .from("replacements")
          .select("*, replacement_fractions(*)");

        if (rErr) throw rErr;

        replRows?.forEach((row: any) => {
          if (cancelled) return;

          const fractions = Array.isArray(row.replacement_fractions) 
            ? row.replacement_fractions 
            : [];

          upsertReplacement({
            id: row.id,
            patient_id: row.patient_id,
            kind: row.kind ?? null,
            minutes: row.minutes ?? null,
            scheduled_for: row.scheduled_for ?? null,
            status: row.status ?? null,
            list_id: null,
          }, fractions);
        });

        // 3) Profissionais
        const { data: profRows, error: profErr } = await supabase
          .from("professionals")
          .select("*");

        if (!profErr) {
          const mapped: Professional[] =
            profRows?.map((p: any) => ({
              id: p.id,
              name: p.name,
            })) ?? [];

          if (!cancelled) setProfessionals(mapped);

          mapped.forEach((p) => {
            if (cancelled) return;
            addProfessionalToStore(p);
          });
        }
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------- SUPABASE REALTIME SUBSCRIPTION ------------------- */
  useEffect(() => {
    const channel = supabase
      .channel("board-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients" },
        (payload) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const row = payload.new as any;
            upsertPatient({
              id: row.id,
              name: row.name,
              contact: row.phone,
              mainProfessional: undefined,
              listId: undefined, 
            });
          } else if (payload.eventType === "DELETE") {
            removePatient(payload.old.id);
          }
        }
      )
      // ... restante dos listeners mantidos iguais ...
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "replacements" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            upsertReplacement(payload.new as any);
          } else if (payload.eventType === "DELETE") {
            removeReplacement(payload.old.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "replacement_fractions" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            upsertFraction(payload.new as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Overlay do paciente sendo arrastado */
  const activePatient = useMemo(() => {
    if (!activeId) return null;

    for (const list of board.lists) {
      const patient = list.patients.find((p) => p.id === activeId);
      if (patient) return patient;
    }

    return null;
  }, [activeId, board.lists]);

  /* Drag handlers */
  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const over = e.over;
    if (!over) {
      setOverListId(null);
      return;
    }

    let listId: number | null = null;

    if (typeof over.id === "number") {
      listId = over.id;
    } else {
      const maybeList = board.lists.find((l) =>
        l.patients.some((p) => p.id === over.id)
      );
      if (maybeList) listId = maybeList.id;
    }

    setOverListId(listId);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverListId(null);
    // Movimentação desativada (automática)
  }

  return (
    <div className="min-h-screen bg-[#071827] text-slate-100">
      <BoardHeader
        onLogout={onLogout || (() => {})}
        onNewPatient={() => setIsPatientModalOpen(true)}
        onNewProfessional={() => setIsProfessionalModalOpen(true)}
      />

      <main className="px-6 pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pt-4">
            {board.lists.map((list) => (
              <List
                key={list.id}
                id={list.id}
                title={list.title}
                patients={list.patients}
                isOver={overListId === list.id}
                onNewReplacement={(listId) => setReplacementListId(listId)}
              />
            ))}
          </div>

          <DragOverlay>
            {activePatient ? (
              <div className="w-80 rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-lg">
                <div className="mb-1 font-semibold">{activePatient.name}</div>

                {activePatient.mainProfessional && (
                  <div className="mb-1 text-xs text-slate-300">
                    {activePatient.mainProfessional}
                  </div>
                )}

                {activePatient.contact && (
                  <div className="text-xs text-slate-400">
                    {activePatient.contact}
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Novo paciente */}
      <AddPatientModal
        open={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        onCreated={(row) => {
          upsertPatient({
            id: row.id,
            name: row.name,
            contact: row.phone ?? undefined,
            mainProfessional: undefined,
            listId: undefined, 
          });
        }}
      />

      {/* Novo profissional */}
      <AddProfessionalModal
        open={isProfessionalModalOpen}
        onClose={() => setIsProfessionalModalOpen(false)}
        onCreated={(row) => {
          const prof: Professional = { id: row.id, name: row.name };
          setProfessionals((prev) => [...prev, prof]);
          addProfessionalToStore(prof);
        }}
      />

      {/* Nova reposição */}
      <AddReplacementModal
        open={replacementListId !== null}
        onClose={() => setReplacementListId(null)}
        defaultListId={replacementListId ?? undefined}
        patients={allPatients}
        professionals={professionals}
        onCreated={(row) => {
          upsertReplacement(row);
        }}
      />
    </div>
  );
}

export default function Board(props: BoardPageProps) {
  return (
    <BoardProvider>
      <BoardInner {...props} />
    </BoardProvider>
  );
}