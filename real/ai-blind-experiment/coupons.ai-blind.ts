/**
 * [Task A-4, Part 4 실험용] 다른 서브에이전트가 real/lib/coupons.ts(정답지)를 전혀
 * 보지 않고, Gherkin 인수테스트 명세 + 함수 타입 계약만 보고 처음부터 새로 짠 구현.
 *
 * heobrain.store에서 고객이 쿠폰 코드를 입력해 할인을 받고 주문을 완료하는 기능.
 * 이 파일은 주어진 Gherkin 인수테스트 시나리오와 TypeScript 타입 계약만을 근거로
 * 처음부터 작성되었다.
 */

export interface SupabaseResult<T = unknown> {
  data?: T | null;
  count?: number | null;
  error: unknown;
}

export interface SupabaseQueryBuilder<T = unknown>
  extends PromiseLike<SupabaseResult<T>> {
  select: (
    columns?: string,
    options?: Record<string, unknown>
  ) => SupabaseQueryBuilder<T>;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder<T>;
  maybeSingle: () => Promise<SupabaseResult<T>>;
}

export interface SupabaseLike {
  from: (table: string) => SupabaseQueryBuilder;
}

interface CouponRow {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_amount: number;
  maximum_discount: number | null;
  is_active: boolean;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  user_usage_limit?: number | null;
  [key: string]: unknown;
}

export function calculateCouponDiscount(
  coupon: {
    discount_type: "percentage" | "fixed";
    discount_value: number;
    maximum_discount: number | null;
  },
  subtotal: number
): number {
  let rawDiscount =
    coupon.discount_type === "percentage"
      ? Math.floor((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;

  if (coupon.maximum_discount !== null && coupon.maximum_discount !== undefined) {
    rawDiscount = Math.min(rawDiscount, coupon.maximum_discount);
  }

  return Math.max(0, Math.min(rawDiscount, subtotal));
}

export interface CouponCartItem {
  productId: string;
  price: number;
  quantity: number;
}

export interface ValidateCouponParams {
  supabase: SupabaseLike;
  code: string;
  subtotal: number;
  userId: string;
  items?: CouponCartItem[];
}

export type CouponValidationResult =
  | {
      coupon: unknown;
      discountAmount: number;
      finalAmount: number;
      error?: never;
      status?: never;
    }
  | {
      coupon?: never;
      discountAmount?: never;
      finalAmount?: never;
      error: string;
      status: number;
    };

function fail(error: string, status: number): CouponValidationResult {
  return { error, status };
}

export async function validateCouponCode(
  params: ValidateCouponParams
): Promise<CouponValidationResult> {
  const { supabase, code, subtotal, userId } = params;

  try {
    const trimmedCode = (code ?? "").trim();
    if (!trimmedCode) {
      return fail("쿠폰 코드를 입력해주세요.", 400);
    }

    const trimmedUserId = (userId ?? "").trim();
    if (!trimmedUserId) {
      return fail("로그인이 필요합니다.", 401);
    }

    const { data, error: fetchError } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", trimmedCode)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError) {
      return fail("유효하지 않은 쿠폰 코드입니다.", 500);
    }

    const coupon = data as CouponRow | null;

    if (!coupon || coupon.is_active === false) {
      return fail("유효하지 않은 쿠폰 코드입니다.", 404);
    }

    const now = new Date();

    if (coupon.valid_from) {
      const validFrom = new Date(coupon.valid_from);
      if (!Number.isNaN(validFrom.getTime()) && now < validFrom) {
        return fail("만료된 쿠폰입니다.", 400);
      }
    }

    if (coupon.valid_until) {
      const validUntil = new Date(coupon.valid_until);
      if (!Number.isNaN(validUntil.getTime()) && now > validUntil) {
        return fail("만료된 쿠폰입니다.", 400);
      }
    }

    if (
      typeof coupon.usage_limit === "number" &&
      coupon.usage_limit > 0 &&
      typeof coupon.usage_count === "number" &&
      coupon.usage_count >= coupon.usage_limit
    ) {
      return fail("이미 사용 한도를 채운 쿠폰입니다.", 400);
    }

    if (typeof coupon.user_usage_limit === "number" && coupon.user_usage_limit > 0) {
      const { count, error: usageError } = await supabase
        .from("coupon_usages")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", trimmedUserId);

      if (usageError) {
        return fail("쿠폰 사용 내역을 확인하는 중 오류가 발생했습니다.", 500);
      }

      if (typeof count === "number" && count >= coupon.user_usage_limit) {
        return fail("이미 사용 한도를 채운 쿠폰입니다.", 400);
      }
    }

    const minimumAmount = coupon.minimum_amount ?? 0;
    if (subtotal < minimumAmount) {
      return fail(
        `최소 주문 금액 ${minimumAmount.toLocaleString("en-US")}원 이상이어야 합니다.`,
        400
      );
    }

    const discountAmount = calculateCouponDiscount(
      {
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        maximum_discount: coupon.maximum_discount ?? null,
      },
      subtotal
    );

    const finalAmount = subtotal - discountAmount;

    return {
      coupon,
      discountAmount,
      finalAmount,
    };
  } catch (_err) {
    return fail("쿠폰 확인 중 오류가 발생했습니다.", 500);
  }
}

export function isCouponValidationFailure(result: CouponValidationResult): boolean {
  return typeof (result as { error?: unknown }).error === "string";
}
