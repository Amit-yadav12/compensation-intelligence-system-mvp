import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests import modules that transitively import @/db; the db module
// throws without DATABASE_URL, so provide a dummy — unit tests never connect.
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
