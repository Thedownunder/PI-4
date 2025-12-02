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

  // Estados para o Modal de Confirmação de Fração (Data/Hora)
  const [showFractionDateModal, setShowFractionDateModal] = useState(false);
  const [pendingMinutesToAdd, setPendingMinutesToAdd] = useState(0);
  const [fractionDateInput, setFractionDateInput] = useState("");

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

  // Passo 1: Solicita a data/hora
  const handleRequestAddMinutes = (minutes: number) => {
    if (!active) return;

    const currentTotal = sumFractions(active);
    const maxDuration = active.totalDuration || 50;
    
    if (currentTotal >= maxDuration) {
      // Já está cheia
      return;
    }

    if (currentTotal + minutes > maxDuration) {
      // Ajusta para o que falta se tentar adicionar mais do que o possível
      // Mas se o botão já estiver desabilitado ou ajustado, isso é extra
      alert(`O tempo restante é de ${maxDuration - currentTotal} min.`);
      return;
    }

    // Prepara o modal
    setPendingMinutesToAdd(minutes);
    // Data atual como default (formato para datetime-local: YYYY-MM-DDThh:mm)
    const now = new Date();
    // Ajuste fuso horário simples para o input local
    const offset = now.getTimezoneOffset() * 60000;
    const localIso = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    
    setFractionDateInput(localIso);
    setShowFractionDateModal(true);
  };

  // Passo 2: Confirma e salva
  const handleConfirmAddMinutes = async () => {
    if (!active || addingFraction) return;
    
    setShowFractionDateModal(false);
    setAddingFraction(true);

    const generatedId = crypto.randomUUID();
    
    // Converte a data do input para ISO string completa
    const finalDate = new Date(fractionDateInput);
    const dateISO = !isNaN(finalDate.getTime()) 
      ? finalDate.toISOString() 
      : new Date().toISOString();

    // 1. Atualiza tela imediatamente
    upsertFraction({
      id: generatedId,
      replacement_id: active.id,
      minutes: pendingMinutesToAdd,
      created_at: dateISO
    });

    try {
      // 2. Envia para o banco
      const { error } = await supabase.from("replacement_fractions").insert({
        id: generatedId,
        replacement_id: active.id,
        minutes: pendingMinutesToAdd,
        created_at: dateISO 
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
      <ul className="mt-2 space-y-2 text-sm">
        {fractions.map((f) => (
          <li
            key={f.id}
            className="flex flex-col rounded-md bg-slate-800/70 px-3 py-2 border border-slate-700/50"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-emerald-400">+{f.duration} min</span>
              <span className="text-xs text-slate-400">
                 {/* Exibe Data e Hora conforme pedido */}
                 {new Date(f.at).toLocaleDateString('pt-BR', {
                   day: '2-digit', month: '2-digit', year: '2-digit',
                   hour: '2-digit', minute: '2-digit'
                 })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-sm text-slate-400">
        Nenhuma fração registrada ainda.
      </p>
    );

  if (!open || !patient) return null;

  const isSessionFull = active ? done >= (active.totalDuration || 50) : false;
  const canAdd10 = active ? (done + 10 <= (active.totalDuration || 50)) : false;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-end pr-10 bg-black/60">
        <div className="w-full max-w-4xl rounded-2xl bg-slate-900 text-slate-50 shadow-2xl border border-slate-700">
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
                    <button
                      onClick={() => handleRequestAddMinutes(10)}
                      disabled={addingFraction || !canAdd10}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-800/50"
                    >
                      {addingFraction ? "..." : "+10 min"}
                    </button>
                    
                    <button
                      onClick={() => handleRequestAddMinutes(Math.max(0, active.totalDuration - done))}
                      disabled={addingFraction || isSessionFull}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSessionFull ? "Sessão concluída" : "Completar sessão"}
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <h4 className="text-sm font-semibold mb-2 text-slate-300">Histórico desta sessão</h4>
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
                          <div className="flex justify-between text-sm mb-2">
                            <span>Início: {fmtMaybe(r.scheduledAt)}</span>
                            <span className="text-emerald-400 font-medium">
                              {sumFractions(r)} min (Concluído)
                            </span>
                          </div>
                          {/* Detalhes das frações no histórico geral também */}
                          {r.completedFractions.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-400">
                                <p className="mb-1 font-medium text-slate-500">Realizações:</p>
                                <ul className="grid grid-cols-2 gap-2">
                                    {r.completedFractions.map(f => (
                                        <li key={f.id}>
                                            +{f.duration} min em {new Date(f.at).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                          )}
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

      {/* Modal de Confirmação da Fração (Data/Hora) */}
      {showFractionDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-slate-800 p-5 shadow-2xl border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-4">
              Registrar {pendingMinutesToAdd} minutos
            </h3>
            
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">
                Quando essa parte da reposição foi realizada?
              </label>
              <input 
                type="datetime-local" 
                value={fractionDateInput}
                onChange={(e) => setFractionDateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowFractionDateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAddMinutes}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-sm font-medium"
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