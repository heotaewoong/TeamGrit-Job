# TeamGrit Phase 1 테스트 엔지니어링

HeoBrain 쿠폰 주문 도메인으로 수행한 A-3·A-4와, Phase 0 글쓰기 하네스를 테스트 생성에 이식한 A-5를 분리해 보존한다.

## 폴더

- `task-a3-unit-tests/`: Vitest 단위 테스트 32개와 TDD·Mock·FIRST·결함 주입 기록
- `task-a4-bdd-tests/`: Cucumber 인수 테스트 10개와 AI 블라인드 구현 비교
- `task-a5-requirement-test-harness/`: Gen → Critique → Eval → Refine → Validate 파이프라인

## 실행

```bash
npm install
npm run test:a3
npm run test:a4
python -m unittest discover -s task-a5-requirement-test-harness/tests -v
```

A-4는 A-3에서 검증한 `task-a3-unit-tests/real/lib/coupons.ts`를 직접 import한다. 따라서 폴더는 분리되어도 검증 대상 프로덕션 코드는 하나다.
