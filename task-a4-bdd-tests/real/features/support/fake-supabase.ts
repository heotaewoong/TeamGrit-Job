// A-3 단위테스트(coupons.validate.test.ts)의 chainable() 목 객체와 겉모양은
// 비슷하지만 목적이 다르다. 단위테스트의 목은 "정해진 응답을 그대로 반환"하고
// "무엇이 어떻게 호출됐는지"를 검증하는 데 썼다(Mockito 스타일 상호작용 검증,
// 예: expect(supabase.from).toHaveBeenCalledWith("coupons")).
//
// 여기 인수테스트의 fake는 반대다. 등록된 데이터를 놓고 code/is_active로
// 실제로 "찾아주는" 아주 작은 인메모리 저장소이고, 어떻게 호출됐는지는 아예
// 보지 않는다 — 인수테스트는 고객 입장에서 "최종적으로 뭐가 나왔는지"만 본다.
// (state-based fake vs interaction-verifying mock — 검증 방식 자체가 층위에 따라 다르다.)

export interface FakeCouponRow {
  id: string;
  code: string;
  name: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_amount: number;
  maximum_discount: number | null;
  applies_to_product_id?: string | null;
  usage_limit?: number | null;
  usage_count?: number | null;
  user_usage_limit?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
}

export interface FakeSupabaseState {
  coupons: Map<string, FakeCouponRow>;
  /** key: `${couponId}:${userId}` */
  usageCounts: Map<string, number>;
}

export function createFakeSupabaseState(): FakeSupabaseState {
  return { coupons: new Map(), usageCounts: new Map() };
}

function makeCouponsChain(state: FakeSupabaseState) {
  const filters: Record<string, unknown> = {};
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    maybeSingle: async () => {
      const code = String(filters.code ?? "");
      const row = state.coupons.get(code);
      if (!row) return { data: null, error: null };
      if ("is_active" in filters && row.is_active !== filters.is_active) {
        return { data: null, error: null };
      }
      return { data: row, error: null };
    },
  };
  return builder;
}

function makeUsagesChain(state: FakeSupabaseState) {
  const filters: Record<string, unknown> = {};
  const resolve = () => {
    const key = `${filters.coupon_id}:${filters.user_id}`;
    return { count: state.usageCounts.get(key) ?? 0, error: null };
  };
  // 실제 코드가 .maybeSingle() 없이 체인 끝에서 바로 await하는 형태라서
  // (coupon_usages 조회) 이 체인 자체가 thenable이어야 한다.
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
    catch: (onRejected: any) => Promise.resolve(resolve()).catch(onRejected),
  };
  return builder;
}

export function createFakeSupabase(state: FakeSupabaseState) {
  return {
    from(table: string) {
      if (table === "coupons") return makeCouponsChain(state);
      if (table === "coupon_usages") return makeUsagesChain(state);
      throw new Error(`인수테스트 fake가 모르는 테이블: ${table}`);
    },
  } as any;
}
