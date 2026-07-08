# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 현황

이 저장소는 **아직 코드가 없는 기획 단계**다. 현재 존재하는 것은 계획 문서뿐이다.

- `developer_plan.md` — Solar Market Intelligence MVP 개발계획서 (v0.3). 스택, DB schema 초안, API 설계, 권한 모델, 시간/단위 정책, 6주 일정의 **단일 진실 공급원(source of truth)**. 코드 작성 전 반드시 참조한다.
- `vpp_public_data_mvp_plan.md` — 상위 사업계획서. 프로젝트가 "VPP 통합제어 플랫폼이 아니라 공공데이터 기반 분석 MVP"라는 범위 결정의 배경.

`package.json`, 소스 디렉터리, 빌드/lint/test 설정은 아직 없다. **스캐폴딩이 첫 작업**이며, 그 구조와 버전은 계획서에서 이미 확정되어 있으므로 임의로 바꾸지 말고 따른다. 계획서와 충돌하는 결정을 하기 전에는 사용자에게 확인한다.

## 프로젝트 본질

공공데이터(한국전력거래소/기상청)로 전력수급, 지역별 태양광·풍력 발전량, SMP/REC 가격, 수익 시뮬레이션, 제한적 발전량 예측을 묶은 **태양광 O&M 업체용 분석 대시보드 MVP**. 초대 기반 비공개 SaaS 데모로 시작한다.

범위를 지킬 것 — 다음은 **명시적으로 MVP 제외**: 실제 VPP 입찰/거래, 전력거래소 실거래, 인버터/ESS/충전기 제어, 법적·회계적 정산 확정. 수익 계산은 항상 "실제 정산이 아닌 가정 기반 시뮬레이션"으로 면책 문구와 함께 표시한다.

## 계획된 아키텍처

monorepo. 계획서 기준 디렉터리 구성:

- `apps/web` — Next.js 16 + React 19 + shadcn/ui + Tailwind 4. Better Auth가 로그인 UI와 세션 쿠키, `/api/auth/*` route handler를 담당.
- `apps/api` (NestJS 11) — 보호 API. JWT를 `jose`로 검증.
- `packages/db` — Drizzle ORM schema와 drizzle-kit migration. schema/migration은 여기서만 관리.
- `packages/contracts` — Zod schema. frontend/backend/worker가 공유하는 API 요청·응답 계약.
- Data pipeline worker (NestJS worker 또는 별도 TS worker) — 공공데이터 수집/정제.
- `apps/ml` — 예측 baseline. 초기엔 TypeScript, baseline 초과 시에만 Python sidecar 분리.

확정 스택: `Next.js + shadcn/ui + NestJS + Neon Postgres + Drizzle + Better Auth + Zod`. Node 24.18.0 LTS (Krypton), TypeScript는 `5.9.x` 고정, zod는 v4 계열. 정확한 권장 패키지 버전 표는 `developer_plan.md` §7.3에 있으니 그대로 사용한다.

## 데이터 레이어 (핵심 규약)

수집 데이터는 schema 단위로 분리한다. 코드 작성 시 이 경계를 지킨다.

```
raw      : 원본 API 응답/CSV 파일 저장 (object_path + content_hash)
staging  : 타입 변환, 컬럼명 정규화, 중복 제거
mart     : 화면/API 조회 최적화 테이블
model    : 예측 feature table
ops      : 수집 실행 이력, 오류, 품질 검사
```

수집 흐름: `Datasource Adapter → Raw Store → Staging Transform → Quality Check → Mart Upsert → API/Dashboard`

불변 규칙:
- 원본 응답은 항상 저장한다.
- datasource별 **adapter로 분리**한다. 외부 API가 바뀌어도 adapter만 교체.
- 모든 수집 실행은 `ingestion_run`에 기록하고, 실패는 status code/응답 일부/재시도 횟수를 남긴다.
- 중복 적재는 source natural key + `datasource_id`로 막는다 (각 테이블의 `UNIQUE` 제약 참조).
- 개발계정 트래픽 제한(실시간 API 100건)을 고려해 캐시·증분 수집을 기본으로.

DB schema 초안 전체(`datasource`, `ingestion_run`, `raw_object`, `data_quality_check`, `generation_hourly`, `smp_hourly`, `rec_market_daily`, `supply_realtime` 등)는 `developer_plan.md` §9에 SQL로 정의되어 있다.

## 시간·단위 정책 (어기면 데이터 오염)

- 내부 저장은 `timestamptz` + KST 표시값 병행. 거래시간은 source별로 0–23 / 1–24 여부를 확인해 adapter에서 명시 변환하고, `interval_start_at` / `interval_end_at`으로 통일.
- 일사량 등 UTC 원천은 `observed_at_utc`와 `observed_at_kst`를 함께 저장.
- 지역은 `region_code`로 표준화. 단위는 `MW`/`MWh`/`kWh`/`원/kWh`/`원/REC`로 명시. SMP는 육지/제주(`market_area`) 구분 필수.
- 발전량은 MWh 저장, 수익 계산 시 kWh 변환.

## 인증·권한·테넌트 격리

흐름: `Browser → Next.js(Better Auth 세션 쿠키) → Better Auth JWT → NestJS(Authorization: Bearer) → JwtAuthGuard → OrganizationGuard → PermissionGuard → Service`

- access token을 브라우저 localStorage에 저장 금지. 세션은 `httpOnly`/`secure`/`sameSite=lax` 쿠키.
- Next.js route 보호는 1차 방어선(UX)일 뿐, **실제 데이터 접근 권한은 NestJS service layer에서 다시 검사**한다.
- 모든 고객 데이터 테이블·쿼리는 `organization_id` 또는 `plant_id` scope를 요구한다. organization scope 누락 방지 테스트를 둔다.
- RBAC 역할: `platform_admin` / `owner` / `admin` / `analyst` / `viewer` (정의는 §10.4). 공개 회원가입 없음 — 초대 기반(토큰 7일 만료).
- 권한 변경, 초대, CSV 업로드, 리포트 생성은 `audit_log` 대상.
- Better Auth 테이블은 서비스 도메인과 충돌 방지를 위해 `auth_` prefix(`auth_user`, `auth_session`, ...)로 둔다.

## Zod 계약 검증 규약

- 모든 query/path/body 입력은 NestJS controller 진입 시 Zod로 검증, 잘못된 입력은 일관된 400.
- 외부 공공데이터 응답은 **raw 저장 후 staging 변환 전** Zod로 최소 필수 필드/타입 검증.
- 환경변수는 앱 부팅 시 Zod로 검증하고 실패 시 프로세스를 시작하지 않는다.
- DTO 타입은 `z.infer<typeof Schema>`로 생성 (타입 중복 금지).
- NestJS 보조 패키지 일부가 Zod v3 peer에 묶여 있으므로, 핵심 검증은 보조 패키지 대신 직접 Zod schema + pipe/helper로 구현.

## 1주차 게이트 (작업 전 인지)

SMP 데이터의 기존 `계통한계가격조회` API는 삭제 예정 안내 상태다. 대체 소스(API → 일별 파일 → 사용자 입력 fallback, §5.5)가 확정되기 전에는 SMP 기능을 "완료"로 보지 않으며, 대시보드에선 "소스 검증 중", 시뮬레이터는 사용자 입력 가격 기반으로 먼저 연다.

## 문서 작성 언어

계획 문서는 한국어 산문 + 영어 기술용어/코드/SQL 혼용이다. 문서를 수정·추가할 때 이 톤을 유지한다.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
