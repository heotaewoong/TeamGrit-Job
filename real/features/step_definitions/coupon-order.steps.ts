import { Given, When, Then, type DataTable } from "@cucumber/cucumber";
import assert from "node:assert/strict";
// [핵심] 이 인수테스트는 새 도메인 코드를 만들지 않는다.
// A-3에서 단위테스트로 이미 검증한 real/lib/coupons.ts를 "그대로" import해서 쓴다.
// 같은 프로덕션 코드를 단위테스트는 함수 단위로, 이 인수테스트는 시나리오(고객 흐름)
// 단위로 다시 검증하는 것 — 그것이 이 과제의 핵심이다.
import { validateCouponCode, isCouponValidationFailure } from "../../lib/coupons";
// 주의: 아래 사이드이펙트 import가 없으면 world.ts 안의 setWorldConstructor(CouponWorld)가
// 실행되지 않는다. "import type"만 쓰면 esbuild/tsx가 타입 전용으로 보고 통째로 지워버려서,
// Cucumber가 기본 World(빈 객체)를 쓰게 되고 this.productPrices 등이 전부 undefined가 된다.
// (직접 겪은 버그 — 실행해서 원인을 찾았다.)
import "../support/world";
import type { CouponWorld } from "../support/world";
import type { FakeCouponRow } from "../support/fake-supabase";

const DISCOUNT_TYPE_KO: Record<string, "percentage" | "fixed"> = {
  정률: "percentage",
  정액: "fixed",
};

// ---------- Background / 준비 ----------

Given("로그인한 고객 {string}이 있다", function (this: CouponWorld, userId: string) {
  this.userId = userId;
});

Given("로그아웃 상태의 고객이 있다", function (this: CouponWorld) {
  this.userId = "";
});

Given("상품 {string}의 가격은 {int}원이다", function (this: CouponWorld, name: string, price: number) {
  this.productPrices.set(name, price);
});

Given("다음 쿠폰이 등록되어 있다:", function (this: CouponWorld, table: DataTable) {
  for (const row of table.hashes()) {
    const coupon: FakeCouponRow = {
      id: `coupon-${row["코드"]}`,
      code: row["코드"],
      name: row["코드"],
      discount_type: DISCOUNT_TYPE_KO[row["유형"]],
      discount_value: Number(row["값"]),
      minimum_amount: Number(row["최소주문금액"] || 0),
      maximum_discount: row["최대할인한도"] ? Number(row["최대할인한도"]) : null,
      is_active: true,
    };
    this.registerCoupon(coupon);
  }
});

Given("{string} 쿠폰은 {string}에 만료되었다", function (this: CouponWorld, code: string, date: string) {
  this.requireCoupon(code).valid_until = date;
});

Given(
  "{string} 쿠폰은 고객 1인당 {int}회까지만 사용할 수 있다",
  function (this: CouponWorld, code: string, limit: number) {
    this.requireCoupon(code).user_usage_limit = limit;
  }
);

Given(
  "고객 {string}은 {string} 쿠폰을 이미 {int}회 사용했다",
  function (this: CouponWorld, userId: string, code: string, count: number) {
    const coupon = this.requireCoupon(code);
    this.state.usageCounts.set(`${coupon.id}:${userId}`, count);
  }
);

Given("장바구니에 {string} {int}개가 담겨 있다", function (this: CouponWorld, productName: string, quantity: number) {
  const price = this.productPrices.get(productName);
  if (price === undefined) {
    throw new Error(`시나리오 순서 오류: "${productName}"의 가격이 아직 정의되지 않았다`);
  }
  this.cart.push({ productId: this.productId(productName), price, quantity });
});

// ---------- When ----------

When("고객이 쿠폰 코드 {string}을 적용해 주문한다", async function (this: CouponWorld, code: string) {
  this.lastResult = await validateCouponCode({
    supabase: this.supabase,
    code,
    subtotal: this.subtotal(),
    userId: this.userId,
    items: this.cart,
  });
});

// ---------- Then ----------
// 여기서 확인하는 건 오직 "최종 결과"뿐이다. supabase.from이 몇 번 불렸는지,
// 어떤 인자로 불렸는지는 인수테스트의 관심사가 아니다(그건 A-3 단위테스트의 몫이다).

Then("주문은 성공한다", function (this: CouponWorld) {
  assert.ok(this.lastResult, "아직 주문을 시도하지 않았다");
  const failed = isCouponValidationFailure(this.lastResult);
  assert.equal(failed, false, failed ? `성공해야 하는데 실패했다: ${(this.lastResult as any).error}` : undefined);
});

Then("주문은 거절된다", function (this: CouponWorld) {
  assert.ok(this.lastResult, "아직 주문을 시도하지 않았다");
  assert.equal(isCouponValidationFailure(this.lastResult), true, "거절되어야 하는데 성공했다");
});

Then("할인 금액은 {int}원이다", function (this: CouponWorld, amount: number) {
  const result = this.lastResult!;
  if (isCouponValidationFailure(result)) throw new Error(`실패 케이스라 할인 금액이 없다: ${result.error}`);
  assert.equal(result.discountAmount, amount);
});

Then("최종 결제 금액은 {int}원이다", function (this: CouponWorld, amount: number) {
  const result = this.lastResult!;
  if (isCouponValidationFailure(result)) throw new Error(`실패 케이스라 결제 금액이 없다: ${result.error}`);
  assert.equal(result.finalAmount, amount);
});

Then("실패 사유는 {string}이다", function (this: CouponWorld, message: string) {
  const result = this.lastResult!;
  if (!isCouponValidationFailure(result)) throw new Error("성공 케이스라 실패 사유가 없다");
  assert.equal(result.error, message);
});
