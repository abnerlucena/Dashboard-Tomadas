import { defineConfig, devices } from "@playwright/test";

// Teste de ponta a ponta da interface, no modo de demonstração (sem banco):
// abre o app de verdade no navegador e passa pelos caminhos principais.
// Porta própria, servidor próprio: nunca reaproveita um `npm run dev` aberto, que
// pode estar ligado ao banco ou ao mock
const PORT = 8095;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chromium já instalado na máquina (ex.: contêiner sem download): PW_CHROMIUM_PATH=/caminho/do/chromium
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    // VITE_DATA_SOURCE vazio: sempre a demonstração, mesmo com .env.local apontando para o banco
    command: `npx vite --config prototype/vite.config.ts --port ${PORT} --strictPort`,
    env: { VITE_DATA_SOURCE: "" },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
