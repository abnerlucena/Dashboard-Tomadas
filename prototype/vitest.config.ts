import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes do protótipo (UI nova): lógica pura, sem navegador
export default defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
