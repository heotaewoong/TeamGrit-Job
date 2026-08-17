# Task A-3 제출 메모 — HeoBrain "쿠폰 적용 주문 결제" 단위테스트

> 폴더 정리: A-3 산출물은 이 폴더에 모았고, 아래 기록의 기존 `src/`, `real/lib/` 경로는 현재 이 폴더를 기준으로 동일하다.

과제 원문(Notion Phase 1 · 1-1 · Task A-3)은 Java 24 + JUnit5 + Mockito + AssertJ를 기본
권장 스택으로 제시하지만, 문서 안에서 이미 "HeoBrain은 Next.js/TypeScript이므로 Vitest
기반으로 실제 코드에 추가한다"고 스스로 정리해두었다. 이 제출물은 그 결정을 따라
**Vitest(JUnit5 대응) + `vi.fn()`(Mockito 대응) + `expect()`(AssertJ 대응)**로 작성했다.

## 대상 코드 — 실제 HeoBrain 레포 기준

로컬 파일시스템 마운트가 안 되는 대신(구글 드라이브 가상 드라이브 문제), 연결된 구글
드라이브 커넥터로 실제 소스를 읽어와 `real/lib/coupons.ts`에 **그대로** 복사해 테스트했다.

- 원본 위치: `HeoBrain-Marketplace-vi/lib/coupons.ts` (2026-08-05 수정본)
- **실제 파일은 어떤 것도 수정하지 않았다.** 모든 수정/실험은 이 로컬 사본 안에서만 일어났다.
- `src/` 아래 파일들은 그 이전에 만든, 실제 코드를 보기 전 단계의 학습용 독립 예제다
  (동일한 도메인을 처음부터 TDD로 만들어보는 연습 — 남겨두되 제출의 핵심은 `real/` 쪽).

## 1) 순수 도메인 로직 TDD — 실제 결제 로직에서 결함 하나를 잡은 과정

**한 줄 요약**: 관리자가 쿠폰의 "최대 할인 한도"를 0원으로 설정해도 실제로는 한도 없이
할인이 그대로 새어나가는 결제 로직 결함을 테스트로 찾아내고, 원인을 정확히 지목해
한 줄로 고쳤다. `real/lib/coupons.discount.test.ts`가 그 근거 코드다.

이미 운영 중인 함수라 "테스트 먼저 → 빈 구현"이라는 교과서적 Red는 적용할 수 없었다.
대신 다음 순서로 TDD의 본질(먼저 실패하는 테스트로 기대치를 고정 → 원인에 맞는 최소
수정 → 정리)을 실제 코드에 그대로 적용했다.

**1) Red — 기대치를 먼저 테스트로 적고, 실패를 눈으로 확인했다**

`calculateCouponDiscount`(쿠폰 할인 계산 함수)가 지금까지 잘 동작한다고 알려진 5가지
정상 케이스(정률 할인, 정액 할인, 0원 하한 등)를 먼저 테스트로 고정했다. 그다음 아직
아무도 테스트하지 않은 경우를 하나 추가했다: "최대 할인 한도를 0원으로 설정하면, 할인
금액도 0원이어야 한다."

돌려보니 실패했다. 9,900원 상품에 50% 쿠폰(한도 0원)을 적용했을 때 기대값은 0원인데
실제로는 4,950원이 나왔다.

원인을 코드에서 찾았다.

```ts
coupon.maximum_discount ? Math.min(rawDiscount, maximum_discount) : rawDiscount
```

이 조건문의 의도는 "한도 값이 있으면 그 한도까지만 할인, 없으면 무제한"이다. 문제는
자바스크립트에서 숫자 `0`이 "값이 없다(false)"와 똑같이 취급된다는 점이다. 그 결과
"한도 0원(할인 금지)"이라는 관리자의 설정이 "한도 미설정(무제한)"으로 뒤바뀌어
해석되고 있었다. 스타일 문제가 아니라 실제로 돈이 새는 결제 로직 결함이었다.

**2) Green — 원인에 맞는 최소한의 수정으로 통과시켰다**

"값이 있으면"이라는 조건을 "0을 포함한 숫자 값이면"으로 바꿨다.

```ts
coupon.maximum_discount != null ? Math.min(rawDiscount, maximum_discount) : rawDiscount
```

한 줄만 고친 뒤 다시 돌리자 6개 모두 통과했다 (기존 5개 + 새로 추가한 1개).

**3) Refactor — 손대지 않기로 한 것도 판단이다**

보통 이 단계에서는 코드를 정리하지만, 이번 수정은 이미 한 줄짜리 조건식으로 원인과
의도가 명확했다. 억지로 함수를 쪼개거나 이름을 바꾸면 오히려 리뷰어가 "진짜 로직
수정"과 "스타일 변경"을 구분하기 어려워진다고 판단해 그대로 두었다.

**경계값·예외 케이스** (같은 테스트 파일에 포함): 상품가 0원일 때 할인 0원, 정액 할인이
상품가를 초과할 때 0원 밑으로 내려가지 않음(하한 방어), 할인율·할인금액이 음수일 때
할인 0원으로 안전 처리.

**이 발견이 왜 중요한가**: 이건 스타일이 아니라 실제 결제 금액에 영향을 주는 결함이었고,
지금까지 이 함수에는 테스트가 하나도 없어서 아무도 모르고 지나쳤을 수 있는 문제였다.
다만 결제·가격 로직은 승인 없이 실서비스에 바로 반영하지 않는다는 원칙에 따라, 이
수정은 **로컬 사본에서 테스트로 검증만 해두었고 실제 Drive의 `lib/coupons.ts`는 그대로다.**
실제 반영은 본인 승인 후 별도로 진행한다.

> 면접 한 줄 요약: "테스트가 없던 실제 결제 로직에서, 0과 null을 같게 취급하는
> 자바스크립트의 truthy 체크 때문에 할인 한도가 무력화되는 결함을 발견했습니다.
> Red-Green-Refactor로 재현·수정·검증 과정을 남겼고, 결제 로직이라 실제 반영 전에
> 별도 승인을 받는 절차를 지켰습니다."

## 2) 외부 의존 로직 Mock 테스트 (Mockito 대응)

`real/lib/coupons.validate.test.ts`가 실제 `validateCouponCode`(Supabase에 쿠폰을 조회하는
비동기 함수)를 대상으로 한다.

**가짜 객체를 어디에, 왜 끼웠는가**: `validateCouponCode`는 Supabase 클라이언트를 파라미터로
주입받는 구조다. Supabase 자체(네트워크 I/O, 실제 요금·쿼터가 걸린 외부 시스템)만 Mock
했고, 함수 내부에서 실제로 호출하는 `calculateCouponDiscount`(핵심 도메인 규칙)는 절대
Mock하지 않았다 — A-2에서 세운 기준 그대로다. 이 부분을 Mock했다면 "실제로 990원이 아니라
900원을 계산해도 테스트가 통과하는" 신뢰할 수 없는 테스트가 됐을 것이다.

Supabase 쿼리 빌더(`.from().select().eq().eq()...`, 체인 끝에서 `await`하면 Promise처럼
동작)를 흉내내는 최소 chainable mock을 직접 만들어 사용했다.

포함된 케이스: 코드 미입력/비로그인/subtotal<=0(모두 DB 미조회 검증 — 행위 검증),
쿠폰 미존재(404), 만료 쿠폰, 최소주문금액 경계값(=허용/미달 거절), 사용자 사용한도 초과,
정상 케이스(실제 `calculateCouponDiscount` 계산값이 그대로 반영되는지).

## 3) FIRST 원칙 자가 점검

- **Fast**: 전체 32개 테스트 실행 시간 1초 미만 (`Duration 948ms`, 아래 로그 참고). DB·네트워크
  호출 없음 — Supabase는 전부 Mock.
- **Independent**: 매 테스트마다 `createSupabaseMock(...)`을 새로 생성하거나(`coupons.validate.test.ts`),
  `beforeEach`에서 `vi.fn()`을 새로 만든다(`createCouponOrder.test.ts`). 테스트 간 상태 공유 없음.
  순서를 바꿔 실행해도 결과가 같다.
- **Repeatable**: `src/domain/coupon.test.ts`는 `now`를 파라미터로 주입해 완전히 결정론적이다.
  다만 `real/lib/coupons.validate.test.ts`의 "만료 쿠폰" 케이스는 실제 `validateCouponCode`가
  내부에서 `new Date()`를 직접 생성해 시각을 주입할 수 없다 — `valid_until: "2020-01-01"`처럼
  "확실히 과거"인 고정값을 써서 근사적으로 Repeatable을 확보했다. 완벽한 결정론은 아니라는
  점을 인지하고 있고, 실제 함수 쪽에 시계 주입(clock injection)을 추가하면 더 좋아질 부분이다.
- **Self-validating**: 전부 `expect()` 자동 단언. 콘솔 출력을 사람이 눈으로 확인해야 하는 부분 없음.
- **Timely**: `calculateCouponDiscount`/`validateCouponCode` 자체는 이미 구현되어 있던 코드라
  "테스트를 먼저 쓰고 구현"이라는 원칙을 100% 지키지는 못했다. 다만 이번에 새로 발견한
  `maximum_discount=0` 결함에 대해서는 수정 전에 실패하는 테스트를 먼저 작성했으므로, 그
  범위 안에서는 Timely 원칙을 지켰다.

## 4) 결함 주입 실험

**대상**: `validateCouponCode`의 최소 주문금액 경계값 검사.
**주입한 결함**: `if (eligibleSubtotal < minimumAmount)` → `if (eligibleSubtotal <= minimumAmount)`
(부등호 뒤집기, 로컬 사본에서만).

**결과**: "소계가 최소 주문금액과 정확히 같으면 통과해야 한다" 테스트 1개가 Red로 전환됨
(8개 중 7 통과 / 1 실패). 다른 7개는 전부 그대로 통과 — 즉 "미달 시 거절"만 테스트했다면
이 결함을 못 잡았을 것이고, "경계값과 같을 때 허용됨"을 명시적으로 검증하는 테스트가 있어야만
잡을 수 있었다.

**잡아낸 단언**: `expect(isCouponValidationFailure(result)).toBe(false)` (경계값이 "==" 일 때
성공 케이스여야 함을 직접 확인하는 단언).

이후 부등호를 원래대로 되돌리고 재실행해 32/32 Green을 재확인했다. 실제 Drive 파일은
애초에 건드리지 않았으므로 "복구"할 대상 자체가 없었다.

## 결론 — 실제로 발견했지만 적용하지 않은 것

`maximum_discount=0`일 때 정률 할인이 캡핑되지 않는 결함은 실제 운영 코드(`lib/coupons.ts`)에
그대로 남아 있다. 수정 방법(`!= null` 체크)은 이 저장소의 `real/lib/coupons.ts`에 이미
반영해 테스트로 검증까지 마쳤지만, **결제/가격 로직이라 실제 파일에는 반영하지 않았다.**
필요하면 알려달라— 그때 실제 반영을 진행한다.

## 실행 로그 (전체 통과)

```
$ npx vitest run

 ✓ src/services/createCouponOrder.test.ts (6 tests) 11ms
 ✓ real/lib/coupons.validate.test.ts (8 tests) 22ms
 ✓ src/domain/coupon.test.ts (12 tests) 7ms
 ✓ real/lib/coupons.discount.test.ts (6 tests) 4ms

 Test Files  4 passed (4)
      Tests  32 passed (32)
   Duration  948ms
```

## 커밋 히스토리 (Red/Green/Refactor가 그대로 드러남)

```
dfc4325 revert: 결함 주입 실험 원복 (< 로 복구), 32/32 Green 재확인
11771d0 test: [결함 주입 실험] eligibleSubtotal < minimumAmount -> <= 로 부등호 뒤집기 (Red 확인용, 곧 되돌림)
24ae89c test: 실제 validateCouponCode Mockito(vi.fn()) 기반 Supabase 격리 테스트 추가
966e914 fix(local-copy): maximum_discount=0 결함 수정 — truthy 체크를 != null로 변경 (Green)
39d6716 test: 실제 calculateCouponDiscount 특성화 테스트 + maximum_discount=0 결함 재현 (Red)
c0b97cc chore: 실제 lib/coupons.ts를 구글 드라이브에서 로컬 사본으로 동기화 (수정 없음)
3e041b8 test: createCouponOrder Mockito(vi.fn()) 기반 외부 의존성 격리 테스트 추가
a98a8c9 refactor: 검증 규칙을 단계별 함수로 분리, 중복 제거 (Refactor)
027ffd2 feat: calculateCouponDiscount 최소 구현으로 테스트 통과 (Green)
948a786 test: calculateCouponDiscount 실패하는 테스트 작성 (Red)
```

## 제출용 요약 — Notion에 그대로 붙여넣기용 (Task A-3, Mocking 항목)

📚 **Task A-3: 외부 의존 로직과 Mocking 실전 (제출용)**

[x] 외부 의존이 있는 로직 하나를 Mockito(가짜 객체)를 끼워 단위테스트

heobrain.store에서 쿠폰 코드를 검증하는 함수(`validateCouponCode`)를 테스트했습니다.
사용자가 쿠폰 코드를 입력하면 이 함수가 Supabase DB에서 그 쿠폰을 찾아오고, 만료됐는지·
최소 주문금액을 채웠는지 확인한 다음, 실제 할인 금액까지 계산해서 돌려줍니다. DB에
접속하는 부분과 돈을 계산하는 부분이 한 함수 안에 같이 있다는 게 포인트입니다.

🛡️ **가짜 객체(Mock)를 어디에, 왜 끼웠는가**

DB 쪽만 가짜로 만들고, 할인 계산 부분은 절대 안 건드렸습니다. Supabase는 네트워크를
타야 하니 느리고 테스트할 때마다 실제 데이터가 바뀔 수도 있어서, `.from().select().eq()`
처럼 체인으로 이어지는 Supabase 문법을 그대로 흉내 낸 가짜 객체를 만들어 함수에
끼워넣었습니다. 덕분에 DB를 한 번도 안 열고도 테스트 32개가 1초 만에 끝났습니다.

반대로 할인 금액을 계산하는 부분(`calculateCouponDiscount`)은 진짜 함수를 그대로
썼습니다. 여기까지 가짜로 만들었으면, 테스트는 통과해도 실제 서비스에서 990원
할인해야 할 걸 900원만 할인하는 사고가 나도 아무도 못 잡았을 겁니다. 배달 오토바이는
가짜로 세워두고, 요리사가 만든 음식 맛은 진짜로 확인한 셈입니다.

✅ **경계값과 행위 검증**

통과·실패만 본 게 아니라 "이 경우엔 DB를 아예 조회하면 안 된다"는 것도 확인했습니다.
쿠폰 코드를 안 넣었거나 로그인 안 한 사용자라면 Supabase를 호출하는 함수가 한 번도
안 불려야 하는데, 그걸 직접 검사했습니다. 그 외에 없는 쿠폰 코드(404), 만료된 쿠폰,
최소 주문금액과 딱 맞아떨어질 때와 1원 모자랄 때, 쿠폰을 이미 다 써버린 사용자,
정상적으로 결제되는 경우까지 8가지를 확인했습니다.

🎙️ **1분 요약**

"신입 때 흔한 실수가 테스트를 쉽게 통과시키려고 전부 다 가짜로 만들어버리는
겁니다. 저는 쿠폰 검증 로직을 테스트할 때 DB처럼 느리고 비용 드는 부분만 가짜로
바꾸고, 돈이 걸린 할인 계산은 진짜 코드를 그대로 돌렸습니다. 계산까지 가짜로
덮었으면 테스트는 통과해도 실제 결제 금액이 틀려도 아무도 몰랐을 겁니다."

📚 **Task A-3: FIRST 원칙 자가 점검 (제출용)**

[x] FIRST 원칙(Fast, Independent, Repeatable, Self-validating, Timely) 관점의 자가 점검

FIRST는 좋은 테스트가 갖춰야 할 다섯 가지 성질입니다. 제가 만든 테스트 파일 4개
(`src/domain/coupon.test.ts`, `src/services/createCouponOrder.test.ts`,
`real/lib/coupons.discount.test.ts`, `real/lib/coupons.validate.test.ts`), 테스트
32개를 하나씩 이 기준에 대보고, 진짜로 지켜졌는지 제 코드를 직접 짚어가며
확인했습니다.

⚡ **Fast (빠르다)**

"빠르다"는 건 테스트를 돌릴 때마다 오래 기다리지 않아도 된다는 뜻입니다. 제
테스트를 실제로 돌리면 이렇게 나옵니다.

```
✓ src/services/createCouponOrder.test.ts (6 tests) 11ms
✓ real/lib/coupons.validate.test.ts (8 tests) 22ms
✓ src/domain/coupon.test.ts (12 tests) 7ms
✓ real/lib/coupons.discount.test.ts (6 tests) 4ms
```

테스트 32개가 실제로 실행되는 시간만 다 더하면 44ms(0.044초)밖에 안 됩니다. 이렇게
빠른 이유는, `real/lib/coupons.validate.test.ts` 안에서 진짜 Supabase 서버에
연결하는 대신 제가 직접 만든 `createSupabaseMock(...)`이라는 가짜 객체를 쓰기
때문입니다. 네트워크를 한 번도 타지 않고 컴퓨터 메모리 안에서만 계산이 끝납니다.

🧩 **Independent (독립적이다)**

"독립적이다"는 건 테스트 A를 실행한 흔적이 테스트 B로 넘어가서 결과를 바꾸면 안
된다는 뜻입니다. `real/lib/coupons.validate.test.ts`의 테스트 8개는 각각 이렇게
시작합니다.

```ts
it("존재하지 않는 쿠폰 코드면 404를 반환한다", async () => {
  const supabase = createSupabaseMock({ coupon: null })
  ...
})
```

`createSupabaseMock(...)`을 함수 안에서 매번 새로 만들기 때문에, 앞 테스트가 넣어둔
가짜 쿠폰 데이터가 뒤 테스트로 넘어가서 결과를 망칠 수가 없습니다.
`src/services/createCouponOrder.test.ts`에서도 `beforeEach` 안에서 매번
`vi.fn()`을 새로 만들어 같은 방식을 지켰습니다.

🔁 **Repeatable (반복 가능하다) — 가장 솔직하게 짚을 부분**

"반복 가능하다"는 건 오늘 돌리든 내일 돌리든 결과가 똑같아야 한다는 뜻입니다. 그런데
실제 `lib/coupons.ts`의 `validateCouponCode` 함수 안에는 이런 코드가 있습니다.

```ts
const now = new Date()
if (coupon.valid_until && endOfDayKst(coupon.valid_until) < now) {
  return { error: "만료된 쿠폰입니다.", status: 400 }
}
```

`new Date()`가 함수 안에 직접 박혀 있어서, 테스트에서 "지금이 몇 시인지"를 제가
마음대로 바꿔 넣을 방법이 없습니다. 그래서 제 테스트("만료된 쿠폰(valid_until이
과거)이면 400을 반환한다")에서는 `valid_until: "2020-01-01"`처럼 확실히 지나간
날짜를 썼습니다. 이 프로젝트가 2020년으로 되돌아가 실행될 일은 없으니 사실상 항상
통과하긴 하지만, 엄밀히 말하면 "시간에 아예 의존하지 않는다"는 완벽한 Repeatable은
아닙니다. 나중에 `validateCouponCode`가 현재 시각을 파라미터로 받도록 고치면
(`now = new Date()`처럼 기본값은 두되 테스트에서 원하는 시각을 넣어줄 수 있게),
완전히 결정론적인 테스트로 만들 수 있습니다.

✅ **Self-validating (스스로 판정한다)**

"스스로 판정한다"는 건 사람이 결과를 읽고 "음, 맞는 것 같다"고 판단하지 않아도
된다는 뜻입니다. 제 테스트는 전부 이런 식으로 끝납니다.

```ts
expect(isCouponValidationFailure(result) && result.status).toBe(404)
```

이 한 줄이 통과인지 실패인지를 기계가 자동으로 결정합니다. 콘솔에 뭘 출력해두고
제가 직접 눈으로 읽어야 하는 테스트는 32개 중 하나도 없습니다.

⏱️ **Timely (적시에 쓰인다)**

"적시에 쓰인다"는 건 테스트를 코드 완성 한참 뒤에 몰아서 쓰지 않고, 코드를 만드는
바로 그 타이밍에 같이 쓴다는 뜻입니다. 제 git 커밋 기록을 보면 이렇게 남아 있습니다.

```
39d6716 test: 실제 calculateCouponDiscount 특성화 테스트 + maximum_discount=0 결함 재현 (Red)
966e914 fix(local-copy): maximum_discount=0 결함 수정 — truthy 체크를 != null로 변경 (Green)
```

`39d6716` 커밋에서 "최대 할인 한도가 0원이면 할인도 0원이어야 한다"는 테스트를
먼저 썼고, 그때는 이 테스트가 실패했습니다(4,950원이 나왔습니다). 그다음
`966e914` 커밋에서 코드를 딱 한 줄 고쳐서 통과시켰습니다. "테스트 먼저, 수정
나중"이라는 순서가 커밋 히스토리에 그대로 남아 있습니다. 다만 `calculateCouponDiscount`,
`validateCouponCode` 자체는 제가 만들기 전부터 있던 함수라서, 그 함수들 전체를
처음부터 TDD로 짠 건 아니라는 점은 그대로 인정합니다.

🎙️ **1분 요약**

"제 테스트를 FIRST 원칙으로 짚어보면서 가장 크게 배운 건 Repeatable이었습니다.
`validateCouponCode` 안에 `new Date()`가 직접 박혀 있다는 걸, 쿠폰 만료 테스트를
써보기 전까진 몰랐습니다. 지금은 `valid_until`을 2020년처럼 확실히 지난 날짜로
우회하고 있지만, 정확히는 함수가 '지금이 언제인지'를 스스로 정하게 설계돼 있다는
뜻이고, 나중에 현재 시각을 파라미터로 받게만 바꾸면 완전히 결정론적인 테스트가
됩니다. 커밋 `39d6716`과 `966e914`처럼, 저는 실패하는 테스트를 먼저 남기고 그다음에
최소한만 고치는 순서를 지키려고 합니다."

📚 **Task A-3: 결함 주입 실험 (제출용)**

[x] 통과한 코드를 일부러 한 군데 틀리게 바꾸고, 테스트가 Red로 바뀌는지 확인. 안
잡히면 어떤 단언을 보태야 하는지 기록.

이 실험을 하는 이유부터 짚고 갑니다. 코드를 아무리 망가뜨려도 항상 초록불만 뜨는
테스트는, 사실 아무것도 검증하지 않는 것과 같습니다. 제 테스트가 진짜로 결함을
잡아낼 수 있는지 확인하려고, 일부러 실제 코드를 한 군데 부쉈습니다.

🎯 **어디를 망가뜨렸는가**

실제 `lib/coupons.ts`의 `validateCouponCode` 함수에서, 최소 주문금액을 확인하는
부분을 골랐습니다.

```ts
// 원래 코드
if (eligibleSubtotal < minimumAmount) {
  return { error: `최소 주문 금액 ...`, status: 400 }
}
```

이 부등호를 `<`에서 `<=`로 바꿨습니다(로컬 사본에서만, 커밋 `11771d0`).

```ts
// 일부러 망가뜨린 코드
if (eligibleSubtotal <= minimumAmount) {
  return { error: `최소 주문 금액 ...`, status: 400 }
}
```

원래는 "주문 금액이 최소 금액과 정확히 같으면 통과"였는데, 바뀐 코드는 "정확히
같아도 거절"로 뒤바뀝니다. 과제에서 예시로 든 "경계 조건의 부등호를 뒤집기"에
정확히 해당하는 변경입니다.

🔴 **결과 — 진짜로 Red가 됐습니다**

```
❯ real/lib/coupons.validate.test.ts (8 tests | 1 failed)
  × 경계값: 소계가 최소 주문금액과 '정확히 같으면' 쿠폰이 통과한다
    → expected true to be false

Tests  1 failed | 7 passed (8)
```

8개 중 7개는 그대로 통과했고, "경계값이 정확히 같을 때 통과해야 한다"는 테스트
딱 1개만 실패로 바뀌었습니다. 부등호 하나를 건드렸는데 정확히 그 경계선을 겨냥한
테스트만 반응한 겁니다.

🧠 **만약 이 테스트가 없었다면?**

만약 제가 "최소금액보다 낮으면 거절되는지"만 테스트하고 "최소금액과 정확히 같을
때 통과하는지"는 테스트하지 않았다면, 이 부등호 뒤집기는 어떤 테스트도 못
잡았을 겁니다(8개 전부 그대로 초록). 실제로 나머지 7개 테스트를 보면 "최소금액보다
확실히 낮은 경우"나 "최소금액보다 충분히 높은 경우"만 다루고 있어서, 경계선
정확히 위(`=`)를 직접 찌르는 테스트가 하나도 없었다면 이 결함은 영원히 숨어있었을
겁니다.

✅ **잡아낸 단언**

```ts
expect(isCouponValidationFailure(result)).toBe(false)
```

"소계가 최소 주문금액과 정확히 같을 때는 실패가 아니어야 한다"를 직접 단언하는
이 한 줄이 있어야만 잡을 수 있는 결함이었습니다.

🔁 **원복**

망가뜨린 부등호를 다시 `<`로 되돌리고(커밋 `dfc4325`) 전체 테스트를 재실행해서
32/32 다시 통과하는 걸 확인했습니다. 실제 Drive의 파일은 애초에 건드리지
않았으므로, 그쪽은 되돌릴 것도 없었습니다.

🎙️ **1분 요약**

"테스트를 다 통과시켰다고 안심하지 않고, 일부러 실제 코드를 한 군데 부쉈습니다.
최소 주문금액 경계값의 부등호를 `<`에서 `<=`로 뒤집었더니, 8개 중 딱 1개,
'경계값이 정확히 같을 때 통과해야 한다'는 테스트만 빨갛게 변했습니다. 만약 그
테스트가 없었다면 이 결함은 나머지 테스트를 전부 통과시키고도 그대로 숨어있었을
겁니다. 저는 테스트를 짤 때 통과 여부만 보지 않고, 이 테스트가 실제로 결함을
잡아낼 수 있는지까지 검증합니다."

## GitHub에 올리는 방법

1. 이 폴더(`heobrain-coupon-order-test/`)를 압축 해제한다.
2. GitHub에 새 레포를 만들고 `git remote add origin <레포 URL>` 후 `git push -u origin main`
   (이 폴더는 이미 로컬 git 저장소이고 커밋 히스토리가 다 들어있다).
3. 실제 HeoBrain 레포에 반영하고 싶은 파일은 `real/lib/coupons.ts`(수정본, 승인 후에만),
   `real/lib/coupons.discount.test.ts`, `real/lib/coupons.validate.test.ts`를
   실제 레포의 `lib/`, `lib/__tests__/` 등 원하는 위치로 옮기고, `package.json`에
   `vitest`(+ 필요하면 `server-only`)를 devDependency로 추가하면 된다.

## 이 파일들을 GitHub 레포(TeamGrit-Job)로 옮기는 방법 — Drive에 올린 이유

이번 세션에서는 GitHub 커넥터와 로컬 G: 드라이브 마운트가 둘 다 막혀 있어, 대신
사용자의 실제 구글 드라이브 폴더 `Teamgrit-Job/phase-1-task-a3-coupon-order-test/`
안에 이 프로젝트 전체를 그대로 복사해두었다. 아래 순서로 GitHub 레포에 반영하면 된다.

1. 컴퓨터의 구글 드라이브 데스크톱 앱이 동기화를 마치면, G: 드라이브 안
   `Teamgrit-Job/phase-1-task-a3-coupon-order-test/` 폴더에 이 파일들이 그대로 나타난다.
2. 그 폴더를 실제 로컬 git 저장소(`TeamGrit-Job`을 clone해둔 폴더)로 복사해 넣는다.
3. `git add`, `git commit`, `git push`로 `https://github.com/heotaewoong/TeamGrit-Job.git`에 올린다.

커밋 히스토리(Red/Green/Refactor가 시간순으로 남아있는 것)까지 그대로 가져가고 싶다면,
같은 폴더에 있는 `heobrain-coupon-order-test.bundle` 파일을 내려받아 아래처럼 복원하면
14개 커밋이 그대로 살아있는 git 저장소가 된다.

```
git clone heobrain-coupon-order-test.bundle heobrain-coupon-order-test
```
