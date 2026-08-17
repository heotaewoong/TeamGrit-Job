// Execute from task-a5-requirement-test-harness:
// node --import ./generated/support/server-only-loader.mjs --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber.js --config ./generated/cucumber.mjs
export default { paths: ['generated/features/a4-coupon-order.feature'], import: ['generated/steps/a4-coupon-order.steps.ts'], format: ['progress'] };
