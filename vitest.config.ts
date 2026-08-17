import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // 실제 HeoBrain 레포의 tsconfig "@/*" 경로 별칭과 동일하게 맞춘다.
      "@": path.resolve(__dirname, "task-a3-unit-tests/real"),
      // Next.js가 빌드 시 no-op으로 치환하는 "server-only"를 테스트 환경에서도 무해하게 만든다.
      "server-only": path.resolve(__dirname, "task-a3-unit-tests/test-support/empty-module.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["task-a3-unit-tests/**/*.test.ts"],
  },
});
