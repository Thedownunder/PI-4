import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração padrão para React + JSX automático
export default defineConfig({
  plugins: [react()],
});
