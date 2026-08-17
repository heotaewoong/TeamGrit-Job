import { setWorldConstructor, World as CucumberWorld, type IWorldOptions } from "@cucumber/cucumber";
import {
  createFakeSupabaseState,
  createFakeSupabase,
  type FakeSupabaseState,
  type FakeCouponRow,
} from "./fake-supabase";
import type {
  CouponCartItem,
  CouponValidationResult,
} from "../../../../task-a3-unit-tests/real/lib/coupons";

// Cucumber의 World = 시나리오 하나마다 새로 만들어지는 상태 저장소.
// 시나리오 사이에 상태가 새지 않는다(A-3 FIRST 원칙의 Independent와 같은 이유).
export class CouponWorld extends CucumberWorld {
  state: FakeSupabaseState = createFakeSupabaseState();
  supabase = createFakeSupabase(this.state);

  /** Background에서 "user-1"로 채워지고, 로그아웃 시나리오에서만 ""로 바뀐다 */
  userId = "";
  productPrices = new Map<string, number>();
  productIdByName = new Map<string, string>();
  cart: CouponCartItem[] = [];

  lastResult: CouponValidationResult | undefined;

  constructor(options: IWorldOptions) {
    super(options);
  }

  productId(name: string) {
    if (!this.productIdByName.has(name)) {
      this.productIdByName.set(name, `product-${this.productIdByName.size + 1}`);
    }
    return this.productIdByName.get(name)!;
  }

  registerCoupon(row: FakeCouponRow) {
    this.state.coupons.set(row.code, row);
  }

  requireCoupon(code: string): FakeCouponRow {
    const coupon = this.state.coupons.get(code);
    if (!coupon) {
      throw new Error(`시나리오 순서 오류: "${code}" 쿠폰이 아직 등록되지 않았다`);
    }
    return coupon;
  }

  subtotal() {
    return this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

setWorldConstructor(CouponWorld);
