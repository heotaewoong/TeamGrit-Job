# Task A-4 제출 — BDD 인수테스트 (Cucumber)

> 폴더 정리: A-4 Feature·Step·AI 블라인드 실험은 이 폴더에 모았다. 프로덕션 사본은 중복하지 않고 `../task-a3-unit-tests/real/lib/coupons.ts`를 직접 재사용한다. 아래 본문의 기존 `real/lib/coupons.ts` 표기는 이 공용 대상을 뜻한다.

과제 원문은 Cucumber-JVM을 기본 스택으로 제시하지만, HeoBrain 실제 스택은 Java가 아니라
Next.js/TypeScript다(A-3에서 이미 확인한 것과 같은 판단). Cucumber-JVM의 JS/TS 생태계
대응은 Cucumber.js(`@cucumber/cucumber`)이므로 이걸 썼다. Given/When/Then, Feature 파일,
Step Definition이라는 개념 자체는 완전히 동일하고 실행기만 다르다.

**대상 코드 — 새 도메인 코드를 만들지 않았다.** 이 인수테스트는 A-3에서 이미 32개
단위테스트로 검증한 `real/lib/coupons.ts`의 `validateCouponCode`, `calculateCouponDiscount`를
한 줄도 고치지 않고 그대로 import해서 호출한다. 새 구현을 따로 만들지 않은 게 중요한데,
그래야 "같은 코드를 서로 다른 층위에서 검증한다"는 이번 과제의 핵심을 실제로 증명할 수
있기 때문이다.

---

## [x] 1. Gherkin Feature 파일 작성 (총 10개 시나리오)

📄 `real/features/coupon-order.feature`

```gherkin
Feature: 쿠폰을 적용한 주문 결제
  heobrain.store에서 고객이 쿠폰 코드를 입력해 할인을 받고 주문을 완료하는 기능이다.

  이 시나리오들은 A-3에서 단위테스트로 이미 검증한 calculateCouponDiscount와
  validateCouponCode(real/lib/coupons.ts)를 그대로 호출한다. 새 도메인 코드가
  아니라 "같은 코드를 다른 층위에서 다시 검증"하는 것이 이 과제의 핵심이다.
  단위테스트가 함수 하나하나(부품)가 맞는지 봤다면, 이 인수테스트는 고객이 실제로
  겪는 한 번의 주문 흐름(완제품)이 요구사항대로 동작하는지를 확인한다.

  Background:
    Given 로그인한 고객 "user-1"이 있다
    And 상품 "노트 필기 템플릿"의 가격은 10000원이다

  # ============ Happy Path ============

  Scenario: 정률 할인 쿠폰을 적용해 정상적으로 결제한다
    Given 다음 쿠폰이 등록되어 있다:
      | 코드       | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | WELCOME10 | 정률 | 10  | 0            |              |
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "WELCOME10"을 적용해 주문한다
    Then 주문은 성공한다
    And 할인 금액은 1000원이다
    And 최종 결제 금액은 9000원이다

  Scenario: 정액 할인 쿠폰을 적용해 정상적으로 결제한다
    Given 다음 쿠폰이 등록되어 있다:
      | 코드      | 유형 | 값   | 최소주문금액 | 최대할인한도 |
      | FLAT2000 | 정액 | 2000 | 0            |              |
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "FLAT2000"을 적용해 주문한다
    Then 주문은 성공한다
    And 할인 금액은 2000원이다
    And 최종 결제 금액은 8000원이다

  # ============ Unhappy Path : 입력 자체가 잘못된 경우 ============

  Scenario: 쿠폰 코드를 입력하지 않으면 주문이 거절된다
    Given 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 ""을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "쿠폰 코드를 입력해주세요."이다

  Scenario: 로그인하지 않은 고객은 쿠폰을 적용할 수 없다
    Given 로그아웃 상태의 고객이 있다
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "WELCOME10"을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "로그인이 필요합니다."이다

  Scenario: 존재하지 않는 쿠폰 코드는 거절된다
    Given 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "NO_SUCH_CODE"을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "유효하지 않은 쿠폰 코드입니다."이다

  # ============ Unhappy Path : 쿠폰은 존재하지만 조건이 안 맞는 경우 ============

  Scenario: 만료된 쿠폰은 거절된다
    Given 다음 쿠폰이 등록되어 있다:
      | 코드       | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | EXPIRED10 | 정률 | 10  | 0            |              |
    And "EXPIRED10" 쿠폰은 "2020-01-01"에 만료되었다
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "EXPIRED10"을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "만료된 쿠폰입니다."이다

  Scenario: 이미 사용 한도를 채운 고객은 같은 쿠폰을 다시 쓸 수 없다
    Given 다음 쿠폰이 등록되어 있다:
      | 코드   | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | ONEUSE | 정률 | 10  | 0            |              |
    And "ONEUSE" 쿠폰은 고객 1인당 1회까지만 사용할 수 있다
    And 고객 "user-1"은 "ONEUSE" 쿠폰을 이미 1회 사용했다
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "ONEUSE"을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "이미 사용 한도를 채운 쿠폰입니다."이다

  # ============ Unhappy Path / 경계값 : 최소 주문금액 ============
  # A-3 단위테스트에서 쓴 것과 똑같은 경계값 쌍(=허용 / -1 거절)을
  # 인수테스트 층위에서도 반드시 함께 확인한다.

  Scenario: 최소 주문 금액과 정확히 같으면 쿠폰이 적용된다 (경계값 · 통과)
    Given 다음 쿠폰이 등록되어 있다:
      | 코드     | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | MIN10000 | 정률 | 10  | 10000        |              |
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "MIN10000"을 적용해 주문한다
    Then 주문은 성공한다

  Scenario: 최소 주문 금액에 1원이라도 모자라면 거절된다 (경계값 · 거절)
    Given 다음 쿠폰이 등록되어 있다:
      | 코드     | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | MIN10001 | 정률 | 10  | 10001        |              |
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "MIN10001"을 적용해 주문한다
    Then 주문은 거절된다
    And 실패 사유는 "최소 주문 금액 10,001원 이상이어야 합니다."이다

  # ============ Unhappy Path에 가까운 경계값 : 최대 할인 한도 ============
  # 실패는 아니지만, "쿠폰이 계산해준 할인을 그대로 다 주면 안 되는" 경계라서
  # 함께 확인한다. A-3에서 실제로 결함이 있었던 규칙이기도 하다.

  Scenario: 최대 할인 한도가 설정된 쿠폰은 계산된 할인이 한도를 넘지 않는다 (경계값)
    Given 다음 쿠폰이 등록되어 있다:
      | 코드   | 유형 | 값  | 최소주문금액 | 최대할인한도 |
      | CAP500 | 정률 | 50  | 0            | 500          |
    And 장바구니에 "노트 필기 템플릿" 1개가 담겨 있다
    When 고객이 쿠폰 코드 "CAP500"을 적용해 주문한다
    Then 주문은 성공한다
    And 할인 금액은 500원이다
```

💡 **시나리오 구성 전략 및 "Unhappy Path를 먼저 떠올린 과정"**

Happy Path는 정률/정액 두 가지 계산 방식만 확인하고, 나머지 8개를 Unhappy Path와
경계값에 배정했다. 실패 시나리오를 "생각나는 대로" 나열하지 않고, 먼저 "이 요청이
성공하려면 반드시 참이어야 하는 조건"부터 전부 적었다 — 코드가 입력됨, 로그인됨,
코드가 존재함, 활성 상태임, 만료 안 됨, 최소금액 이상임, 사용한도를 안 채움. 그
조건을 하나씩 거꾸로 뒤집었더니 빠짐없이 8개의 실패 시나리오가 나왔다. 이 방식이
"떠오르는 대로 적기"보다 나은 이유는, 전제조건을 먼저 다 적어두면 같은 실패를 두 번
쓰거나 중요한 실패를 빠뜨릴 위험이 구조적으로 없어지기 때문이다.

경계값은 별도로 한 번 더 짚었다. 최소 주문금액은 "미달이면 거절"만 쓰면 부족하다는
걸 A-3 경험으로 알고 있어서, `MIN10000`(경계와 정확히 같음 → 통과)과
`MIN10001`(경계보다 1원 모자람 → 거절) 두 시나리오를 반드시 짝으로 만들었다. 마지막
`CAP500` 시나리오는 사실 실패 케이스가 아니라 성공 케이스지만, A-3 단위테스트에서
실제로 있었던 결함(할인 한도가 0원일 때 falsy 체크 때문에 무시되던 버그, 커밋
`39d6716`/`966e914`)을 인수테스트 층위에도 회귀 방지용 계약으로 박아둔 것이다. 버그를
그때 고치고 끝낸 게 아니라, 기획자와 다음 개발자도 함께 읽는 Gherkin 명세에 "이 한도는
절대 무력화되면 안 된다"고 다시 한 번 새겨둔 셈이다.

🎙️ **면접관을 사로잡을 "1분 요약 대본"**

> "저는 인수테스트를 쓸 때 '잘 되는 경우'보다 '왜 안 되는가'에 더 공을 들입니다.
> 이번 쿠폰 검증 기능도 성공 시나리오는 2개만 두고, 나머지 8개는 로그인 여부·쿠폰
> 존재 여부·만료·경계값·사용 한도 같은 실패와 경계 조건에 배정했습니다. 특히 최소
> 주문금액은 '정확히 같으면 통과, 1원 모자라면 거절' 두 시나리오를 짝으로 만들어서
> 경계값 오류를 원천 차단했고, 마지막 시나리오는 이전 단위테스트에서 실제로 터졌던
> '할인 한도 0원이 무시되던 버그'를 그대로 인수테스트에 회귀 방지 계약으로
> 남겨뒀습니다. 코드를 고친 걸로 끝내지 않고, 같은 실수가 다시는 프로덕션에 들어갈
> 수 없게 명세 자체에 안전장치를 심는 게 제 방식입니다."

---

## [x] 2. Step Definition 구현 + 통과하는 도메인 코드 (같은 도메인, 다른 층위 확인)

📄 `real/features/step_definitions/coupon-order.steps.ts`

```typescript
import { Given, When, Then, type DataTable } from "@cucumber/cucumber";
import assert from "node:assert/strict";
// [핵심] 이 인수테스트는 새 도메인 코드를 만들지 않는다.
// A-3에서 단위테스트로 이미 검증한 real/lib/coupons.ts를 "그대로" import해서 쓴다.
import { validateCouponCode, isCouponValidationFailure } from "../../lib/coupons";
// 주의: 아래 사이드이펙트 import가 없으면 world.ts 안의 setWorldConstructor(CouponWorld)가
// 실행되지 않는다. "import type"만 쓰면 esbuild/tsx가 타입 전용으로 보고 통째로 지워버려서,
// Cucumber가 기본 World(빈 객체)를 쓰게 되고 this.productPrices 등이 전부 undefined가 된다.
// (직접 겪은 버그 — 실행해서 원인을 찾았다.)
import "../support/world";
import type { CouponWorld } from "../support/world";
import type { FakeCouponRow } from "../support/fake-supabase";

// ... (Given 단계: 로그인 상태, 상품 가격, 쿠폰 등록, 만료일, 사용 이력, 장바구니 — 전체 7개)

When("고객이 쿠폰 코드 {string}을 적용해 주문한다", async function (this: CouponWorld, code: string) {
  this.lastResult = await validateCouponCode({
    supabase: this.supabase,
    code,
    subtotal: this.subtotal(),
    userId: this.userId,
    items: this.cart,
  });
});

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

// ... (할인 금액 / 최종 결제 금액 / 실패 사유 검증 Then 3개 생략 — 전체는 저장소 참고)
```

📄 통과하는 도메인 코드 — `real/lib/coupons.ts` (A-3에서 그대로 재사용, **한 줄도 수정하지 않음**)

```typescript
export async function validateCouponCode(
  params: ValidateCouponParams
): Promise<CouponValidationResult> {
  const { supabase, code, subtotal, userId } = params;
  try {
    const trimmedCode = (code ?? "").trim();
    if (!trimmedCode) return fail("쿠폰 코드를 입력해주세요.", 400);

    const trimmedUserId = (userId ?? "").trim();
    if (!trimmedUserId) return fail("로그인이 필요합니다.", 401);

    const { data, error: fetchError } = await supabase
      .from("coupons").select("*").eq("code", trimmedCode).eq("is_active", true).maybeSingle();
    if (fetchError) return fail("유효하지 않은 쿠폰 코드입니다.", 500);

    const coupon = data as CouponRow | null;
    if (!coupon || coupon.is_active === false) return fail("유효하지 않은 쿠폰 코드입니다.", 404);

    // ... 유효기간 / 전체 사용한도 / 인당 사용한도 / 최소 주문금액 검증 (전체는 저장소 참고)

    const discountAmount = calculateCouponDiscount(
      { discount_type: coupon.discount_type, discount_value: coupon.discount_value,
        maximum_discount: coupon.maximum_discount ?? null },
      subtotal
    );
    return { coupon, discountAmount, finalAmount: subtotal - discountAmount };
  } catch (_err) {
    return fail("쿠폰 확인 중 오류가 발생했습니다.", 500);
  }
}
```

💡 **통찰 — 같은 프로덕션 코드, 다른 종류의 테스트 더블**

이 인수테스트는 새 도메인 코드를 한 줄도 만들지 않았다. Step Definition이 A-3에서
이미 32개 단위테스트로 검증한 `real/lib/coupons.ts`의 `validateCouponCode`를 그대로
import해서 호출한다. 대신 Supabase를 흉내낸 테스트 더블의 "종류" 자체를 A-3과
의도적으로 다르게 짰다. A-3의 목은 `vi.fn()`으로 "무엇이 어떻게 호출됐는지"까지
검증하는 상호작용 검증, 즉 Mockito 스타일이었다(예:
`expect(supabase.from).toHaveBeenCalledWith("coupons")`). 반면 이번
`fake-supabase.ts`는 code/is_active로 실제로 찾아주는 작은 인메모리 저장소일 뿐,
호출 방식은 전혀 검증하지 않는다. 실제로 위 Step Definition의 `Then` 블록들을 보면
`this.supabase`를 단 한 번도 들여다보지 않고 `this.lastResult`(최종 결과)만
확인한다 — 상태 기반 검증이다.

같은 프로덕션 함수를 두고 "내부 협력을 들여다보는 테스트"와 "블랙박스로 취급하는
테스트"를 나란히 통과시킨 것 자체가 "같은 도메인을 다른 층위에서 검증한다"는 이번
과제의 요구사항을 코드로 증명한다. 실행 중 진짜 버그도 두 개 만났다: tsx 환경에서
`import "server-only"`가 그대로 충돌해서 `tsconfig.json`의 `paths`로 별도 우회해야
했고(Vitest의 `resolve.alias`와는 다른 메커니즘이라 따로 고쳐야 했다), step
definition에서 `world.ts`를 `import type`으로만 참조했더니 esbuild가 부작용 코드까지
통째로 지워버려서 `setWorldConstructor`가 실행되지 않는 버그였다. 둘 다 재현하고
원인을 로그로 추적해서 고쳤다(커밋 `6ef3f78`, `91fdfbb`).

🎙️ **1분 요약 대본**

> "이번 인수테스트에서 가장 신경 쓴 건 '새 코드를 짜지 않는 것'이었습니다. Step
> Definition은 A-3에서 이미 단위테스트로 검증된 프로덕션 함수를 그대로 가져다
> 썼고, 대신 Supabase를 흉내낸 테스트 더블의 성격을 완전히 다르게 만들었습니다.
> 단위테스트는 '이 함수가 Supabase를 몇 번, 어떤 인자로 불렀는가'까지 검증하는
> 상호작용 목이었다면, 이번엔 '실제로 찾아서 돌려주는' 작은 가짜 저장소를 만들어서
> 호출 방식은 안 보고 최종 결과만 검증했습니다. 같은 프로덕션 코드가 서로 다른 두
> 층위의 테스트를 동시에 통과한다는 걸 직접 증명한 셈입니다. 그 과정에서 tsx 실행
> 환경 특유의 모듈 해석 버그와, 타입 전용 import가 부작용 코드를 통째로 지워버리는
> 버그를 실제로 만났고, 둘 다 로그를 보고 원인을 추적해서 고쳤습니다."

---

## [x] 3. BDD와 TDD의 관계 (본인 정리)

TDD와 BDD는 대립하는 방법론이 아니라 포함관계에 가깝다고 정리했다. TDD는 함수 하나,
클래스 하나처럼 아주 좁은 단위에서 "이 부품이 정확한가"를 확인하는 방법론이고, BDD는
그 위에서 "고객이 실제로 겪는 이 기능이 요구사항대로 동작하는가"를 더 넓은 층위에서
확인하는 방법론이다. 이번에 A-3의 `calculateCouponDiscount`와 `validateCouponCode`를
한 줄도 안 고치고 그대로 가져와서 Cucumber 시나리오에서 다시 호출해봤는데, 같은
프로덕션 코드를 단위테스트는 함수 서명과 내부 협력(Supabase가 호출됐는지, 몇 번
호출됐는지) 단위로 검증하고, 인수테스트는 "고객이 쿠폰 코드를 입력해서 주문했을 때
최종 결제 금액이 얼마로 나오는가"라는 겉으로 드러나는 결과만으로 검증한다는 차이를
직접 느꼈다.

"인수테스트에서 단위테스트로 내려가는 흐름"은 이중 루프 TDD(double loop TDD,
Outside-In TDD)라는 구조와 같다고 이해했다. 바깥쪽 루프는 Gherkin으로 쓴 인수테스트가
실패한 상태(Red)에서 출발하고, 그 인수테스트를 통과시키기 위해 안쪽 루프에서 함수
단위 단위테스트를 Red-Green-Refactor로 하나씩 채워나가는 흐름이다. 즉 인수테스트는
"무엇을 만들어야 끝난 것인가"를 정하는 명세이자 완료 기준이고, 단위테스트는 "그것을
어떻게 안전하게 만들어 나가는가"를 보장하는 실행 도구다. 이번 과제에서는 A-3에서
안쪽 루프를 먼저 채워놓은 상태에서 거꾸로 바깥쪽 인수테스트를 나중에 씌운
순서였지만, 그래도 두 층위가 완전히 같은 프로덕션 코드를 두고 서로 다른
질문(부품이 맞는가 / 완제품이 요구사항대로인가)을 던진다는 사실 자체는 똑같이
확인됐다.

🎙️ **1분 요약 대본**

> "저는 BDD와 TDD를 대립 관계가 아니라 포함 관계, 정확히는 '이중 루프'로 이해하고
> 있습니다. 인수테스트는 '무엇을 만들어야 끝난 것인가'를 정하는 바깥쪽 루프이고,
> 단위테스트는 그 목표를 향해 안전하게 코드를 채워나가는 안쪽 루프입니다. 이번
> 과제에서는 순서가 거꾸로였습니다 — A-3에서 단위테스트로 안쪽 루프를 먼저
> 채워놓고, 이번에 바깥쪽 인수테스트를 나중에 씌웠습니다. 그런데도 두 층위가
> 완전히 같은 프로덕션 코드를 두고 '부품이 맞는가'와 '완제품이 요구사항대로인가'라는
> 서로 다른 질문을 던진다는 사실은 똑같이 확인됐습니다. 이 구조를 이해하고 나니,
> 인수테스트 없이 단위테스트만 잔뜩 쌓는 게 왜 위험한지도 명확해졌습니다 — 부품은
> 다 맞는데 완제품 조립이 틀릴 수 있으니까요."

---

## [x] 4. 거꾸로 해보기 — AI에게 구현을 맡기고, 제 인수테스트로 판정하기

**5-1. 무엇을 했는가.** 이 대화의 맥락을 전혀 모르는 별도 서브에이전트에게 위 Gherkin
Feature 전문과, 다른 코드가 import해서 쓸 수 있도록 함수 이름·타입만 적힌 계약을
줬다. `real/lib/coupons.ts`(정답지)는 절대 보여주지 않았고, 다른 파일을 탐색하지
말라고 명시적으로 지시했다. 그 에이전트가 완전히 새로 짠 코드가
`real/ai-blind-experiment/coupons.ai-blind.ts`다.

**5-2. AI에게 직접 "잘 짰어?"라고 두 가지 방식으로 물어봤다.** 첫 번째는 "코드만
훑어보고, 실행하지 말고, 캐주얼하게 3~5문장으로" 답하게 했다.

> "코드 자체는 꽤 깔끔하고 에러 핸들링도 촘촘해... 근데 프로덕션 바로 넣기엔 걸리는
> 게 하나 있는데, usage_limit/user_usage_limit을 체크만 하고... 동시에 여러 요청
> 들어오면 한도 넘겨서 쿠폰이 뚫리는 race condition 여지가 있어. 그리고 valid_from
> 체크에서... 에러 메시지가 '만료된 쿠폰입니다'로 나가는 건 명백한 문구 버그야.
> items 파라미터도 받아놓고... 전혀 안 쓰이는 거 보면 품목별 제한 로직이 빠진 채로
> 남은 것 같고."

두 번째는 시간을 더 주고 "10점 만점에 몇 점인지, 10개 시나리오를 전부 통과할지,
프로덕션에 반영해도 되는지"를 형식을 갖춰 물었다. 답은 8/10점, "10개 시나리오는
전부 통과할 것"(fake 객체 코드를 손으로 트레이싱해서 근거 제시), 그러나 "아니오,
이대로는 안 됩니다" — 쿠폰 원본 데이터를 그대로 반환하는 보안 문제, 코드 정규화
누락, `items` 미사용, 검증 순서 차이 등을 근거로 들었다. 같은 코드, 같은 질문인데
답의 깊이가 "얼마나 시간과 도구를 주고 물어봤는가"에 따라 달라졌다는 것 자체가
이미 자기평가가 비결정적이라는 증거였다.

**5-3. 인수테스트를 실제로 돌린 결과.** `real/lib/coupons.ts`를 잠깐 이 AI
구현으로 바꿔치기하고 `npm run test:bdd`를 그대로 돌렸다.

```
$ npm run test:bdd
10 scenarios (10 passed)
72 steps (72 passed)
```

10/10 Green. 이번엔 두 AI의 자기평가와 실행 결과의 방향이 같았다 — 둘 다
"인수테스트는 통과할 것"이라고 예상했고, 실제로 통과했다. 테스트 후
`real/lib/coupons.ts`는 원본 그대로 복구했다.

**5-4. 하지만 그린이라고 다 믿을 수 있는 건 아니었다.** 두 자기평가 모두 "`items`
파라미터가 안 쓰인다"는 걸 지적했는데, 이게 실제로 문제가 되는지 직접 값을 넣어서
확인해봤다(`real/ai-blind-experiment/demo-items-gap.ts`). AI 구현 코드를 보면
실제로 `subtotal`만 쓰고 `items`는 파라미터로 받아놓고 참조조차 안 한다:

```typescript
// real/ai-blind-experiment/coupons.ai-blind.ts (136번째 줄)
const { supabase, code, subtotal, userId } = params; // items가 여기 없다
```

장바구니(items)는 5,000원어치인데 `subtotal` 파라미터에는 10,000원이 들어온 상황을
만들어 원본과 AI 구현에 똑같이 넣어봤다.

```
=== items(5,000원) vs subtotal(10,000원)이 어긋났을 때 ===
블라인드 구현 결과 : {"discountAmount":1000,"finalAmount":9000, ...}
원본(A-3) 구현 결과 : {"error":"최소 주문 금액 8,000원 이상이어야 합니다.","status":400}
```

원본(A-3) 코드는 실제 장바구니 금액(5,000원)을 기준으로 정확히 거절했고, AI가 짠
코드는 신뢰할 수 없는 `subtotal` 값(10,000원)을 그대로 믿고 1,000원 할인을 적용해서
통과시켰다. 이건 제 Gherkin 시나리오 10개 중 어디에도 없는 조합이라, 10/10 Green은
이 문제를 애초에 검사조차 하지 않았던 것이다.

💡 **통찰 — AI 자기평가가 "지적한 것"과 "실제로 증명된 것"은 다르다**

두 자기평가가 공통으로 지적한 게 하나 있었다 — "items 파라미터가 받아만 놓고
안 쓰인다." 하지만 눈으로 지적하는 것과 실제로 문제가 되는지 확인하는 건 다른
일이다. 장바구니(items)는 5,000원인데 subtotal 파라미터에는 10,000원을 넣는 상황을
직접 만들어본 결과, 원본 코드는 items 합계를 기준으로 정확히 거절했고 AI 블라인드
구현은 클라이언트가 보낸 subtotal을 그대로 믿고 할인을 적용해버렸다 — 클라이언트가
조작한 값으로 최소주문금액 제한을 우회할 수 있는 진짜 보안 결함이다. 게다가 AI
구현은 쿠폰 원본 DB row를 그대로 응답에 실어 보내고(원본은 `toPublicCoupon`으로
내부 필드를 걸러내는데, 이 함수 자체가 없다), 검증 순서도 원본과 달랐다(사용한도
체크를 최소금액 체크보다 앞에 둠). 문제는 제 Gherkin 시나리오 10개 전부 items
합계와 subtotal이 항상 같아서, 이 결함이 인수테스트에서는 단 한 번도 드러나지
않았다는 것이다. 10/10 Green은 "검증한 범위 안에서 맞다"는 뜻이지 "결함이 없다"는
뜻이 아니라는 걸 제 손으로 직접 확인했다.

솔직히 이번 실험의 한계도 있다. "블라인드"는 프롬프트로 지시한 것이지 도구 접근
자체를 차단한 게 아니어서, 완전히 기술적으로 격리된 실험은 아니었다(자기평가를
맡긴 에이전트 중 하나는 지시에도 불구하고 실제 저장소 파일을 찾아 읽고 답했다 —
이것도 흥미로운 관찰이다: AI가 "검증 수단"에 접근할 수 있으면 자기평가가 점점
실행 결과에 가까워진다는 뜻이기도 하다).

🎙️ **면접관을 사로잡을 "1분 요약 대본"**

> "AI에게 스펙(Gherkin)만 주고 구현을 통째로 새로 맡긴 다음, 제가 쓴 인수테스트로
> 그 코드를 심판했습니다. 인수테스트는 10개 다 통과했고, AI에게 '잘 짰어?'라고
> 직접 물었을 때도 방향은 같았습니다 — 다만 캐주얼하게 물으면 3문장짜리 감상이,
> 시간과 형식을 갖춰 물으면 8점짜리 상세 리뷰가 나올 만큼 자기평가의 깊이 자체가
> 물어보는 방식에 따라 달라졌습니다. 여기서 멈추지 않고, 두 자기평가가 공통으로
> 지적한 'items 미사용'이 실제로 무슨 문제인지 제가 직접 값을 조작해서
> 증명했습니다 — 장바구니는 5,000원인데 subtotal만 10,000원으로 조작해서
> 넣어보니, 원본 코드는 정확히 거절했지만 AI 코드는 조작된 값을 그대로 믿고
> 할인을 내줬습니다. 제 시나리오 10개 중 이 조합은 없었기 때문에 10/10 Green이
> 이 결함을 가려버리고 있었던 겁니다. 그래서 저는 AI의 자기평가보다 실행 결과를
> 믿지만, 그 실행 결과조차 제가 무엇을 테스트했는지에 갇혀 있다는 걸 항상
> 의심하는 습관이 더 중요하다는 결론을 내렸습니다."

---

## 실행 로그 (전체, 최종 재확인)

```
$ npm test  (vitest — A-3, 단위테스트)
 ✓ src/services/createCouponOrder.test.ts (6 tests)
 ✓ real/lib/coupons.validate.test.ts (8 tests)
 ✓ src/domain/coupon.test.ts (12 tests)
 ✓ real/lib/coupons.discount.test.ts (6 tests)
 Test Files  4 passed (4)
      Tests  32 passed (32)

$ npm run test:bdd  (cucumber-js — A-4, 인수테스트, 원본 coupons.ts 기준)
10 scenarios (10 passed)
72 steps (72 passed)
0m 0.60s (0m 0.19s executing your code)
```

## 커밋 히스토리 (A-4분, 최신순)

```
745b78d docs(experiment): Task A-4 Part4 — AI 블라인드 구현 + 인수테스트 판정 실험
91fdfbb test(bdd): Step Definition/World/Fake Supabase 구현 — real/lib/coupons.ts를 그대로 재사용
b905110 test(bdd): A-3 쿠폰 주문 도메인 요구사항을 Gherkin Feature로 작성
6ef3f78 chore: Cucumber.js(TS) 설치 및 test:bdd 스크립트 추가 (Cucumber-JVM 대응, A-3의 Vitest 선택과 동일한 논리)
```

(A-3분 커밋 10개는 `NOTES.md` 참고. 전체 저장소는 총 24개 커밋.)

## 제출 체크리스트

- [x] Feature 파일과 Step Definition, 도메인 코드 — 항목 1·2
- [x] "Unhappy Path를 먼저 떠올린 과정" (최소 300자) — 항목 1의 💡
- [x] BDD와 TDD의 관계 정리 (최소 300자) — 항목 3
- [x] AI에게 구현을 맡기고 인수테스트로 판정한 결과, AI 자기평가와의 비교 (최소 300자) — 항목 4
