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
  // REMOVIDO: const [kind, setKind] = useState<"FULL" | "PARTIAL">("FULL");
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
    // setKind("FULL"); -> Removido
    setScheduledFor(nextRoundedTime(10));
    setIsSubmitting(false);
    setErrorMsg(null);
  }, [open, defaultPatientId, patientId]);

  if (!open) return null;

  // Meta padrão de 50 minutos
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
        kind: "PARTIAL", // Padrão 'PARTIAL' para permitir edição flexível (0/50 min)
        minutes: targetMinutes, 
        scheduled_for: scheduledIso,
      };

      // 1. Cria a Reposição (Container)
      const { data: replacementData, error } = await supabase
        .from("replacements")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

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
              Agende a sessão. Você poderá registrar o tempo (parcial ou completo) no card do paciente.
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

          {/* SEÇÃO DE "TIPO" REMOVIDA DAQUI */}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              Data e horário da reposição original:
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