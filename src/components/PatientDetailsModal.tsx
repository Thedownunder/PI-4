import { useState, useMemo, useEffect } from "react";
import { useBoard, Patient, Replacement, Fraction } from "../store/board";
import AddReplacementModal from "./AddReplacementModal";
import { supabase } from "../services/supabaseClient";

/* ---------- Helpers ---------- */
function fmt(dt: string) {
  const d = new Date(dt);
  const dia = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} ${hora}`;
}

function fmtMaybe(dt?: string) {
  return dt ? fmt(dt) : "Sem data definida";
}

function sumFractions(r: Replacement | null) {
  if (!r) return 0;
  return r.completedFractions.reduce((s, f) => s + f.duration, 0);
}

type ProfessionalOption = {
  id: string;
  name: string;
};

function isFull(r: Replacement) {
  return sumFractions(r) >= r.totalDuration;
}

function sortByDateDesc(a: Replacement, b: Replacement) {
  const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
  const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
  return db - da;
}

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string | null;
};

export default function PatientDetailsModal({
  open,
  onClose,
  patientId,
}: Props) {
  // hooks de estado global (sempre chamados, na mesma ordem)
  const getActive = useBoard((s) => s.getActiveReplacement);
  const getPending = useBoard((s) => s.getPendingMinutes);
  const add10 = useBoard((s) => s.addPartial10);
  const add50 = useBoard((s) => s.completeFull50);
  const addReplacementFromDb = useBoard((s) => s.addReplacementFromDb);

  // lista mais recente de pacientes (pra não usar snapshot)
  const allPatients = useBoard((s) =>
    s.board.lists.flatMap((l) => l.patients)
  );

  const [tab, setTab] = useState<"current" | "history">("current");
  const [openReplacement, setOpenReplacement] = useState(false);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);

  // encontra o paciente sempre a partir do estado atual do contexto
  const patient: Patient | null =
    allPatients.find((p) => p.id === patientId) ?? null;

  useEffect(() => {
    if (!openReplacement) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("professionals")
          .select("*");

        if (error) {
          console.error("Erro ao carregar profissionais:", error);
          return;
        }

        if (!cancelled) {
          const mapped =
            data?.map((p: any) => ({ id: p.id, name: p.name })) ?? [];
          setProfessionals(mapped);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar profissionais:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openReplacement]);

  // derivados só usam o patient encontrado (podem ser null)
  const active = patient ? getActive(patient) : null;
  const pending = patient ? getPending(patient) : 0;
  const done = sumFractions(active);

  const pct = useMemo(
    () =>
      active ? Math.round((done / (active.totalDuration || 50)) * 100) : 0,
    [active, done]
  );

  const fullSessions =
    patient?.replacements?.filter((r) => isFull(r)) ?? [];
  const partialSessions =
    patient?.replacements?.filter((r) => !isFull(r)) ?? [];

  const renderFractions = (fractions: Fraction[]) =>
    fractions.length ? (
      <ul className="mt-2 space-y-1 text-sm">
        {fractions.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-md bg-slate-800/70 px-3 py-1"
          >
            <span>+{f.duration} min</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-slate-400">
        Nenhuma fração registrada ainda.
      </p>
    );

  // se o modal está fechado ou o patient não foi encontrado, não renderiza
  if (!open || !patient) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
        <div className="w-full max-w-4xl rounded-2xl bg-slate-900 text-slate-50 shadow-2xl border border-slate-700">
          {/* HEADER */}
          <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-700">
            <div>
              <h2 className="text-2xl font-semibold">{patient.name}</h2>
              <p className="text-sm text-slate-400">
                Contato: {patient.contact || "—"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="px-6 py-5 space-y-5">
            {/* Botão Nova reposição (para ESTE paciente) */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setOpenReplacement(true)}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <span className="mr-2 text-lg">+</span>
                Nova reposição
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 border-b border-slate-800 flex space-x-6 text-sm">
              <button
                onClick={() => setTab("current")}
                className={`px-3 py-1 ${
                  tab === "current" ? "border-b-2 border-blue-500" : ""
                }`}
              >
                Sessão ativa
              </button>
              <button
                onClick={() => setTab("history")}
                className={`px-3 py-1 ${
                  tab === "history" ? "border-b-2 border-blue-500" : ""
                }`}
              >
                Histórico
              </button>
            </div>

            {/* CONTENT */}
            {tab === "current" ? (
              active ? (
                <div className="border rounded-lg p-4">
                  <p>
                    <span className="font-medium">Agendada: </span>
                    {fmtMaybe(active.scheduledAt)}
                  </p>

                  <p className="mt-1">
                    <span className="font-medium">Total: </span>
                    {active.totalDuration} min
                  </p>

                  {/* PROGRESS */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs">
                      <span>{done} min feitos</span>
                      <span>{pending} min pendentes</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Ações de fração */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() =>
                        add10(patient.id, new Date().toISOString())
                      }
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                    >
                      +10 min
                    </button>
                    <button
                      onClick={() =>
                        add50(patient.id, new Date().toISOString())
                      }
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                    >
                      Fechar sessão (50 min)
                    </button>
                  </div>

                  {/* FRAÇÕES */}
                  {renderFractions(active.completedFractions)}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  Nenhuma sessão ativa.
                </p>
              )
            ) : (
              <div className="space-y-4">
                {/* Históricos de sessões completas */}
                <div>
                  <h3 className="font-semibold mb-2">Sessões completas</h3>
                  {fullSessions.length ? (
                    <div className="space-y-2">
                      {fullSessions.sort(sortByDateDesc).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex justify-between text-sm">
                            <span>{fmtMaybe(r.scheduledAt)}</span>
                            <span className="text-slate-400">
                              {r.totalDuration} min
                            </span>
                          </div>
                          {renderFractions(r.completedFractions)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Nenhuma sessão completa registrada.
                    </p>
                  )}
                </div>

                {/* Históricos de sessões parciais */}
                <div>
                  <h3 className="font-semibold mb-2">Sessões parciais</h3>
                  {partialSessions.length ? (
                    <div className="space-y-2">
                      {partialSessions.sort(sortByDateDesc).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex justify-between text-sm">
                            <span>{fmtMaybe(r.scheduledAt)}</span>
                            <span className="text-slate-400">
                              {sumFractions(r)} / {r.totalDuration} min
                            </span>
                          </div>
                          {renderFractions(r.completedFractions)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Nenhuma sessão parcial.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE NOVA REPOSIÇÃO (travado neste paciente) */}
      <AddReplacementModal
        open={openReplacement}
        onClose={() => setOpenReplacement(false)}
        patientId={patient.id}
        patientName={patient.name}
        professionals={professionals}
        onCreated={(row) => {
          // garante que o estado global seja atualizado assim que a
          // reposição é criada no Supabase
          addReplacementFromDb(row);
        }}
      />
    </>
  );
}
