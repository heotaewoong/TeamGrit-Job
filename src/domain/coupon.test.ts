import { describe, it, expect } from "vitest";
import { calculateCouponDiscount, type Coupon } from "./coupon";

// HeoBrain Store 실제 판매 상품 가격을 그대로 사용한다.
const OPIC_BUNDLE = { code: "OPIC_BUNDLE", price: 9_900 };
const AWS_SAA_PDF = { code: "AWS_SAA_PDF", price: 900 };
const VOCAB_MASTER = { code: "VOCAB_MASTER", price: 9_900 };

function baseCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    code: "TEST10",
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: 0,
    expiresAt: new Date("2999-01-01T00:00:00Z"),
    isActive: true,
    ...overrides,
  };
}

describe("calculateCouponDiscount (순수 도메인 로직)", () => {
  it("정률 쿠폰: OPIc 번들 9,900원에 10% 쿠폰 적용 시 990원 할인, 8,910원 결제", () => {
    const result = calculateCouponDiscount({
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      coupon: baseCoupon({ type: "PERCENTAGE", value: 10 }),
    });

    expect(result.isApplied).toBe(true);
    expect(result.discountAmount).toBe(990);
    expect(result.finalAmount).toBe(8_910);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("정액 쿠폰: 영단어 마스터 9,900원에 500원 정액 쿠폰 적용 시 500원 할인", () => {
    const result = calculateCouponDiscount({
      productCode: VOCAB_MASTER.code,
      productPrice: VOCAB_MASTER.price,
      coupon: baseCoupon({ type: "FIXED", value: 500 }),
    });

    expect(result.isApplied).toBe(true);
    expect(result.discountAmount).toBe(500);
    expect(result.finalAmount).toBe(9_400);
  });

  it("경계값: 최소 주문금액과 상품가격이 '정확히 같으면' 쿠폰이 적용된다 (이상 조건)", () => {
    const result = calculateCouponDiscount({
      productCode: AWS_SAA_PDF.code,
      productPrice: AWS_SAA_PDF.price, // 900
      coupon: baseCoupon({ type: "FIXED", value: 100, minOrderAmount: 900 }),
    });

    expect(result.isApplied).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("경계값: 최소 주문금액보다 1원이라도 낮으면 쿠폰이 거절된다", () => {
    const result = calculateCouponDiscount({
      productCode: AWS_SAA_PDF.code,
      productPrice: AWS_SAA_PDF.price, // 900
      coupon: baseCoupon({ minOrderAmount: 901 }),
    });

    expect(result.isApplied).toBe(false);
    expect(result.rejectionReason).toBe("MIN_ORDER_AMOUNT_NOT_MET");
    expect(result.discountAmount).toBe(0);
    expect(result.finalAmount).toBe(AWS_SAA_PDF.price);
  });

  it("AWS SAA 900원 상품에 최소 주문금액 10,000원 쿠폰은 적용될 수 없다", () => {
    const result = calculateCouponDiscount({
      productCode: AWS_SAA_PDF.code,
      productPrice: AWS_SAA_PDF.price,
      coupon: baseCoupon({ minOrderAmount: 10_000 }),
    });

    expect(result.isApplied).toBe(false);
    expect(result.rejectionReason).toBe("MIN_ORDER_AMOUNT_NOT_MET");
  });

  it("만료된 쿠폰은 거절된다", () => {
    const result = calculateCouponDiscount({
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      coupon: baseCoupon({ expiresAt: new Date("2020-01-01T00:00:00Z") }),
      now: new Date("2026-08-16T00:00:00Z"),
    });

    expect(result.isApplied).toBe(false);
    expect(result.rejectionReason).toBe("EXPIRED_COUPON");
  });

  it("비활성화된 쿠폰은 거절된다", () => {
    const result = calculateCouponDiscount({
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price,
      coupon: baseCoupon({ isActive: false }),
    });

    expect(result.isApplied).toBe(false);
    expect(result.rejectionReason).toBe("INACTIVE_COUPON");
  });

  it("적용 대상 상품 목록에 없는 상품이면 거절된다", () => {
    const result = calculateCouponDiscount({
      productCode: AWS_SAA_PDF.code,
      productPrice: AWS_SAA_PDF.price,
      coupon: baseCoupon({ applicableProductCodes: [OPIC_BUNDLE.code] }),
    });

    expect(result.isApplied).toBe(false);
    expect(result.rejectionReason).toBe("PRODUCT_NOT_APPLICABLE");
  });

  it("최대 할인 한도가 있으면 정률 할인도 한도를 넘지 않는다", () => {
    const result = calculateCouponDiscount({
      productCode: OPIC_BUNDLE.code,
      productPrice: OPIC_BUNDLE.price, // 9,900
      coupon: baseCoupon({ type: "PERCENTAGE", value: 50, maxDiscountAmount: 2_000 }),
    });

    // 50% => 4,950원이 아니라 2,000원으로 캡핑되어야 한다.
    expect(result.discountAmount).toBe(2_000);
    expect(result.finalAmount).toBe(7_900);
  });

  it("경계값: 할인 금액이 상품가격을 넘어도 최종 결제금액은 0원 밑으로 내려가지 않는다", () => {
    const result = calculateCouponDiscount({
      productCode: AWS_SAA_PDF.code,
      productPrice: AWS_SAA_PDF.price, // 900
      coupon: baseCoupon({ type: "FIXED", value: 100_000, minOrderAmount: 0 }),
    });

    expect(result.finalAmount).toBe(0);
    expect(result.discountAmount).toBe(AWS_SAA_PDF.price); // 실제로 깎인 금액은 900원까지만
    expect(result.finalAmount).toBeGreaterThanOrEqual(0);
  });

  it("예외: 상품 가격이 0원 이하이면 RangeError를 던진다", () => {
    expect(() =>
      calculateCouponDiscount({
        productCode: OPIC_BUNDLE.code,
        productPrice: 0,
        coupon: baseCoupon(),
      })
    ).toThrow(RangeError);
  });

  it("예외: 정률 쿠폰의 할인율이 0~100 범위를 벗어나면 RangeError를 던진다", () => {
    expect(() =>
      calculateCouponDiscount({
        productCode: OPIC_BUNDLE.code,
        productPrice: OPIC_BUNDLE.price,
        coupon: baseCoupon({ type: "PERCENTAGE", value: 150 }),
      })
    ).toThrow(RangeError);
  });
});
