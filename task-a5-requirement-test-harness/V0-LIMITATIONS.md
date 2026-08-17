# v0 한계와 v1 개선 방향

1. **Critique와 Eval이 충돌해도 Eval 단독으로 수렴할 수 있다.** iteration 2에서 Eval은 5점을 줬지만 Critique는 A-3 정책 충돌과 A-4 신뢰 출처 문제를 찾았다. v1은 Critique에 `severity: blocking|major|minor`를 추가하고 blocking이 하나라도 있으면 `NEEDS_HUMAN`으로 보내야 한다.
2. **executability가 실제 실행을 뜻하지 않았다.** 정적 Eval은 코드를 구현 가능하다고 판단했지만 실제 A-3 실행은 제품/정책 불일치로 Red였다. v1 Validate는 Vitest·Cucumber exit code를 별도 `execution_verdict`로 받아야 한다.
3. **하위 API로 데이터 출처를 증명할 수 없다.** `validateCouponCode(items)`는 items 우선 계산은 검증할 수 있지만 서버 조회값인지는 알 수 없다. v1은 요구사항이 현재 SUT의 관찰 범위를 넘으면 점수 대신 `CONTRACT_BOUNDARY_MISMATCH`로 중단해야 한다.

추가로 첫 실행에서 Eval 근거가 문자열 배열인데 verdict schema는 문자열만 허용하는 계약 불일치가 발견됐다. `evaluator.py`가 배열을 결정적으로 합쳐 저장하도록 수정해 반복 오류를 제거했다.
