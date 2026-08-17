// Cucumber-JVM의 설정 파일(cucumber.properties / junit-platform.properties)에 대응.
// HeoBrain 실제 스택(Next.js/TypeScript)에 맞춰 Cucumber-JVM 대신 그 JS/TS 포트인
// @cucumber/cucumber(Cucumber.js)를 사용한다 — A-3에서 JUnit5 대신 Vitest를 쓴 것과
// 동일한 논리(스택만 다를 뿐 Given/When/Then, Step Definition 개념은 동일).
export default {
  import: ["task-a4-bdd-tests/real/features/step_definitions/**/*.ts"],
  paths: ["task-a4-bdd-tests/real/features"],
  format: ["summary", "progress-bar"],
};
