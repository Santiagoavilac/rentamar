import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  // Carga .env.local para que los tests de integración accedan a las credenciales.
  test: {
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
}));
