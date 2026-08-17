# MAX_ITERATIONS 수렴 기록

설정은 `MAX_ITERATIONS=2`다. 최초 생성은 iteration 0이며 Refine을 최대 두 번(iteration 1·2) 허용했다.

## A-3

| iteration | 점수 | 계약 판정 | 수렴 | 핵심 이유 |
|---:|---:|---|---|---|
| 0 | 3.60 | REJECT | 아니오 | Gherkin 실패 흐름과 Step Definition 누락, executability 2점 |
| 1 | 4.75 | PASS | 아니오 | 최소금액 실패 오류문구·추적 태그·실행 확인이 우선 수정으로 남음 |
| 2 | 5.00 | PASS | 예(계약) | Schema·추적성·금지 패턴·루브릭 통과, Eval priority_fixes 없음 |

`contract_converged_at_iteration=2`다. 다만 실제 실행에서는 정액 쿠폰의 `maximum_discount` 정책과 현재 구현이 충돌해 Vitest 11개 중 2개, Cucumber 13개 중 2개가 Red다. 따라서 `application_green=false`로 별도 기록한다.

## A-4

| iteration | 점수 | 계약 판정 | 수렴 | 핵심 이유 |
|---:|---:|---|---|---|
| 0 | 4.20 | PASS | 아니오 | 독립 World 직접 검증, 시계 고정, 메타데이터-실행 파일 일치가 남음 |
| 1 | 4.75 | PASS | 아니오 | 최소금액 성공 최종액과 실패 오류문구가 완결되지 않음 |
| 2 | 5.00 | PASS | 예(계약) | 모든 요구사항 ID와 실행 파일 연결, priority_fixes 없음 |

`contract_converged_at_iteration=2`이며 실제 실행도 Vitest 9/9, Cucumber 12/12 Green이다. 단, 하위 함수만으로는 items가 정말 서버 조회값인지 증명할 수 없어 신뢰 출처는 미검증 상태다.

## 결론

- A-3: 테스트 설계 계약은 iteration 2에서 수렴, 제품 구현은 정책 확인 전 Red 유지
- A-4: 테스트 설계 계약과 실행 모두 iteration 2에서 수렴
- MAX_ITERATIONS 이후 남은 문제는 테스트 문장 수정이 아니라 사람의 정책 결정 또는 상위 API 설계가 필요하다.
