import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Domain-service tests only for now. Integration tests that need a
    // database land once a dedicated dev/test Supabase project exists.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
