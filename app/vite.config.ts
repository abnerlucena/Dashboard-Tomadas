import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// A interface do Dash de Produção: config, Tailwind e tokens próprios.
export default defineConfig(({ command, mode }) => ({
  root: __dirname,
  // Lê o .env.local da RAIZ do repositório, o mesmo do app: VITE_DATA_SOURCE,
  // VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY valem para as duas interfaces.
  // Sem isto o Vite procuraria em app/, e a variável seria ignorada calada.
  envDir: path.resolve(__dirname, ".."),
  // Publicado no GitHub Pages em /Dashboard-Tomadas/. O caminho precisa ser
  // absoluto: a recuperação de senha monta o link do e-mail com
  // origin + BASE_URL (src/lib/repositories/supabase/auth.ts), e "./" geraria um
  // endereço quebrado. O HTML único (--mode single) abre de qualquer pasta: "./".
  base: mode === "single" ? "./" : command === "build" ? "/Dashboard-Tomadas/" : "/",
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss({ config: path.resolve(__dirname, "tailwind.config.ts") }), autoprefixer()],
    },
  },
  resolve: {
    alias: [
      // Dados reais da planilha só em builds privados (arquivo local, fora do Git)
      ...(process.env.CAPACITY_DATA === "real"
        ? [{ find: /^\.\/capacityBaseline$/, replacement: path.resolve(__dirname, "src/features/capacity/capacityBaseline.local.ts") }]
        : []),
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  server: { port: 8090, strictPort: true },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    // HTML único (npm run build:html): tudo num arquivo só, inclusive o ECharts carregado sob demanda
    rollupOptions: mode === "single" ? { output: { inlineDynamicImports: true } } : {},
  },
}));
