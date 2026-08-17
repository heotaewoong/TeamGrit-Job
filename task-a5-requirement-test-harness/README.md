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

---

## 상세 아키텍처와 코드 흐름

> **현재 자동화 수준:** v0는 역할별 AI 세션의 결과를 파일로 전달하고, 그 이후의 Schema 검사·점수 계산·계약 판정·실행 로그 저장을 Python이 자동화하는 **파일 기반 반자동 하네스**다. \`run_pipeline.py\`가 LLM API를 직접 호출하지는 않는다.

### 전체 데이터 흐름

\`\`\`mermaid
flowchart TD
    A["자연어 요구사항<br/>inputs/*.json"] --> B["Gen 별도 세션<br/>테스트 초안 JSON"]
    B --> C["generator.py<br/>Schema 검사·실행 파일 생성"]
    C --> D["Critique 별도 세션<br/>약점 정확히 3개"]
    C --> E["Eval 별도 세션<br/>4축 점수와 근거"]
    E --> F["evaluator.py<br/>가중 총점 계산"]
    C --> G["validate.py<br/>계약 Hard Gate"]
    D --> G
    F --> G
    G -->|"PASS + priority_fixes 없음"| H["수렴<br/>verdict·실행 로그 보존"]
    G -->|"REJECT 또는 수정사항 존재"| I["Refine 세션<br/>다음 iteration"]
    I --> B
    H --> J["generated/<br/>Vitest·Feature·Step 실행"]
    J --> K["계약 판정과 실제 실행 결과를 분리 기록"]
\`\`\`

### 디렉터리 구조

\`\`\`text
task-a5-requirement-test-harness/
├─ inputs/          자연어 요구사항과 대상 소스 경계
├─ prompts/         Gen·Critique·Eval·Refine 역할 지시서
├─ schemas/         입력·생성물·비평·판정 JSON 계약
├─ rubrics/         테스트 품질 평가 기준과 가중치
├─ scripts/         포장·점수 계산·계약 검증·로그 저장 코드
├─ config/          파이프라인·Vitest·Cucumber 실행 설정
├─ generated/       파이프라인이 최종 생성한 실행 가능 테스트
├─ runs/
│  ├─ _agent-work/  역할별 AI 세션이 만든 원본
│  ├─ a3/           A-3 iteration별 정식 로그
│  └─ a4/           A-4 iteration별 정식 로그
├─ hand-written/    블라인드 비교 후 열어볼 기존 수기 테스트 목록
├─ tests/           Validate 자체의 회귀 테스트
├─ COMPARISON.md
├─ V0-LIMITATIONS.md
└─ README.md
\`\`\`

## 단계별 입력과 출력

| 단계 | 담당 | 읽는 파일 | 만드는 파일 | 직접 하지 않는 일 |
|---|---|---|---|---|
| Gen | 테스트 설계 AI 세션 | \`inputs/*.json\`, 명시된 프로덕션 소스 | \`runs/_agent-work/*/iteration-N-draft.json\` | 점수·자기비평·PASS 판정 |
| Package | \`generator.py\` | 입력 JSON, Gen draft, Scenario Schema | \`02_output.json\`, \`generated/*\` | 테스트 품질 평가 |
| Critique | 별도 시니어 QA 세션 | 요구사항, 생성 결과 | \`iteration-N-critique.json\` | 점수 계산·직접 수정 |
| Eval | Gen·Critique와 다른 세션 | 생성 결과, YAML Rubric | \`iteration-N-assessment.json\` | 가중 총점 계산·결과 수정 |
| Score | \`evaluator.py\` | 생성 결과, Rubric, Eval assessment | 초기 \`04_verdict.json\` | 테스트 생성 |
| Validate | \`validate.py\` | 입력·생성물·점수·Schema | 최종 \`04_verdict.json\` | 모호한 정책 결정 |
| Log | \`run_pipeline.py\` | 위 단계 전체 결과 | \`EXECUTION-LOG.json/.md\` | Vitest·Cucumber 실제 실행 |
| Refine | Gen 역할의 다음 세션 | Critique 3개, \`priority_fixes\` | 다음 iteration draft·change log | 새 요구사항 발명 |

## 주요 코드의 책임

### 1. \`scripts/generator.py\` — Gen 결과를 안전하게 실행 파일로 포장

이 파일은 모델을 호출하지 않는다. 이미 분리된 Gen 세션이 만든 JSON을 받아 다음 작업만 결정론적으로 수행한다.

1. Input과 Gen 결과의 \`requirement_hash\`가 같은지 확인한다.
2. Gen 결과가 \`scenarios.schema.json\`을 만족하는지 검사한다.
3. \`generated_files\`에 들어 있는 Vitest·Feature·Step 코드를 실제 파일로 쓴다.
4. \`safe_output_path()\`로 \`../../.env\` 같은 경로 탈출을 막는다.
5. 포장 시각을 기록해 \`02_output.json\`으로 보존한다.

### 2. \`scripts/evaluator.py\` — 독립 Eval의 점수를 기계적으로 계산

Eval AI는 축별 점수와 근거만 제출한다. Python은 다음 조건을 검사하고 최종 점수를 계산한다.

- 네 평가 축이 모두 있는가
- 점수가 1~5 정수인가
- 각 점수에 구체적인 근거가 있는가
- Gen과 Eval의 session ID가 다른가
- Input·생성물·평가의 \`requirement_hash\`가 같은가
- Rubric 가중치 합이 정확히 1.0인가

\`\`\`text
weighted_total =
coverage × 0.35
+ unambiguity × 0.25
+ independence × 0.20
+ executability × 0.20
\`\`\`

총점은 4.0 이상이어야 하며, 어느 한 축이라도 3점 미만이면 Rubric REJECT다.

### 3. \`scripts/validate.py\` — 최종 계약 Hard Gate

Validate는 다음 항목 중 하나라도 실패하면 최종 판정을 REJECT로 바꾼다.

1. Scenario JSON Schema 위반
2. Input·Gen·Eval의 요구사항 해시 불일치
3. Gen과 Eval session ID 동일
4. \`MAX_ITERATIONS\` 초과
5. 검증 불가능한 금지 표현 사용
6. 요구사항 ID가 어떤 테스트에도 연결되지 않음
7. 테스트 ID 중복 또는 존재하지 않는 요구사항 참조
8. 테스트 대상 자체를 Mock
9. Vitest 또는 Gherkin 산출물 누락
10. Rubric 최소 점수 미달

금지 패턴 예시는 다음과 같다.

\`\`\`text
should work
works as expected
정상 동작
잘 처리
적절히 처리
문제없이 작동
\`\`\`

### 4. \`scripts/run_pipeline.py\` — 한 iteration을 마감하는 진입점

실행 순서는 다음과 같다.

\`\`\`text
Input Schema 검사
→ 01_input.json 저장
→ generator.package_artifact()
→ 02_output.json·generated 파일 생성
→ Critique Schema·hash 검사
→ 03_critique.json 저장
→ evaluator.evaluate()
→ validate.validate_contract()
→ 04_verdict.json 저장
→ Verdict Schema 검사
→ 03a_assessment.json 저장
→ EXECUTION-LOG.json·md 저장
→ PASS는 exit code 0, REJECT는 exit code 2
\`\`\`

## Schema가 강제하는 내용

### 입력 계약 — \`schemas/input.schema.json\`

입력에는 다음 필드가 반드시 있어야 한다.

- \`requirement_hash\`
- \`task\`
- \`target_stack\`
- \`requirements\`
- \`source_files\`
- \`constraints\`
- \`created_at\`

요구사항은 \`REQ-...\` ID, 자연어 설명, 위험도를 가진다. \`source_files\`는 AI가 볼 수 있는 프로덕션 코드의 경계다.

### 생성물 계약 — \`schemas/scenarios.schema.json\`

Gen 결과에는 다음 세 묶음이 반드시 존재한다.

- \`unit_tests\`: Arrange·Act·Assertion·Mock 계획
- \`gherkin_scenarios\`: Given·When·관찰 가능한 Then
- \`generated_files\`: 실제 Vitest·Feature·Step Definition 코드

모든 테스트에는 \`test_id\`와 \`requirement_ids\`가 있어야 한다. 따라서 요구사항에서 실행 코드까지 역추적할 수 있다.

### 비평 계약 — \`schemas/critique.schema.json\`

Critique는 약점을 **정확히 3개** 제출하며 각 항목에는 다음 내용이 필요하다.

- \`location\`
- \`problem\`
- \`evidence\`
- \`revision_direction\`

“더 자세히 작성” 같은 지시는 허용하지 않고, 어떤 테스트에 어떤 단언을 추가할지 적는다.

## 한 iteration 실행 방법

하네스 디렉터리에서 다음처럼 실행한다.

\`\`\`powershell
python .\scripts\run_pipeline.py \`
  --input .\inputs\a3-requirements.json \`
  --draft .\runs\_agent-work\a3\iteration-0-draft.json \`
  --critique .\runs\_agent-work\a3\iteration-0-critique.json \`
  --assessment .\runs\_agent-work\a3\iteration-0-assessment.json \`
  --run-dir .\runs\a3\iteration-0 \`
  --max-iterations 2
\`\`\`

정식 실행 폴더는 다음처럼 만들어진다.

\`\`\`text
runs/a3/iteration-0/
├─ 01_input.json
├─ 02_output.json
├─ 03_critique.json
├─ 03a_assessment.json
├─ 04_verdict.json
├─ EXECUTION-LOG.json
└─ EXECUTION-LOG.md
\`\`\`

\`MAX_ITERATIONS=2\`는 총 2회 실행이 아니라 최초 iteration 0 이후 Refine을 최대 두 번 허용한다는 뜻이다.

\`\`\`text
iteration 0: 최초 생성
iteration 1: 첫 번째 Refine
iteration 2: 두 번째 Refine
\`\`\`

## 생성 테스트 실행

생성 테스트는 기존 A-3·A-4 수기 테스트와 섞이지 않도록 별도 설정으로 실행한다.

\`\`\`powershell
npx vitest run --config task-a5-requirement-test-harness/config/vitest.generated.config.ts
\`\`\`

Cucumber는 Feature와 Step Definition을 명시해 실행한다.

\`\`\`powershell
node --import ./task-a5-requirement-test-harness/generated/support/server-only-loader.mjs \`
  --import tsx ./node_modules/@cucumber/cucumber/bin/cucumber.js \`
  --config task-a5-requirement-test-harness/config/cucumber.generated.mjs \`
  task-a5-requirement-test-harness/generated/features/a4-coupon-order.feature \`
  --import task-a5-requirement-test-harness/generated/steps/a4-coupon-order.steps.ts
\`\`\`

## A-4 실제 수렴 사례

\`\`\`text
iteration 0
- 점수: 4.20
- Rubric: PASS
- 수렴: 아니오
- 남은 문제: 독립 World 직접 검증, 고정 시계, 실행 파일 연결

iteration 1
- 점수: 4.75
- Rubric: PASS
- 수렴: 아니오
- 남은 문제: 최소금액 성공 최종액과 실패 오류문구

iteration 2
- 점수: 5.00
- Contract: PASS
- priority_fixes: 없음
- 수렴: 예
- 실제 실행: Vitest 9/9, Cucumber 12/12 Green
\`\`\`

점수가 4.0을 넘었다고 바로 멈추지 않았다. Contract가 PASS이고 \`priority_fixes\`가 없을 때만 수렴으로 기록했다.

## 현재 자동화 범위

### 자동화된 부분

- JSON Schema 검사
- 요구사항 해시 비교
- 생성 코드 파일 저장
- Rubric 가중 점수 계산
- Gen/Eval session ID 분리 검사
- 요구사항 ID ↔ 테스트 ID 추적성 검사
- 금지 패턴과 Mock 경계 검사
- PASS/REJECT 판정
- iteration별 파일과 실행 로그 보존

### 외부 세션 또는 사람에게 남은 부분

- Gen·Critique·Eval·Refine AI 세션 호출
- 실제 제품 정책의 모호함 해소
- 생성된 Vitest·Cucumber 실행
- 테스트 실패가 제품 버그인지 요구사항 해석 오류인지 판단
- 현재 함수의 관찰 범위를 넘는 상위 API·보안 계약 결정

## v0의 코드 수준 한계와 v1 방향

1. **\`pipeline.yaml\`이 실행 코드에 직접 연결되지 않았다.** 현재 \`run_pipeline.py\`는 Schema·Rubric 경로와 기본 iteration을 코드에서 정한다. v1은 YAML을 단일 설정 원천으로 읽어야 한다.
2. **Critique는 기록되지만 Hard Gate에 직접 반영되지 않는다.** v1은 \`blocking|major|minor\` 심각도를 추가하고 blocking이 있으면 \`NEEDS_HUMAN\`으로 중단해야 한다.
3. **\`priority_fixes\`는 수렴에는 사용되지만 종료 코드에는 반영되지 않는다.** v1은 PASS·REJECT·PASS_BUT_NOT_CONVERGED를 구분해야 한다.
4. **정적 executability와 실제 실행 결과가 분리돼 있다.** v1은 Vitest·Cucumber exit code를 \`execution_verdict\`로 Validate에 전달해야 한다.
5. **하위 함수가 관찰할 수 없는 데이터 출처 문제가 있다.** 현재 SUT 밖의 요구사항은 점수를 계산하지 않고 \`CONTRACT_BOUNDARY_MISMATCH\`로 보내야 한다.

최종적으로 v1은 다음 세 판정을 분리하는 것이 목표다.

\`\`\`text
contract_verdict  : 테스트 설계 계약을 지켰는가
execution_verdict : 실제 Vitest·Cucumber가 통과했는가
human_verdict     : 정책·보안·상위 API 결정이 필요한가
\`\`\`

