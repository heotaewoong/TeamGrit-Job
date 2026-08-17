# 최종 실행 결과

## 기존 수기 산출물

```text
A-3 Vitest: 4 files, 32 tests passed
A-4 Cucumber: 10 scenarios, 72 steps passed
A-5 Validate 단위 테스트: 4 tests passed
TypeScript: tsc --noEmit passed
```

## 파이프라인 생성 산출물

```text
A-3 generated Vitest: 11 tests, 9 passed, 2 failed
A-3 generated Cucumber: 13 scenarios, 11 passed, 2 failed
A-4 generated Vitest: 9 tests, 9 passed
A-4 generated Cucumber: 12 scenarios, 12 passed (112 steps)
```

A-3의 네 실패는 같은 원인이다. 정액 5,000원 쿠폰에 `maximum_discount=2,000` 또는 `0`을 주었을 때 요구사항은 각각 2,000원·0원을 기대하지만 현재 `calculateCouponDiscount`의 fixed 분기는 한도를 읽지 않아 5,000원을 반환한다.

테스트를 억지로 Green으로 바꾸지 않았다. 다음 중 하나를 사람이 결정해야 한다.

1. 최대 할인 한도가 정률·정액 모두에 적용된다면 프로덕션 fixed 분기를 수정한다.
2. 최대 할인 한도가 정률 전용 정책이라면 `REQ-A3-CAP`을 좁히고 정액 테스트를 제거한다.

결제·가격 정책이므로 A-5 범위에서 프로덕션 코드는 수정하지 않았다.
