# Refine — 근거 기반 테스트 수정

Gen 역할이 Critique 3개와 Eval의 `priority_fixes`를 입력받아 다음 iteration을 만든다.

1. 지적된 항목마다 `변경 전 / 변경 후 / 근거`를 변경 로그에 남긴다.
2. 새 요구사항을 발명하지 않는다.
3. 누락 케이스는 requirement_id에 연결한다.
4. 모호한 Then은 관찰 대상과 정확한 기대값으로 교체한다.
5. Mock 남용은 실제 도메인 함수 호출로 되돌린다.
6. iteration을 1 증가시키고 같은 scenario schema로 출력한다.
7. MAX_ITERATIONS=2를 넘기지 않는다.
