// [REFACTOR 단계 완료]
// 동작(테스트 결과)은 그대로 두고, 검증 규칙을 의미 단위 함수로 분리해
// 리팩토링/디버깅/추가 규칙 확장이 쉬운 구조로 정리했다.
//
// 커밋 히스토리:
//   1) test: calculateCouponDiscount 실패하는 테스트 작성 (Red)
//   2) feat: calculateCouponDiscount 최소 구현으로 테스트 통과 (Green)
//   3) refactor: 검증 규칙을 단계별 함수로 분리, 중복 제거 (Refactor) <- 현재 파일

export type CouponType = "PERCENTAGE" | "FIXED";

export interface Coupon {
  code: string;
  type: CouponType;
  /** PERCENTAGE면 0~100 사이 할인율, FIXED면 원 단위 정액 할인 금액 */
  value: number;
  /** 이 금액 이상이어야 쿠폰 적용 가능 (경계값: 이상 O, 미만 X) */
  minOrderAmount: number;
  /** PERCENTAGE 쿠폰의 최대 할인 한도 (없으면 무제한) */
  maxDiscountAmount?: number;
  /** 적용 가능 상품 코드 목록 (없으면 전 상품 적용) */
  applicableProductCodes?: string[];
  expiresAt: Date;
  isActive: boolean;
}

export interface CalculateCouponDiscountParams {
  productCode: string;
  productPrice: number;
  coupon: Coupon;
  /** 테스트 재현성을 위해 주입 가능한 현재 시각. 기본값은 new Date() */
  now?: Date;
}

export type CouponRejectionReason =
  | "INACTIVE_COUPON"
  | "EXPIRED_COUPON"
  | "PRODUCT_NOT_APPLICABLE"
  | "MIN_ORDER_AMOUNT_NOT_MET";

export interface CouponDiscountResult {
  isApplied: boolean;
  discountAmount: number;
  finalAmount: number;
  rejectionReason?: CouponRejectionReason;
}

function assertValidInputs(productPrice: number, coupon: Coupon): void {
  if (productPrice <= 0) {
    throw new RangeError(`productPrice must be positive, got ${productPrice}`);
  }
  if (coupon.type === "PERCENTAGE" && (coupon.value < 0 || coupon.value > 100)) {
    throw new RangeError(`PERCENTAGE coupon value must be within 0-100, got ${coupon.value}`);
  }
  if (coupon.type === "FIXED" && coupon.value < 0) {
    throw new RangeError(`FIXED coupon value must be non-negative, got ${coupon.value}`);
  }
}

function findRejectionReason(
  params: CalculateCouponDiscountParams
): CouponRejectionReason | undefined {
  const { productCode, productPrice, coupon, now = new Date() } = params;

  if (!coupon.isActive) return "INACTIVE_COUPON";
  if (now > coupon.expiresAt) return "EXPIRED_COUPON";
  if (
    coupon.applicableProductCodes &&
    !coupon.applicableProductCodes.includes(productCode)
  ) {
    return "PRODUCT_NOT_APPLICABLE";
  }
  // 경계값 규칙: 최소 주문금액과 "같은" 경우는 허용(이상, >=), 그보다 낮을 때만 거절.
  // 이 부등호(<)가 A-3 4번 항목에서 의도적으로 뒤집어 결함을 주입하는 지점이다.
  if (productPrice < coupon.minOrderAmount) return "MIN_ORDER_AMOUNT_NOT_MET";

  return undefined;
}

function computeRawDiscount(productPrice: number, coupon: Coupon): number {
  if (coupon.type === "FIXED") {
    return coupon.value;
  }
  const percentageDiscount = Math.floor(productPrice * (coupon.value / 100));
  return coupon.maxDiscountAmount !== undefined
    ? Math.min(percentageDiscount, coupon.maxDiscountAmount)
    : percentageDiscount;
}

export function calculateCouponDiscount(
  params: CalculateCouponDiscountParams
): CouponDiscountResult {
  const { productPrice, coupon } = params;
  assertValidInputs(productPrice, coupon);

  const rejectionReason = findRejectionReason(params);
  if (rejectionReason) {
    return {
      isApplied: false,
      discountAmount: 0,
      finalAmount: productPrice,
      rejectionReason,
    };
  }

  const rawDiscount = computeRawDiscount(productPrice, coupon);
  // 할인 금액이 상품가를 넘어가더라도 최종 결제금액은 0원 아래로 내려가지 않는다.
  const discountAmount = Math.min(rawDiscount, productPrice);
  const finalAmount = productPrice - discountAmount;

  return {
    isApplied: true,
    discountAmount,
    finalAmount,
  };
}
