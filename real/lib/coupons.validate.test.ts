import { describe, it, expect, vi } from "vitest";
import { validateCouponCode, isCouponValidationFailure } from "./coupons";

// [가짜 객체를 어디에, 왜 끼웠는가]
// validateCouponCode는 Supabase(외부 DB)를 파라미터로 주입받는 구조다(생성자 주입과 동일한
// 형태). A-2 기준 그대로: DB 왕복은 외부 I/O라서 Mock, 할인 계산(calculateCouponDiscount)은
// 이 함수 내부에서 실제 그대로 호출되므로 Mock하지 않는다 — 즉 할인 금액이 틀리면 이
// 테스트도 같이 Red가 된다.
//
// Supabase의 쿼리 빌더는 `.from().select().eq().eq()...`처럼 메서드 체이닝이 되고,
// 체인 끝에서 await하면 그 자체로 Promise처럼 동작한다(thenable). 그 모양을 그대로
// 흉내내는 최소 체이너를 만든다.
function chainable<T>(result: T) {
  const promise = Promise.resolve(result);
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
  return builder;
}

interface MockCouponRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_amount: number;
  maximum_discount?: number | null;
  applies_to_product_id?: string | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  user_usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

function createSupabaseMock(opts: {
  coupon?: MockCouponRow | null;
  usageCount?: number;
}) {
  const { coupon = null, usageCount = 0 } = opts;

  // Mockito의 when(...).thenReturn(...)에 대응: 테이블 이름에 따라 다른 결과를 반환하도록 스텁.
  const from = vi.fn((table: string) => {
    if (table === "coupons") {
      return chainable({ data: coupon, error: coupon ? null : null });
    }
    if (table === "coupon_usages") {
      return chainable({ count: usageCount, error: null });
    }
    throw new Error(`테스트 목이 모르는 테이블: ${table}`);
  });

  return { from } as any;
}

function baseCouponRow(overrides: Partial<MockCouponRow> = {}): MockCouponRow {
  return {
    id: "coupon-1",
    code: "WELCOME10",
    name: "웰컴 10%",
    discount_type: "percentage",
    discount_value: 10,
    minimum_amount: 900,
    maximum_discount: null,
    is_active: true,
    ...overrides,
  };
}

describe("validateCouponCode (실제 함수 — Supabase는 Mock으로 격리)", () => {
  it("쿠폰 코드가 비어있으면 DB를 조회하지 않고 즉시 거절한다", async () => {
    const supabase = createSupabaseMock({});

    const result = await validateCouponCode({
      supabase,
      code: "   ",
      subtotal: 9_900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result) && result.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("로그인하지 않았으면 DB를 조회하지 않고 401을 반환한다", async () => {
    const supabase = createSupabaseMock({});

    const result = await validateCouponCode({
      supabase,
      code: "WELCOME10",
      subtotal: 9_900,
      userId: "",
    });

    expect(isCouponValidationFailure(result) && result.status).toBe(401);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("존재하지 않는 쿠폰 코드면 404를 반환한다", async () => {
    const supabase = createSupabaseMock({ coupon: null });

    const result = await validateCouponCode({
      supabase,
      code: "NOT_EXIST",
      subtotal: 9_900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result) && result.status).toBe(404);
  });

  it("만료된 쿠폰(valid_until이 과거)이면 400을 반환한다", async () => {
    const supabase = createSupabaseMock({
      coupon: baseCouponRow({ valid_until: "2020-01-01" }),
    });

    const result = await validateCouponCode({
      supabase,
      code: "WELCOME10",
      subtotal: 9_900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result) && result.error).toContain("만료");
  });

  it("경계값: 소계가 최소 주문금액과 '정확히 같으면' 쿠폰이 통과한다", async () => {
    const supabase = createSupabaseMock({
      coupon: baseCouponRow({ minimum_amount: 900 }),
    });

    const result = await validateCouponCode({
      supabase,
      code: "WELCOME10",
      subtotal: 900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result)).toBe(false);
  });

  it("경계값: 소계가 최소 주문금액보다 1원이라도 낮으면 거절한다", async () => {
    const supabase = createSupabaseMock({
      coupon: baseCouponRow({ minimum_amount: 901 }),
    });

    const result = await validateCouponCode({
      supabase,
      code: "WELCOME10",
      subtotal: 900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result) && result.status).toBe(400);
  });

  it("사용자의 쿠폰 사용 횟수가 한도(user_usage_limit)에 도달했으면 거절한다", async () => {
    const supabase = createSupabaseMock({
      coupon: baseCouponRow({ user_usage_limit: 1 }),
      usageCount: 1,
    });

    const result = await validateCouponCode({
      supabase,
      code: "WELCOME10",
      subtotal: 9_900,
      userId: "user-1",
    });

    expect(isCouponValidationFailure(result) && result.error).toContain("한도");
  });

  it("정상 케이스: 실제 calculateCouponDiscount로 계산된 할인/결제금액을 그대로 반환한다", async () => {
    const supabase = createSupabaseMock({
      coupon: baseCouponRow({ discount_type: "percentage", discount_value: 10, minimum_amount: 0 }),
    });

    const result = await validateCouponCode({
      supabase,
      code: "welcome10", // 소문자로 보내도 normalizeCouponCode가 처리
      subtotal: 9_900,
      userId: "user-1",
    });

    if (isCouponValidationFailure(result)) throw new Error("실패해서는 안 되는 케이스");
    expect(result.discountAmount).toBe(990);
    expect(result.finalAmount).toBe(8_910);
    // 행위 검증: 쿠폰 조회는 정확히 1번만 일어나야 한다.
    expect(supabase.from).toHaveBeenCalledWith("coupons");
  });
});
