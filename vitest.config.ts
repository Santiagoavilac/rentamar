import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  // Carga .env.local para que los tests de integración accedan a las credenciales.
  test: {
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
}));
