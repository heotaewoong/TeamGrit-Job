// Next.js가 빌드 시점에 "server-only" import를 no-op으로 치환해주는 것과 동일한 역할.
// Vitest는 Next 번들러가 아니므로 직접 별칭(alias) 처리해준다. (Next.js 공식 Vitest 가이드와 동일한 패턴)
export {};
