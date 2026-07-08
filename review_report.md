# Solar Market Intelligence MVP 개발계획서 검토 리포트

- 검토 대상: `developer_plan.md` (v0.3, 2026-06-29)
- 검토일: 2026-06-29
- 검토 방식: 6개 전문 영역 병렬 검토 (백엔드 아키텍처 / 프론트엔드 / DBA·데이터엔지니어링 / 제품기획·일정 / 보안·인증 / 공공데이터·에너지 도메인)
- 상태: 내부 검토 결과

---

## 0. 종합 결론

계획서의 품질은 기획 단계 문서로는 **평균 이상**이다. 데이터 거버넌스(원본 보존·수집이력·품질검사), 시간/단위 정책, 시뮬레이션 면책, 스택 버전 핀, SMP 삭제 리스크의 게이트화 등 도메인을 모르면 쓸 수 없는 판단이 곳곳에 있다. 검증 결과:

- **스택 버전표(§7.3)는 환각이 아니다.** npm registry 전수 확인 결과 next 16.2.9 / react 19.2.7 / better-auth 1.6.22 / drizzle-orm 0.45.2 / zod 4.4.3 등 전부 실재하며 peer dependency 사슬도 정합.
- **§20 공공데이터셋 ID·URL도 전부 실재**하고 설명과 일치 (메타데이터 대조 확인).

그러나 **세 가지 구조적 문제**가 여러 영역에서 중복 지적됐다.

| # | 문제 | 지적 영역 | 핵심 |
|---|---|---|---|
| 1 | "검증용 데모"인데 "운영 SaaS"를 짓는 범위 과적재 | 기획·백엔드·보안 | 공공데이터 단계엔 격리할 고객 데이터가 없음. 인증/RBAC/감사/멀티테넌트가 Must Have로 과투자. 3주차 한 주가 통째 인증에 묶임 |
| 2 | 6주 일정에 인력 가정이 없고 현 범위로는 비현실적 | 기획·백엔드·프론트 | FTE 미명시(1인이면 10~12주). 외부 의존(활용신청 승인 대기)이 크리티컬 패스인데 버퍼 0. 숨은 작업(분리 인증 토큰 주입·ECharts SSR·multi-org 캐시)이 일정에 미반영 |
| 3 | 고객 인터뷰가 6주차 끝에 배치된 build trap | 기획 | §19는 "대응=개발 전 인터뷰"라 적고도 일정엔 맨 끝. 성공/실패 판정 metric이 전무 (DoD가 전부 기술 완료 기준) |

**한 줄 요약:** 스택·데이터 설계 품질은 신뢰할 만하나, *"검증 도구"가 아니라 "운영 제품"을 6주에 짓도록 범위가 짜였고, 가설을 판정할 metric과 고객 인터뷰가 맨 끝으로 밀린 것*이 가장 큰 리스크다. 인증·예측을 덜고 인터뷰·metric을 앞당기면 같은 6주가 검증 스프린트로 바뀐다.

---

## 1. 백엔드 아키텍처 검토

### 종합
모노레포 경계(apps/web, apps/api, packages/db, packages/contracts, worker, apps/ml)는 표준적이고 합리적이다. 설계 품질은 높으나 **분산 배포 통합 지점들이 과소평가**되어 있다.

### 치명적
- **[높음] Next(web) ↔ NestJS(api) 분리 배포 시 인증 흐름 미설계** (`developer_plan.md:630-649`)
  세션은 `httpOnly` 쿠키라 브라우저 JS가 토큰을 못 읽는데, NestJS는 `Authorization: Bearer`를 요구한다. **누가 토큰을 꺼내 전달하는지가 비어 있다.** → BFF 패턴(브라우저는 Next만 호출, Next 서버사이드가 JWT 주입 후 NestJS 프록시)을 명시 채택. 1주차에 "로그인→보호 API 1개 호출" walking skeleton을 게이트로 추가.

### 주요
- **[높음] 트래픽 100건 vs 5분 수집 산술 검증 부재** → 도메인 검토 [H-6]에서 정정됨(아래 §6 참조). 실제로는 수급/태양광=100건/시간이라 5분 수집 가능하나, 데이터소스별 한도 단위를 1주차에 확정해야.
- **[높음] 6주 일정 백엔드 작업량 과소평가** — 2주차 adapter 4종 × (raw→staging→quality→mart) + 멱등성은 2~3주 분량. 3주차 Better Auth 통합 + 3-guard + 대시보드는 인증 통합 미해결 시 막힘.
- **[중간] packages/contracts(Zod) 공유의 빌드·버전 결합** (`developer_plan.md:554`) — frontend/backend/worker가 zod 버전 강제 동기화. zod v3 peer 보조 패키지 혼입 시 dual-instance 문제. → `api-contracts`(req/res)와 `ingestion-schemas`(외부 응답 검증) 분리. zod single-version policy.
- **[중간] API 설계 구조적 결함** (`developer_plan.md:565-583`) — 버저닝 없음(`/v1` 부재), 페이지네이션·시계열 max range 가드 부재(전력수급 5분 해상도 = 연 10만 row), 표준 에러 envelope 미정의(429 트래픽 초과 포함), 응답 Zod `.parse()` 비용. → `/api/v1/` prefix, cursor 페이지네이션 + 서버측 다운샘플링, 통일 에러 필터.
- **[중간] cron→BullMQ 전환 기준·멱등 upsert 책임 경계 모호** (`developer_plan.md:205,277-281`) → 처음부터 BullMQ(cron은 repeatable job 트리거로만), mart는 `ON CONFLICT DO UPDATE` upsert를 단일 진실로, `partial` status 정의·재진입 규칙 명시.
- **[중간] apps/ml TS→Python sidecar 전환 비용 미평가** (`developer_plan.md:207,224`) → TS baseline에서 멈추는 것을 기본값으로, 전환은 비즈니스 게이트(예측이 구매 결정 요인일 때)로. feature 계약을 지금 Zod로 고정.

### 사소
- worker를 "NestJS worker vs 별도 TS worker"로 미정 → NestJS standalone application 권장(DI/config/DB풀 재사용). 1주차 확정.
- Better Auth schema 소유권: `packages/db`(drizzle-kit)와 Better Auth 자체 schema 관리 충돌 → 1주차에 통합 방식 결정.

---

## 2. 프론트엔드 검토

### 버전 호환성 검증 결과 (npm registry 전수 확인)
**§7.3 버전표는 환각이 아니라 실제 npm `latest`와 정확히 일치한다.**

| 패키지 | 권장(문서) | 실제 latest | 메모 |
|---|---|---|---|
| next | 16.2.x | 16.2.9 | `node >=20.9` 정확 |
| react/react-dom | 19.2.x | 19.2.7 | 정합 |
| @nestjs/* | 11.1.x | 11.1.27 | 정합 |
| better-auth | 1.6.x | 1.6.22 | peer가 next ^14\|\|15\|\|16, drizzle-orm ^0.45.2 요구 — 완벽 정합 |
| drizzle-orm | 0.45.x | 0.45.2 | better-auth peer와 정확히 일치 |
| zod | 4.4.x | 4.4.3 | v4 |
| @hookform/resolvers | 5.4.x | 5.4.0 | Standard Schema 기반, zod v4 OK |
| shadcn | 4.12.x | 4.12.0 | **CLI 버전**이지 UI 컴포넌트 버전 아님(주의) |
| lucide-react | 1.22.x | 1.22.0 | 메이저 1.x 실재 |
| tailwindcss | 4.3.x | 4.3.1 | 메이저 4 |
| echarts | "최신 stable" | 6.1.0 | 버전 미핀 — 명시 권장 |
| echarts-for-react | (누락) | 3.0.6 | **표에서 누락됨**. peer가 react>=16이라 React 19 명시 미포함 |

표기 함정 2건: (a) `shadcn 4.12.x`는 CLI 도구 버전이지 "UI 컴포넌트 세트 버전"이 아님 — 비고에 명시 필요. (b) `echarts-for-react`가 표에 없음.

### 주요
- **[높음] 2-서버 인증의 fetch 래퍼 복잡도** (`developer_plan.md:630-649`) — 공식 흐름(`authClient.token()` → NestJS `jose.createRemoteJWKSet`)은 설계가 옳다. 문제는 **토큰 주입 경로가 RSC용/CSR용 2벌**이고 단명 JWT 재발급 래퍼가 필요한데 일정·DoD에 안 보임. → BFF 단일 경로 권장 or 1주차 fetch 래퍼 스파이크.
- **[높음] ECharts SSR/하이드레이션 함정** (`developer_plan.md:199,251`) — Next 16 App Router 기본 RSC인데 ECharts는 `window`/canvas 의존이라 서버렌더 불가. 반드시 `"use client"` + `next/dynamic({ssr:false})` + 고정 height. P0/P1 화면 6종 중 5종이 그래프라 함정이 곱해짐. → `<ChartContainer>` 단일 래퍼로 캡슐화, `echarts-for-react` 버전 표 추가(또는 `echarts/core` tree-shaking).
- **[중간] shadcn Data Table + Tailwind 4 학습/구현 비용** — Tailwind 4는 CSS-first `@theme` 패러다임(v3와 다름). shadcn Data Table은 컴포넌트가 아니라 TanStack Table 배선 레시피. 서버 페이지네이션은 레시피 너머. → MVP는 차트 중심, 테이블은 최신 N건 클라 페이지네이션으로 최소화.
- **[중간] RHF + zod resolver와 backend contract 정합 마찰** — form schema(string)와 wire schema(number)를 한 스키마가 겸하면 타입 지저분. NestJS 커스텀 ZodValidationPipe 작성량이 DoD 미반영. → form/wire 스키마 분리, 공용 zod pipe 1주차 선작성.
- **[중간] multi-org 전환이 토큰·캐시와 얽힘** (`developer_plan.md:788,682-685`) — active org 전환 시 JWT 재발급 + react-query 캐시 org 단위 키잉 필요(테넌트 격리와 직결). → queryKey에 organizationId 1급 포함, org 전환 시 `queryClient.clear()` + 토큰 재발급.

### 6주 프론트 결론
가장 빡빡한 구간은 **3~4주차**. 3주차에 인증 배선·차트 SSR·org 캐시 숨은 작업이 전혀 안 잡혀 현실적으로 1.5~2주. → 1주차 스파이크 2건(토큰 fetch 래퍼, ECharts 래퍼) 전진, 3주차를 인증/대시보드로 분할.

---

## 3. DBA / 데이터 엔지니어링 검토

### 종합
MVP 치고 데이터 거버넌스 의식이 높다. 그러나 DDL 수준에서 운영 위험 다수.

### 스키마 결함
- **[높음] UNIQUE 키에 nullable 컬럼 포함 → 중복 적재 방지 무력화**
  `generation_hourly`(`:364,371`), `rec_market_daily`(`:428,439`), `weather_forecast_hourly`, `solar_irradiance_hourly`, `generation_forecast_hourly` 모두 nullable `region_code`/`market_area`를 UNIQUE 키에 포함. Postgres는 NULL≠NULL이라 **NULL 경로에서 무한 중복 적재**. → UNIQUE 컬럼 `NOT NULL` 강제(미상은 `UNKNOWN` 센티넬) 또는 `NULLS NOT DISTINCT`(PG15+).
- **[높음] NUMERIC precision/scale 전면 미지정** — 모든 측정값·가격·좌표가 무제약 NUMERIC. 단위 오염 방어선 부재, 스토리지 비효율. → `generation_mwh NUMERIC(12,3)`, `smp_krw_per_kwh NUMERIC(10,2)`, `lat/lon NUMERIC(9,6)` 등 + `CHECK (>= 0)`.
- **[중간] fuel_type/market_area/sky_code를 CHECK/lookup 미사용(TEXT 남용)** — 이미 `status`/`organization_type`/`permission`은 CHECK 사용 중이므로 컨벤션 일관성에서도 CHECK 권장.
- **[중간] raw_object content_hash UNIQUE 부재** — 재수집 멱등성 약화. → `UNIQUE (datasource_id, content_hash)` 정책 결정.
- **[중간] supply_realtime UNIQUE가 observed_at 정밀도에 취약** — 5분 슬롯 정규화(`slot_at`) 또는 truncate.
- **[낮음] created_at NOT NULL 누락 다수, updated_at 자동갱신 트리거 부재.**

### 시간·단위 정책 위험
- **[높음] interval_start_at 단독 UNIQUE는 0-23/1-24 변환 오류를 못 막음** → `CHECK (interval_end_at = interval_start_at + interval '1 hour')`, `source_hour CHECK (BETWEEN 0 AND 24)`, 변환 정합성을 `data_quality_check` 항목화.
- **[중간] "timestamptz + KST 병행 저장"이 DDL에 미반영** — 세션 timezone 의존 시 worker/API 간 날짜경계 어긋남. → 전 컴포넌트 세션 `timezone` 명시 고정, KST 컬럼 병행 저장 필요성 재검토.
- **[중간] solar_irradiance_hourly 이중 시각 정합성 제약 부재** → `CHECK (observed_at_kst = observed_at_utc + interval '9 hours')` 또는 생성 컬럼. `_hourly` 명칭은 실제 30분 간격과 불일치.

### 인덱스/파티셔닝/규모
- **[높음] 시계열 보조 인덱스 전무** — UNIQUE 선두가 시각이라 `region+fuel` 등치 필터 못 좁힘. → `generation_hourly(region_code, fuel_type, interval_start_at DESC)` 외 smp/rec/supply/weather/ingestion_run/plant/audit_log 인덱스 추가.
- **[낮음~중간] 파티셔닝/Timescale "병목 시 도입" 결정은 타당** — 발전량 ~30만 row/년, SMP ~1.75만/년, supply ~10.5만/년으로 수년간 단일 테이블 충분. `weather_forecast_hourly`만 빠르게 커질 수 있어 보관 정책 명시 권장.

### auth-도메인 정합성
- **[높음] organization_profile.organization_id가 auth_organization 미참조** (`:501`) — FK 단절 → orphan 가능. Better Auth 1.6.x의 id 실제 타입을 1주차 introspect 후 `REFERENCES auth_organization(id) ON DELETE CASCADE`.
- **[높음] plant_access_grant.user_id, audit_log.actor_user_id가 auth_user FK 없이 TEXT** (`:529,539`) → `REFERENCES auth_user(id)` (audit는 감사 불변성 위해 `ON DELETE SET NULL` 검토).
- **[중간] auth_member.role과 plant_access_grant.permission 권한 이중화** — 판정 우선순위 명문화 필요.

### Neon 풀링 함정
- **drizzle-kit migration은 반드시 `DATABASE_DIRECT_URL`(direct)** — PgBouncer transaction mode pooled로 DDL 실행 시 advisory lock/prepared statement/세션상태 깨짐.
- **런타임 pg Pool이 pooled URL 사용 시 prepared statement 충돌** 주의 — pooled에서 named prepared 회피 또는 `@neondatabase/serverless` 검토.

---

## 4. 제품 기획 / 일정 검토

### 종합: 현재 설계로는 핵심 가설을 검증할 수 없다 (build trap)
상위 계획서는 목적을 "PoC 제안용 데모 확보"라 못박았는데, 개발계획서는 그 데모에 초대 인증·5단계 RBAC·멀티테넌트·감사로그를 Must Have로 올렸다. **목적은 데모인데 산출물은 운영 SaaS 인프라.**

### 치명적
- **[최상] 성공 metric 전면 부재** — 가설 3개(`:38-40`)는 정성 서술, DoD(§15)는 전부 기술 완료 기준. "공공데이터로 PoC를 끌어낼 수 있다"의 참/거짓 판정 기준이 없음. → outcome DoD 신설(인터뷰 ≥8건, PoC/CSV 의사 ≥2곳 등).
- **[최상] 고객 인터뷰가 6주차 끝에 배치(build trap)** — §19는 "대응=개발 전 인터뷰"라 적고도 일정엔 맨 끝(`:953-960`), §16-5는 미결 의사결정. → 인터뷰를 0~1주차 전진(목업 기반 최소 5건).
- **[상] 미결 의사결정 8개 위에 일정 확정** (`:1018-1027`) — 타깃/데모 성격/예측 P1/SMP fallback이 미정인데 주차별 일정은 확정. → 착수 전 클로징 회의.
- **[상] 외부 의존이 크리티컬 패스인데 버퍼 0** — 활용신청 승인은 통제 불가 대기. → D-14 선제출, SMP는 사용자 입력 fallback을 1순위로 깔고 시작.

### 주요
- **[상] Must Have 6종 과적재** — 로그인/권한이 §10.3~10.5, §9.8, §18로 폭발. 공공데이터엔 격리할 고객 데이터가 없음. → 인증을 단일 게이트로 축소, RBAC/조직/감사는 §17 고객 PoC로 이연(최소 1주 회수).
- **[상] 타깃 지불의사 가설이 가장 약한데 검증 우선순위에서 밀림** — O&M의 본질 니즈는 "내 발전소" 실측인데 MVP는 지역 집계값. 핵심 고통과 MVP 제공물이 어긋남. → "지역 평균 vs 내 발전소(사용자 입력)" 비교를 hero 기능으로.
- **[중간] SMP 게이트의 자기모순** — fallback이 있으면 게이트가 아님. → §16-6을 "Yes"로 클로징, 사용자 입력 가격으로 시뮬레이터 오픈을 기본 경로로.
- **[상] 인력 규모 미명시** — 6주 현실성 판단의 분모가 없음.
- **[중간] 예측 데모(P1) 비용 대비 가치 의문** — 5주차에 기상연동+일사량+격자매핑+모델을 한 주에, 가치는 P1인데 작업량은 P0급. → 인터뷰로 니즈 확인 후 착수.

### 6주 현실성 (인력 가정별, 현 범위)
- **1인 풀스택**: 불가능(10~12주).
- **2인**: 기능은 욱여넣어도 검증 시간 안 남(build trap).
- **3인+**: 기능 완성 가능하나 metric·버퍼 부재는 그대로.
- **범위 축소 시(인증 축소 + 예측 조건부 + 인터뷰 전진)**: 2인이면 6주 합리적, 1인도 핵심은 가능.

---

## 5. 보안 / 인증 검토

### 종합
보안 인식은 평균 이상이나 **"무엇을 할지"는 있어도 "어떻게 강제할지(enforcement)"가 비어 있다.** 격리가 관례(convention)에 의존.

### Critical / High
- **[Critical] 테넌트 격리를 app-level filter에만 의존, RLS 무기한 연기** (`:1066-1068`) — Drizzle은 `WHERE org_id`를 자동으로 안 붙임. 쿼리 1개 누락 시 cross-tenant 노출(OWASP A01). → MVP부터 RLS(Neon 지원) 또는 강제 scoped repository(raw 쿼리 lint 금지).
- **[Critical] JWT 취소(revocation) 부재** (`:1059`) — 멤버 제거/role 강등/탈취해도 토큰 만료까지 권한 유효. → TTL 5~10분 + refresh 세션, 권한 사실은 claim에 안 넣고 매 요청 DB 조회(또는 짧은 TTL+무효화).
- **[High] JWT 검증 방식·키 전략 미정의** (`:222,1079`) — JWKS인지 대칭키인지, alg 강제 여부 없음. → 비대칭+JWKS, `algorithms`/iss/aud/exp 명시 강제, kid 기반 무중단 회전.
- **[High] 권한 강제가 Guard 의존 → 누락 시 fail-open** — `@UseGuards` 빠뜨리면 통째 누락. resource ownership(판정 3단계)은 guard로 불가. → global default-deny guard(`APP_GUARD`) + `@Public()` opt-out, ownership은 service/repository 검증.
- **[High] 초대 토큰 보안 속성 미정의** (`:694-695`) — 엔트로피/일회성/해싱/이메일 바인딩 없음. 초대 수락 계정 이메일 불일치 시 타조직 침투. → CSPRNG 128bit+, 해시 저장, single-use, 이메일 일치 검증, 재발송 시 rotate.
- **[High] platform_admin 과대권한 + 감사 우회** (`:673,1086`) — 자기 행위 로그 조회/삭제 가능 시 감사 우회. → break-glass 접근 로깅, audit_log append-only, MFA.
- **[High] rate limiting / brute force / 계정 열거 통제 부재** — 로그인/초대/재설정에 rate limit 없음, enumeration으로 고객사 이메일 노출. → IP/계정 rate limit, enumeration-safe 응답.

### Medium / Low
- [M] sameSite=lax + Better Auth POST의 CSRF — 보호 활성 확인, CORS allowlist 좁게.
- [M] AuthContext 매 요청 DB 조회 vs 캐싱 trade-off 미해결.
- [M] 파일 업로드 보안(CSV injection, MIME, presigned scope) 미비(§17).
- [M] 감사 누락(로그인 실패/403 거부/export/admin 접근), actor sentinel, XFF 신뢰 정책.
- [M] 비밀값 env 단독 관리 + 회전 절차 공백.
- [L] PII(이메일/사업자번호/발전소 좌표) 처리 정책 약함.
- [L] CORS/CSP/HSTS 보안 헤더 미언급.
- [L] plant_access_grant가 org role 상향 가능 시 권한상승 → deny-override 정책.

### 가장 시급한 3건 (되돌리기 어려운 구조적 결정)
**C-1(RLS/scoped repo), C-2(토큰 취소), C-5(초대 토큰 위조/계정 바인딩)** — 코드 착수 전 설계에서 결정.

---

## 6. 공공데이터 / 에너지 도메인 검토

### 종합: 데이터 수급 계획은 대체로 실현 가능
도메인 이해도 높음. §20 데이터셋 ID·URL 전부 실재·일치 확인. 단 두 가지 구멍: 트래픽 정량 미검증, REC/수익모델 도메인 부정확.

### 도메인 사실관계 오류/의심 (가장 중요)
- **[H-1] REC 발급식 부정확** (`:858`) — `발전량 MWh × 가중치`에서 (a) 공공데이터 발전량(전력시장 거래량)과 REC 발급 대상(RPS 인증 발전량)은 모집단이 다름, (b) REC는 분기/반기 발급·정산이지 시간별 아님. → `발급 REC = 인증 발전량(MWh) × 1(REC/MWh) × 가중치`로 명확화, "공공데이터 발전량은 인증값 아님" 면책.
- **[H-2] 수익 모델이 현물 SMP+REC 노출 가정인데 한국 태양광 대다수는 고정가격계약(SMP+REC 20년 고정)** (`:857-882`) — §13.3은 "계약가 따라 달라진다"고만 함. 이건 세부주의가 아니라 근본 전제. O&M 미팅 첫 질문에 신뢰도 붕괴. → 시뮬레이터에 정산유형 선택(고정가격계약/현물/자가소비) 추가, 최소 "현물 가정" 1순위 면책.
- **[M-3] SMP 단위 "원/kWh" 가정** — API 응답 필드는 "원"으로만 표기. 통상 원/kWh 맞으나 1주차 실응답으로 자릿수(100~200대) 확정, 범위 품질검사.
- **[M-4] REC 종가/거래금액은 육지·제주 통합값** (`:426-440`) — 평균가/거래건수는 area별, 종가는 전국 통합. `(trade_date, market_area)` UNIQUE에 close_price 넣으면 구조적 모순. → area 지표와 시장 전체 지표 분리 또는 `market_area='TOTAL'` 행에만 종가.
- **[L-5] 거래시간 0–23/1–24 혼재** — 계획서가 adapter 변환으로 둔 건 정확. 1주차 샘플로 교차검증(태양광 첫 비영 시간이 일출과 맞는지).

### 데이터 수급 현실성 (트래픽 정정)
- **[H-6] 트래픽 한도 정정** — 계획서 "100건(단위 미상)"의 실제:
  - 현재전력수급(15056640): **100건/시간** → 5분 수집(12회/시간) 가능
  - 태양광 발전량(15103243): **100건/시간** → 시도 17개 루프 시 소진, 증분/캐시 필수
  - SMP(15076302)/REC(15099762): **100건/일** → 일별 데이터라 문제없음
  - 단기예보(15084084): **10000건/일** → 넉넉
  → §5.4에 건/시간 vs 건/일 명시, 수집 스케줄 한도 역산. 운영계정 전환("활용사례 등록") 일정 결정.
- **[M-7] 일사량 30분 간격·UTC 맞음. 위성 격자라 시도 region_code로 바로 안 떨어짐.** 테이블명 `_hourly` 부적절. 단위(W/m² 등)·좌표체계 1주차 확정.
- **[M-8] 기상청 단기예보에 일사량 항목 없음** — 계획서가 일사량을 위성에서 별도 수집한 건 정확. 단기예보 3시간 간격 항목 보간 필요.
- **[L-9] SMP fallback EPSIS 파일** — 매일 갱신·육지/제주 분리·원/kWh로 오히려 명확. 단 페이지 파싱은 구조 변경 취약(adapter 분리로 대응).

### 수익계산·예측 도메인 타당성
- regional_profile_scaled 위험 인지 적절. 단 지역 누적 설비용량은 에너지공단 보급통계/EPSIS에 공개됨 → "데이터 없음" 단정 말고 1주차 확인.
- 예측 타깃이 "지역 집계"라 O&M의 "내 발전소" 니즈와 괴리. P1 강등은 합리적. ESS 야간 방전 노이즈를 baseline이 학습할 위험.

### 라이선스/상업화
- **[M-12] 대부분 제1유형(출처표시, 상업·변형 허용)이라 SaaS 자체는 가능.** 단 (a) 화면/리포트 출처표시 의무가 DoD에 없음, (b) 제2/4유형 섞이면 불가 → 데이터셋별 유형 1주차 개별 확인, (c) EPSIS 스크래핑은 라이선스 근거 별도.

### 1주차 도메인 체크리스트
1. SMP 대체 API 활용신청 + 응답 단위(원/kWh 자릿수) + 육지/제주(areaCd) 확정
2. 트래픽 한도 건/시간 vs 건/일 명문화 + 수집 스케줄 역산 + 운영계정 조건
3. REC 발급식·정산주기 재정의 + 종가 통합값 스키마 반영
4. 수익 시뮬레이터 정산유형 디폴트 결정
5. 발전량 시간베이스(0–23/1–24) 교차검증
6. 일사량 단위·좌표체계·30분 해상도 확정
7. 데이터셋별 이용허락 유형 확인 + 출처표시 DoD 추가
8. 지역 누적 설비용량 출처(에너지공단 보급통계) 확인

---

## 7. 우선순위 종합 (착수 전 → 코드 단계)

### 착수 전 (의사결정·기획)
1. §16 의사결정 8개 클로징 — 특히 **인력 규모, 타깃, 인증 범위**
2. 범위 축소: 인증→단일 게이트, RBAC/감사/조직관리→고객 PoC 이연, 예측은 인터뷰 후
3. 인터뷰·metric 0~1주차 전진, 활용신청 D-14 선제출

### 1주차 게이트 (확정 전 "완료" 불가)
- 도메인 체크리스트 8항목(§6)
- 인증 walking skeleton (BFF 토큰 전달)
- Better Auth id 타입 introspect → FK 설계 확정
- 데이터소스별 트래픽 한도 단위 + 수집 스케줄

### 코드 착수 전 DB 필수 (되돌리기 비쌈)
- nullable UNIQUE 제거, auth FK 연결, 시계열 보조 인덱스
- migration=direct/runtime=pooled 정책 코드 강제
- NUMERIC precision + CHECK 제약

### 보안 구조적 결정 (되돌리기 비쌈)
- RLS or 강제 scoped repository
- JWT 취소 전략(짧은 TTL + DB 권한 조회)
- 초대 토큰 보안(해시/single-use/이메일 바인딩)
- global default-deny guard
