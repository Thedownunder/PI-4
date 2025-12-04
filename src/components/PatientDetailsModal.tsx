import { useState, useMemo, useEffect } from "react";
import { useBoard, Patient, Replacement, Fraction } from "../store/board";
import AddReplacementModal from "./AddReplacementModal";
import { supabase } from "../services/supabaseClient";

/* ---------- Helpers ---------- */
function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const getActive = useBoard((s) => s.getActiveReplacement);
  const getPending = useBoard((s) => s.getPendingMinutes);
  const upsertReplacement = useBoard((s) => s.upsertReplacement);
  const upsertFraction = useBoard((s) => s.upsertFraction);

  const allPatients = useBoard((s) =>
    s.board.lists.flatMap((l) => l.patients)
  );

  const [tab, setTab] = useState<"current" | "history">("current");
  const [openReplacement, setOpenReplacement] = useState(false);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [addingFraction, setAddingFraction] = useState(false);

  // Estado para o modal de data da fração (+10 min)
  const [showFractionDateModal, setShowFractionDateModal] = useState(false);
  const [fractionDate, setFractionDate] = useState("");

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

        if (error) throw error;

        if (!cancelled) {
          const mapped =
            data?.map((p: any) => ({ id: p.id, name: p.name })) ?? [];
          setProfessionals(mapped);
        }
      } catch (err) {
        console.error("Erro ao carregar profissionais:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openReplacement]);

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

  // Abre o modal de data para adicionar 10 minutos
  const openAddFractionModal = () => {
    const now = new Date();
    // Ajuste simples para fuso horário local no input datetime-local
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFractionDate(now.toISOString().slice(0, 16));
    setShowFractionDateModal(true);
  };

  const confirmAddFraction = () => {
    const d = new Date(fractionDate);
    if (isNaN(d.getTime())) {
      alert("Data inválida.");
      return;
    }
    handleAddMinutes(10, d.toISOString());
    setShowFractionDateModal(false);
  };

  // ----------------------------------------------------
  // ATUALIZAÇÃO OTIMISTA (Gera ID e envia)
  // ----------------------------------------------------
  const handleAddMinutes = async (minutes: number, dateOverride?: string) => {
    if (!active || addingFraction) return;

    const currentTotal = sumFractions(active);
    const maxDuration = active.totalDuration || 50;
    
    if (currentTotal >= maxDuration) {
      alert("Esta sessão já atingiu o tempo máximo.");
      return;
    }

    if (currentTotal + minutes > maxDuration) {
      alert(`Não é possível adicionar +${minutes} min. O tempo restante é de ${maxDuration - currentTotal} min.`);
      return;
    }

    setAddingFraction(true);

    const generatedId = crypto.randomUUID();
    
    // Se houver override (do popup de +10), usa ele.
    // Caso contrário (completar sessão), usa a data agendada (se houver) ou a atual.
    const fractionDateISO = dateOverride || active.scheduledAt || new Date().toISOString();

    // 1. Atualiza tela imediatamente com esse ID
    upsertFraction({
      id: generatedId,
      replacement_id: active.id,
      minutes: minutes,
      created_at: fractionDateISO
    });

    try {
      // 2. Envia para o banco FORÇANDO esse mesmo ID
      const { error } = await supabase.from("replacement_fractions").insert({
        id: generatedId,
        replacement_id: active.id,
        minutes: minutes,
        created_at: fractionDateISO 
      }).select().single();

      if (error) throw error;

    } catch (err) {
      console.error("Erro ao adicionar fração:", err);
      alert("Erro de conexão. A fração não foi salva.");
    } finally {
      setAddingFraction(false);
    }
  };

  const renderFractions = (fractions: Fraction[]) =>
    fractions.length ? (
      <ul className="mt-2 space-y-1 text-sm">
        {fractions.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-md bg-slate-800/70 px-3 py-1"
          >
            <span>+{f.duration} min</span>
            <span className="text-xs text-slate-500">
               {new Date(f.at).toLocaleDateString([], {day:'2-digit', month:'2-digit'})} {new Date(f.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-slate-400">
        Nenhuma fração registrada ainda.
      </p>
    );

  // Helper para renderizar histórico de frações nos cards do histórico
  const renderHistoryFractions = (fractions: Fraction[]) => {
    if (!fractions || fractions.length === 0) return null;
    return (
      <div className="mt-3 border-t border-slate-700/50 pt-2">
        <p className="mb-1 text-xs font-medium text-slate-400">Histórico de adições:</p>
        <ul className="space-y-1">
          {fractions.map((f) => (
            <li key={f.id} className="flex justify-between text-xs text-slate-300">
              <span>
                {new Date(f.at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })} {' '}
                {new Date(f.at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>+{f.duration} min</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (!open || !patient) return null;

  const isSessionFull = active ? done >= (active.totalDuration || 50) : false;
  const canAdd10 = active ? (done + 10 <= (active.totalDuration || 50)) : false;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-end pr-10 bg-black/60">
        <div className="w-full max-w-4xl rounded-2xl bg-slate-900 text-slate-50 shadow-2xl border border-slate-700 relative">
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

          <div className="px-6 py-5 space-y-5">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setOpenReplacement(true)}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                <span className="mr-2 text-lg">+</span>
                Nova reposição
              </button>
            </div>

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

            {tab === "current" ? (
              active ? (
                <div className="border rounded-lg p-4 bg-slate-800/20 border-slate-700">
                  <p>
                    <span className="font-medium text-slate-300">Agendada: </span>
                    {fmtMaybe(active.scheduledAt)}
                  </p>

                  <p className="mt-1">
                    <span className="font-medium text-slate-300">Meta: </span>
                    {active.totalDuration} min
                  </p>

                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{Math.min(done, active.totalDuration)} min feitos</span>
                      <span>{Math.max(0, pending)} min restantes</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          done > active.totalDuration ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    {done > active.totalDuration && (
                      <p className="mt-1 text-xs text-red-400">
                        Atenção: O tempo registrado excede a duração da sessão!
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    {/* Botão +10 min (apenas se não for FULL) -> Abre Modal de Data */}
                    {active.kind !== 'FULL' && (
                      <button
                        onClick={openAddFractionModal}
                        disabled={addingFraction || !canAdd10}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-800/50"
                      >
                        {addingFraction ? "..." : "+10 min"}
                      </button>
                    )}
                    
                    {/* Botão Completar -> Usa Data Inicial (sem modal) */}
                    <button
                      onClick={() => handleAddMinutes(Math.max(0, active.totalDuration - done))}
                      disabled={addingFraction || isSessionFull}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSessionFull ? "Sessão concluída" : "Completar sessão"}
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <h4 className="text-sm font-semibold mb-2 text-slate-300">Registro de parciais</h4>
                    {renderFractions(active.completedFractions)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-700 rounded-lg">
                  Nenhuma sessão ativa no momento.
                </p>
              )
            ) : (
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <h3 className="font-semibold mb-2 text-emerald-400">Sessões completas</h3>
                  {fullSessions.length ? (
                    <div className="space-y-2">
                      {fullSessions.sort(sortByDateDesc).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex justify-between text-sm">
                            <span>{fmtMaybe(r.scheduledAt)}</span>
                            <span className="text-emerald-400 font-medium">
                              {sumFractions(r)} min (Concluído)
                            </span>
                          </div>
                          {/* Exibe o histórico de frações nos cards do histórico */}
                          {renderHistoryFractions(r.completedFractions)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma.</p>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-amber-400">Sessões em andamento</h3>
                  {partialSessions.length ? (
                    <div className="space-y-2">
                      {partialSessions.sort(sortByDateDesc).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3"
                        >
                          <div className="flex justify-between text-sm">
                            <span>{fmtMaybe(r.scheduledAt)}</span>
                            <span className="text-amber-400">
                              {sumFractions(r)} / {r.totalDuration} min
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
                            <div 
                              className="h-full bg-amber-500 rounded-full" 
                              style={{ width: `${Math.min((sumFractions(r) / r.totalDuration) * 100, 100)}%` }}
                            />
                          </div>
                          {/* Exibe o histórico de frações nos cards do histórico */}
                          {renderHistoryFractions(r.completedFractions)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POPUP DE DATA para adicionar +10 min */}
      {showFractionDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-2xl border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-4">
              Registrar +10 minutos
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Data e hora da reposição
              </label>
              <input
                type="datetime-local"
                value={fractionDate}
                onChange={(e) => setFractionDate(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowFractionDateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-600 text-sm hover:bg-slate-500 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddFraction}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-medium hover:bg-emerald-500 text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <AddReplacementModal
        open={openReplacement}
        onClose={() => setOpenReplacement(false)}
        patientId={patient.id}
        patientName={patient.name}
        professionals={professionals}
        onCreated={(row) => upsertReplacement(row)}
      />
    </>
  );
}