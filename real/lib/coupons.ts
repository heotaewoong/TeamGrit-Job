// [로컬 사본 — 실제 파일 수정 아님]
// 원본: HeoBrain-Marketplace-vi / lib/coupons.ts (Google Drive, 2026-08-05 수정본)
// 구글 드라이브 커넥터로 read_file_content 해서 그대로 옮겨온 사본이다.
// 이 파일은 오직 로컬 테스트용이며, 실제 레포에는 어떤 변경도 반영하지 않았다.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CouponDiscountType = "percentage" | "fixed";

export interface PublicCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  minimum_amount: number;
  maximum_discount: number | null;
  applies_to_product_id: string | null;
}

interface CouponRecord extends Omit<PublicCoupon, "applies_to_product_id"> {
  usage_limit: number | null;
  usage_count: number | null;
  user_usage_limit: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  // DB에 컬럼이 없으면(마이그레이션 전) undefined — null(전체 적용)과 동일하게 처리
  applies_to_product_id?: string | null;
}

/** 쿠폰 할인 계산에 필요한 장바구니 구성 — price는 반드시 서버에서 조회한 단가여야 한다 */
export interface CouponCartItem {
  productId: string;
  price: number;
  quantity: number;
}

interface ValidateCouponParams {
  supabase: SupabaseClient<any, any, any>;
  code: string;
  subtotal: number;
  userId: string;
  /** 상품 지정 쿠폰 검증용. 전달되면 subtotal 대신 items 합계를 기준으로 계산한다 */
  items?: CouponCartItem[];
}

interface CouponValidationSuccess {
  coupon: PublicCoupon;
  discountAmount: number;
  finalAmount: number;
  error?: never;
  status?: never;
}

interface CouponValidationFailure {
  coupon?: never;
  discountAmount?: never;
  finalAmount?: never;
  error: string;
  status: number;
}

export type CouponValidationResult = CouponValidationSuccess | CouponValidationFailure;

export function isCouponValidationFailure(
  result: CouponValidationResult
): result is CouponValidationFailure {
  return typeof result.error === "string";
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function toWon(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// 관리자 쿠폰 폼의 <input type="date">는 "2026-07-20" 같은 날짜만 저장한다.
// new Date("2026-07-20")는 UTC 자정으로 해석되어 한국 시간 오전 9시가 경계가 되므로,
// 시작일은 그날 00:00 KST, 종료일은 그날 23:59:59 KST로 명시해 하루 전체를 포함시킨다.
// 이미 시각까지 포함된 값이면 그대로 사용한다.
function startOfDayKst(value: string) {
  return new Date(DATE_ONLY.test(value) ? `${value}T00:00:00+09:00` : value);
}

function endOfDayKst(value: string) {
  return new Date(DATE_ONLY.test(value) ? `${value}T23:59:59.999+09:00` : value);
}

function toPublicCoupon(coupon: CouponRecord): PublicCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description ?? null,
    discount_type: coupon.discount_type,
    discount_value: toWon(coupon.discount_value),
    minimum_amount: toWon(coupon.minimum_amount),
    maximum_discount: coupon.maximum_discount == null ? null : toWon(coupon.maximum_discount),
    applies_to_product_id: coupon.applies_to_product_id ?? null,
  };
}

export function calculateCouponDiscount(
  coupon: Pick<PublicCoupon, "discount_type" | "discount_value" | "maximum_discount">,
  subtotal: number
) {
  const safeSubtotal = toWon(subtotal);
  const discountValue = toWon(coupon.discount_value);

  if (safeSubtotal <= 0 || discountValue <= 0) return 0;

  if (coupon.discount_type === "percentage") {
    const rawDiscount = Math.floor((safeSubtotal * discountValue) / 100);
    // [Green: 로컬 사본 수정] truthy 체크(`coupon.maximum_discount ? ... : ...`) 대신
    // null/undefined만 "한도 없음"으로 취급한다. 0은 유효한 한도값(할인 전액 차단)이므로
    // 반드시 캡핑되어야 한다. 실제 lib/coupons.ts에는 아직 반영하지 않았다.
    const cappedDiscount =
      coupon.maximum_discount != null
        ? Math.min(rawDiscount, toWon(coupon.maximum_discount))
        : rawDiscount;
    return Math.min(cappedDiscount, safeSubtotal);
  }

  return Math.min(discountValue, safeSubtotal);
}

function sumLineItems(items: CouponCartItem[]) {
  return toWon(
    items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * Math.max(1, Math.floor(Number(item.quantity) || 1)),
      0
    )
  );
}

export async function validateCouponCode({
  supabase,
  code,
  subtotal,
  userId,
  items,
}: ValidateCouponParams): Promise<CouponValidationResult> {
  const normalizedCode = normalizeCouponCode(code);
  // items가 오면 그 합계를 소계로 사용 — 전달된 subtotal과의 불일치(드리프트)를 원천 차단
  const safeSubtotal = items && items.length > 0 ? sumLineItems(items) : toWon(subtotal);

  if (!normalizedCode) {
    return { error: "쿠폰 코드를 입력해주세요.", status: 400 };
  }

  if (!userId) {
    return { error: "로그인이 필요합니다.", status: 401 };
  }

  if (safeSubtotal <= 0) {
    return { error: "주문 금액을 확인할 수 없습니다.", status: 400 };
  }

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  const coupon = data as CouponRecord | null;

  if (error || !coupon) {
    return { error: "유효하지 않은 쿠폰 코드입니다.", status: 404 };
  }

  const now = new Date();
  if (coupon.valid_from && startOfDayKst(coupon.valid_from) > now) {
    return { error: "아직 사용할 수 없는 쿠폰입니다.", status: 400 };
  }

  if (coupon.valid_until && endOfDayKst(coupon.valid_until) < now) {
    return { error: "만료된 쿠폰입니다.", status: 400 };
  }

  // 상품 지정 쿠폰: 대상 상품의 라인 금액이 할인·최소금액 판정의 기준.
  // 전체 소계로 판정하면 무관한 상품을 채워 최소금액을 우회하거나 과다 할인이 가능해진다.
  // 장바구니 구성(items) 없이 들어온 요청은 안전하게 거절한다 (fail-safe).
  const scopeProductId = coupon.applies_to_product_id ?? null;
  let eligibleSubtotal = safeSubtotal;
  if (scopeProductId) {
    if (!items || items.length === 0) {
      return { error: "특정 상품 전용 쿠폰입니다. 장바구니에서 적용해주세요.", status: 400 };
    }

    eligibleSubtotal = sumLineItems(items.filter((item) => String(item.productId) === String(scopeProductId)));

    if (eligibleSubtotal <= 0) {
      return { error: "이 쿠폰이 적용되는 상품이 장바구니에 없습니다.", status: 400 };
    }
  }

  const minimumAmount = toWon(coupon.minimum_amount);
  if (eligibleSubtotal < minimumAmount) {
    return {
      error: scopeProductId
        ? `대상 상품 금액이 최소 ${minimumAmount.toLocaleString()}원 이상이어야 합니다.`
        : `최소 주문 금액 ${minimumAmount.toLocaleString()}원 이상이어야 합니다.`,
      status: 400,
    };
  }

  const usageLimit = coupon.usage_limit == null ? 0 : toWon(coupon.usage_limit);
  const usageCount = coupon.usage_count == null ? 0 : toWon(coupon.usage_count);
  if (usageLimit > 0 && usageCount >= usageLimit) {
    return { error: "쿠폰 사용 한도를 초과했습니다.", status: 400 };
  }

  const userUsageLimit = coupon.user_usage_limit == null ? 1 : toWon(coupon.user_usage_limit);
  if (userUsageLimit > 0) {
    const { count, error: usageError } = await supabase
      .from("coupon_usages")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId);

    if (usageError) {
      console.error("Coupon usage lookup failed:", usageError);
      return { error: "쿠폰 사용 내역을 확인할 수 없습니다.", status: 500 };
    }

    if ((count || 0) >= userUsageLimit) {
      return { error: "이미 사용 한도를 채운 쿠폰입니다.", status: 400 };
    }
  }

  const publicCoupon = toPublicCoupon(coupon);
  const discountAmount = calculateCouponDiscount(publicCoupon, eligibleSubtotal);

  if (discountAmount <= 0) {
    return { error: "적용 가능한 할인 금액이 없습니다.", status: 400 };
  }

  return {
    coupon: publicCoupon,
    discountAmount,
    finalAmount: Math.max(safeSubtotal - discountAmount, 0),
  };
}
