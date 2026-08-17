import path from "node:path";
import { defineConfig } from "vitest/config";

const repositoryRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(
        repositoryRoot,
        "task-a3-unit-tests/test-support/empty-module.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["task-a5-requirement-test-harness/generated/tests/**/*.test.ts"],
  },
});
