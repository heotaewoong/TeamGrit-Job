// [Task A-4, Part 4 부속 실험 — 정식 인수테스트 제출물이 아니라, "인수테스트 그린이
// 무결점을 뜻하지 않는다"는 걸 눈으로 확인하려고 따로 돌려본 1회성 스크립트다.]
//
// 블라인드 구현(coupons.ai-blind.ts)은 Gherkin 10개 시나리오를 전부 통과했다(Green).
// 하지만 코드를 읽어보면 validateCouponCode가 items 파라미터를 아예 쓰지 않는다는
// 걸 알 수 있다. 10개 시나리오 전부 items의 합계와 subtotal 값이 항상 똑같아서
// 이 차이가 절대 드러나지 않았을 뿐이다. 여기서는 일부러 그 둘을 어긋나게 만들어서
// 실제로 다른 결과가 나오는지 확인한다.
//
// 실행: npx tsx real/ai-blind-experiment/demo-items-gap.ts
import { createFakeSupabase, createFakeSupabaseState } from "../features/support/fake-supabase";
import { validateCouponCode as blindValidate } from "./coupons.ai-blind";
import { validateCouponCode as referenceValidate } from "../lib/coupons";

async function run() {
  const state = createFakeSupabaseState();
  state.coupons.set("MIN8000", {
    id: "coupon-MIN8000",
    code: "MIN8000",
    name: "MIN8000",
    discount_type: "percentage",
    discount_value: 10,
    minimum_amount: 8000,
    maximum_discount: null,
    is_active: true,
  });
  const supabase = createFakeSupabase(state);

  // 실제 장바구니(items)는 5,000원어치인데, subtotal 파라미터에는 10,000원이 들어왔다
  // (클라이언트가 잘못 계산해서 보냈거나, 값을 조작해서 보낸 상황이라고 가정한다).
  const params = {
    supabase,
    code: "MIN8000",
    subtotal: 10_000, // <- 신뢰할 수 없는 값
    userId: "user-1",
    items: [{ productId: "product-1", price: 5_000, quantity: 1 }], // <- 실제 장바구니
  };

  const blindResult = await blindValidate(params as any);
  const referenceResult = await referenceValidate(params as any);

  console.log("=== items(5,000원) vs subtotal(10,000원)이 어긋났을 때 ===");
  console.log("블라인드 구현(coupons.ai-blind.ts) 결과 :", JSON.stringify(blindResult));
  console.log("원본(A-3, real/lib/coupons.ts) 결과     :", JSON.stringify(referenceResult));
}

run();
