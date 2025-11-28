import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (row: any) => void;
};

export default function AddPatientModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setContact("");
    setIsSubmitting(false);
    setErrorMsg(null);
  }, [open]);

  if (!open) return null;

  const canSave = !!name.trim() && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        name: name.trim(),
        phone: contact.trim(), // coluna correta no Supabase
      };

      const { data, error } = await supabase
        .from("patients")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error("Erro Supabase ao criar paciente:", error);
        throw error;
      }

      onCreated?.(data);
      onClose();
    } catch (err: any) {
      console.error("Erro geral ao salvar paciente:", err);
      setErrorMsg(
        `Erro ao salvar paciente. ${
          err?.message ? `(${err.message})` : "Tente novamente."
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Alterado para justify-end e pr-10
    <div className="fixed inset-0 z-50 flex items-center justify-end pr-10 bg-black/60">
      {/* MODAL ESCURO, OPACO */}
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 text-slate-100 shadow-2xl border border-slate-700">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-semibold">Novo paciente</h2>
            <p className="mt-1 text-sm text-slate-400">
              Cadastre um paciente para organizar suas reposições.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Nome do paciente
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Ex.: Maria Silva"
              required
            />
          </div>

          {/* Contato */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Telefone / forma de contato
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Telefone, WhatsApp, e-mail..."
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-rose-400">{errorMsg}</p>
          )}

          {/* Rodapé */}
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
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Salvando..." : "Criar paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}