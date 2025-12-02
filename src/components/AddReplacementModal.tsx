import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

type PatientOption = {
  id: string;
  name: string;
  contact?: string | null;
};

type ProfessionalOption = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultListId?: number;
  defaultPatientId?: string;
  patientId?: string;
  patientName?: string;
  patients?: PatientOption[];
  professionals?: ProfessionalOption[];
  onCreated?: (row: any) => void;
};

function nextRoundedTime(minutesStep = 10) {
  const d = new Date();
  d.setSeconds(0, 0);
  const m = Math.ceil(d.getMinutes() / minutesStep) * minutesStep;
  d.setMinutes(m);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AddReplacementModal({
  open,
  onClose,
  defaultListId,
  defaultPatientId,
  patientId,
  patientName,
  patients = [],
  professionals = [],
  onCreated,
}: Props) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedProfessionalId, setSelectedProfessionalId] =
    useState<string>("");
  const [kind, setKind] = useState<"FULL" | "PARTIAL">("FULL");
  const [scheduledFor, setScheduledFor] = useState<string>(nextRoundedTime(10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [internalProfessionals, setInternalProfessionals] =
    useState<ProfessionalOption[]>(professionals ?? []);

  useEffect(() => {
    setInternalProfessionals(professionals ?? []);
  }, [professionals]);

  useEffect(() => {
    const shouldFetch = open && (!professionals || professionals.length === 0);
    if (!shouldFetch) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.from("professionals").select("*");
        if (error) {
          console.error("Erro ao carregar profissionais dentro do modal:", error);
          return;
        }
        if (!cancelled) {
          const mapped: ProfessionalOption[] =
            data?.map((p: any) => ({
              id: p.id,
              name: p.name,
            })) ?? [];
          setInternalProfessionals(mapped);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar profissionais:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, professionals]);

  const effectivePatients: PatientOption[] =
    patients && patients.length > 0
      ? patients
      : patientId
      ? [{ id: patientId, name: patientName || "Paciente" }]
      : [];

  useEffect(() => {
    if (!open) return;
    const initialId = defaultPatientId ?? patientId ?? "";
    setSelectedPatientId(initialId);
    setSelectedProfessionalId("");
    setKind("FULL");
    setScheduledFor(nextRoundedTime(10));
    setIsSubmitting(false);
    setErrorMsg(null);
  }, [open, defaultPatientId, patientId]);

  if (!open) return null;

  // Lógica de minutos:
  // Se for FULL, o objetivo é 50.
  // Se for PARTIAL, o objetivo também é 50 (mas começa com 0 realizados).
  // A tabela 'replacements' guarda o OBJETIVO/META (minutes).
  const targetMinutes = 50; 

  const isDateValid =
    !!scheduledFor && !Number.isNaN(new Date(scheduledFor).getTime());

  const canSave =
    !!selectedPatientId &&
    !!selectedProfessionalId &&
    !!scheduledFor &&
    isDateValid &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const localDate = new Date(scheduledFor);
      if (Number.isNaN(localDate.getTime())) {
        throw new Error("Data/hora inválida.");
      }

      const scheduledIso = localDate.toISOString();

      const payload: any = {
        patient_id: selectedPatientId,
        professional_id: selectedProfessionalId,
        kind,
        minutes: targetMinutes, // Sempre 50 (meta)
        scheduled_for: scheduledIso,
      };

      // 1. Cria a Reposição (Container)
      const { data: replacementData, error } = await supabase
        .from("replacements")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      // 2. Se for SESSÃO COMPLETA, criamos a fração de 50 min automaticamente.
      //    Se for PARCIAL, não criamos nada agora (começa 0/50).
      if (kind === "FULL") {
        const { error: fracError } = await supabase
          .from("replacement_fractions")
          .insert({
            replacement_id: replacementData.id,
            minutes: 50,
          });
        
        if (fracError) {
          console.error("Erro ao criar fração da sessão completa:", fracError);
          // Não aborta tudo, mas avisa no console
        }
      }

      onCreated?.({ ...replacementData, list_id: defaultListId ?? null });
      onClose();
    } catch (err: any) {
      console.error("Erro geral ao salvar reposição:", err);
      setErrorMsg(
        `Erro ao salvar reposição. ${
          err?.message ? `(${err.message})` : "Tente novamente."
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const patientLocked = !!(defaultPatientId || patientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end pr-10 bg-black/60">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-semibold">
              Nova reposição {patientName ? ` – ${patientName}` : ""}
            </h2>
            <p className="text-sm text-slate-400">
              Crie a sessão. Se for parcial, você adicionará minutos depois.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Paciente
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                disabled={patientLocked}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
              >
                <option value="">Selecione um paciente</option>
                {effectivePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.contact ? ` • ${p.contact}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Profissional responsável
              </label>
              <select
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Selecione um profissional</option>
                {internalProfessionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Tipo de reposição
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setKind("FULL")}
                className={
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium " +
                  (kind === "FULL"
                    ? "border-sky-500 bg-sky-600/20 text-sky-100"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700")
                }
              >
                Sessão completa (50 min)
              </button>
              <button
                type="button"
                onClick={() => setKind("PARTIAL")}
                className={
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium " +
                  (kind === "PARTIAL"
                    ? "border-sky-500 bg-sky-600/20 text-sky-100"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700")
                }
              >
                Parcial (0/50 min)
              </button>
            </div>
            {kind === "PARTIAL" && (
              <p className="text-xs text-slate-500">
                A sessão iniciará vazia. Você poderá adicionar +10 minutos gradualmente.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Data e horário da reposição
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}

          <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Criando..." : "Criar reposição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}