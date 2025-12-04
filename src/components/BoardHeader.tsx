import { useEffect } from "react";
import { useBoard } from "../store/board";

type Props = {
  onLogout: () => void;
  onNewPatient: () => void;
  onNewProfessional: () => void;
};

export default function BoardHeader({
  onLogout,
  onNewPatient,
  onNewProfessional,
}: Props) {
  // força o tema escuro global (sem alternância)
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Ano exibido ao lado do título (fallback pro ano atual)
  const year = useBoard((s: any) => s.board?.year ?? new Date().getFullYear());

  // Filtro de busca; se não existir no store, viram no-ops seguros
  const filter = useBoard((s: any) => s.filter ?? "");
  const setFilter = useBoard(
    (s: any) => s.setFilter ?? ((_: string) => {})
  ) as (value: string) => void;

  const headerButtonClasses =
    "flex items-center gap-2 rounded-lg border border-white/70 px-4 py-2 text-sm font-medium " +
    "bg-transparent hover:bg-white/10 transition-colors";

  return (
    <header className="w-full bg-[#0b63b6] text-white shadow-md">
      <div className="flex items-center gap-4 px-6 py-3">
        {/* Logo + título + ano */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <span className="text-lg">📋</span>
          </div>

          <div className="flex flex-col">
            <span className="text-lg font-semibold leading-tight">
              Gestor de Reposições
            </span>
          </div>

          <span className="ml-3 rounded-lg bg-white/10 px-3 py-1 text-sm font-medium">
            {year}
          </span>
        </div>

        {/* Barra de busca */}
        <div className="ml-6 flex-1">
          <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
            <span className="text-white/80">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="opacity-80"
              >
                <path
                  fill="currentColor"
                  d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"
                />
              </svg>
            </span>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar paciente, contato ou profissional..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/70"
            />
          </div>
        </div>

        {/* Botões à direita */}
        <div className="flex items-center gap-3">
          {/* Sair */}
          <button
            type="button"
            onClick={onLogout}
            className={headerButtonClasses}
          >
            <span>⏏</span>
            <span>Sair</span>
          </button>

          {/* Novo profissional */}
          <button
            type="button"
            onClick={onNewProfessional}
            className={headerButtonClasses}
          >
            <span>👤</span>
            <span>Novo profissional</span>
          </button>

          {/* Novo paciente */}
          <button
            type="button"
            onClick={onNewPatient}
            className={headerButtonClasses}
          >
            <span>＋</span>
            <span>Novo paciente</span>
          </button>
        </div>
      </div>
    </header>
  );
}
