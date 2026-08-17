# Task A-5 — 요구사항을 테스트로 변환하는 파이프라인 v0

자연어 요구사항을 단위 테스트와 Gherkin 시나리오로 바꾸고, 생성과 평가를 분리해 검증하는 파일 기반 하네스다.

## 작동 방식

1. **Gen**: 요구사항과 프로덕션 소스만 읽고 JSON 테스트 초안을 만든다.
2. **Critique**: 별도 시니어 QA 세션이 경계값·실패 케이스·모호한 Then·Mock 남용 중 핵심 빈틈 3개를 찾는다.
3. **Eval**: Gen과 다른 세션이 coverage·unambiguity·independence·executability를 평가한다.
4. **Refine**: REJECT 근거를 반영해 다음 iteration을 만든다.
5. **Validate**: Python이 Schema, 추적성, 금지 패턴, 세션 분리, 가중 점수를 기계적으로 검사한다.

과제의 공식 네 단계는 Gen·Critique·Eval·Validate이며, Refine은 Eval 또는 Validate가 실패했을 때 실행되는 반복 동작으로 유지했다.

## Phase 0에서 재사용한 부분

| 재사용 | 원본 | A-5 변경 |
|---|---|---|
| `generator.py` 파일 경계 | 글 원고 JSON 포장 | 테스트 시나리오 JSON과 실행 파일 포장 |
| `evaluator.py` | 구조·근거·말투 가중 평가 | 테스트 품질 4축 가중 평가 |
| `validate.py` | Schema·금지어·최저점 | 추적성·모호한 단언·Mock 경계·min_total |
| JSON Schema | input/output/verdict 계약 | 요구사항/시나리오/비평/판정 계약 |
| YAML rubric | 가중치 합 1.0 | coverage 0.35 등 테스트 축 |
| 파일 핸드오프 | `brief_hash`, 단계별 JSON | `requirement_hash`, 단계별 JSON |
| 반복 규칙 | 최대 2회 | iteration 0 + Refine 최대 2회 |

## 새로 만든 부분

- Vitest 단위 테스트와 Gherkin을 동시에 표현하는 `scenarios.schema.json`
- 정확히 약점 3개를 요구하는 `critique.schema.json`
- 요구사항 ID ↔ 테스트 ID 추적성 검사
- `should work`, `정상 동작` 등 금지 패턴 검사
- 테스트 대상 자체를 Mock하면 REJECT하는 계약
- 기존 수기 테스트를 숨긴 블라인드 비교 절차

## 합격 기준

- 가중 총점 `4.0 / 5.0` 이상
- 모든 평가 축 3점 이상
- 단위 테스트와 Gherkin 각각 1개 이상
- 모든 요구사항 ID가 테스트에 연결
- Gen과 Eval session ID가 다름
- JSON Schema·금지 패턴·Mock 계약 통과

## 실행 예시

```bash
python scripts/run_pipeline.py \
  --input inputs/a3-requirements.json \
  --draft runs/_agent-work/a3/iteration-0-draft.json \
  --critique runs/_agent-work/a3/iteration-0-critique.json \
  --assessment runs/_agent-work/a3/iteration-0-assessment.json \
  --run-dir runs/a3-iteration-0
```

`run_pipeline.py`는 LLM을 직접 호출하지 않는다. 각 역할의 결과 파일을 받아 계산과 검증만 수행하기 때문에 Gen의 대화 문맥이 Eval로 새지 않는다.

생성 파일은 기존 A-3·A-4 테스트와 섞이지 않도록 별도 설정으로 실행한다.

```bash
npx vitest run --config task-a5-requirement-test-harness/config/vitest.generated.config.ts
node --import ./task-a5-requirement-test-harness/generated/support/server-only-loader.mjs \
  --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber.js \
  --config task-a5-requirement-test-harness/config/cucumber.generated.mjs \
  task-a5-requirement-test-harness/generated/features/a3-coupon.feature \
  --import task-a5-requirement-test-harness/generated/steps/a3-coupon.steps.ts
```

## 실행 결과

- A-3 계약: iteration 2에서 5.0 PASS. 실제 실행은 정액 maximum_discount 정책 충돌로 2개 Red.
- A-4 계약: iteration 2에서 5.0 PASS. 실제 실행은 Vitest 9/9, Cucumber 12/12 Green.
- 상세 수렴: `runs/CONVERGENCE.md`
- 실제 실행: `runs/EXECUTION-RESULTS.md`
- 수기 테스트 비교: `COMPARISON.md`
- v0 한계: `V0-LIMITATIONS.md`
