import { describe, it, expect } from "vitest";
import { calculateCouponDiscount } from "./coupons";

// [실제 코드 대상 테스트]
// 대상: lib/coupons.ts의 calculateCouponDiscount (이미 운영 중인 실제 함수, 로컬 사본).
// 지금까지 이 함수에는 테스트가 하나도 없었다. 먼저 정상 동작을 굳히는 특성화
// 테스트를 쓰고, 그 다음 실제로 존재하는 경계값 결함 하나를 TDD Red-Green-Refactor로
// 고친다 (사본에서만 — 실제 lib/coupons.ts는 미수정).

describe("calculateCouponDiscount (실제 함수 — 정상 동작 특성화)", () => {
  it("정률 쿠폰: 9,900원에 10% 쿠폰이면 990원 할인", () => {
    expect(
      calculateCouponDiscount({ discount_type: "percentage", discount_value: 10, maximum_discount: null }, 9_900)
    ).toBe(990);
  });

  it("정액 쿠폰: 9,900원에 500원 정액 쿠폰이면 500원 할인", () => {
    expect(
      calculateCouponDiscount({ discount_type: "fixed", discount_value: 500, maximum_discount: null }, 9_900)
    ).toBe(500);
  });

  it("정액 할인이 상품가를 넘으면 상품가만큼만 할인된다 (0원 밑으로 안 내려감)", () => {
    expect(
      calculateCouponDiscount({ discount_type: "fixed", discount_value: 100_000, maximum_discount: null }, 900)
    ).toBe(900);
  });

  it("최대 할인 한도(maximum_discount)가 있으면 정률 할인도 그 한도를 넘지 않는다", () => {
    // 9,900원의 50% = 4,950원이지만 한도가 2,000원이므로 2,000원으로 캡핑되어야 한다.
    expect(
      calculateCouponDiscount({ discount_type: "percentage", discount_value: 50, maximum_discount: 2_000 }, 9_900)
    ).toBe(2_000);
  });

  it("subtotal이 0 이하면 할인은 0원이다", () => {
    expect(
      calculateCouponDiscount({ discount_type: "percentage", discount_value: 10, maximum_discount: null }, 0)
    ).toBe(0);
  });

  // ── 여기서부터 실제 결함 ─────────────────────────────────────────────
  // maximum_discount는 타입상 number | null이라 0도 유효한 값이다("이 쿠폰은
  // 할인 한도가 0원" = 사실상 정률 할인을 막는 설정). 그런데 실제 코드는
  //   coupon.maximum_discount ? Math.min(...) : rawDiscount
  // 로 truthy 체크를 하기 때문에 0은 null과 똑같이 "한도 없음"으로 처리된다.
  // 즉 관리자가 maximum_discount=0으로 설정해도 할인이 그대로 새어나간다.
  it("[RED] 최대 할인 한도가 0원이면 할인 금액도 0원으로 캡핑되어야 한다", () => {
    const discount = calculateCouponDiscount(
      { discount_type: "percentage", discount_value: 50, maximum_discount: 0 },
      9_900
    );

    expect(discount).toBe(0);
  });
});
