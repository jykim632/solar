# Solar Market Intelligence MVP 개발계획서

- 문서 버전: v0.5
- 작성일: 2026-06-29
- 수정일: 2026-07-02
- 상태: 내부 검토용 초안 (전문 영역 검토 반영, `review_report.md` 참조)
- 데이터 출처 확인 기준: 2026-06-29 공공데이터포털 메타데이터

## 1. 핵심 결론

이 프로젝트는 VPP 통합제어 플랫폼이 아니다. 초기 목표는 공공데이터로 가능한 전력수급, 지역별 재생에너지 발전량, SMP/REC 가격, 수익 시뮬레이션, 제한적 발전량 예측을 묶어 **태양광 발전사업자/O&M 업체용 수익·예측·리포팅 SaaS 가능성**을 검증하는 것이다.

1차 MVP는 "시장·발전량 데이터 통합 대시보드"와 "가상 수익 시뮬레이터"를 중심으로 만든다. 예측과 월간 리포트는 제품 핵심이라기보다 고객 인터뷰에서 반응을 확인하기 위한 데모 기능으로 둔다.

### 1.1 이번 계획에서 바꾼 점

- 6주 안에 모든 기능을 완성하는 계획에서, **데이터 접근성 검증 → 안정 수집 → 핵심 화면 → 데모 기능** 순서로 범위를 줄였다.
- 연간 파일 데이터와 실시간 OpenAPI를 분리했다. 연간 파일은 히스토리 분석용, 실시간 API는 운영 화면용으로 쓴다.
- SMP 데이터는 기존 `계통한계가격조회` API가 삭제 예정으로 안내되어 있어 대체 API/파일 경로 검증을 1주차 필수 게이트로 올렸다.
- DB 설계에 수집 실행 이력, 원본 응답 저장, 데이터 품질 검사 테이블을 추가했다.
- 시간대, 거래시간, 단위 변환을 별도 정책으로 명시했다.
- 수익 계산을 실제 정산이 아니라 **가정 기반 시뮬레이션**으로 분명히 표시하도록 했다.
- 운영 DB는 Neon Postgres, DB access는 Drizzle, 인증은 Better Auth 기반으로 정리했다.
- 초대 기반 로그인, 조직 단위 RBAC, NestJS JWT guard, 감사 로그를 MVP 필수 범위에 추가했다.

### 1.2 v0.4에서 반영한 검토 결과 (전문 영역 검토)

`review_report.md`의 6개 영역(백엔드·프론트·DBA·기획·보안·도메인) 검토를 반영했다. 핵심:

- **범위 재조정(기획)**: 멀티테넌트 인증·RBAC·감사로그 풀세트를 Must Have에서 빼고 **단일 로그인 게이트**로 축소(공공데이터 단계엔 격리할 고객 데이터 없음). 초대/RBAC/감사는 고객 PoC(§17) 단계로 이연.
- **검증 설계(기획)**: 성공 metric(§15.0) 신설, 고객 인터뷰를 6주차 끝 → 0~1주차로 전진, 인력 가정(§14.0) 명시, 의사결정 8개 클로징(§16).
- **도메인 정정**: REC 발급식(1MWh=1REC×가중치, 분기 정산), 수익모델 정산유형 선택(현물/고정가격계약, §13.0), 트래픽 한도 단위(건/시간 vs 건/일), REC 종가 통합값.
- **DB(DBA)**: nullable UNIQUE 제거(NOT NULL/센티넬), auth 테이블 FK 연결, NUMERIC precision + CHECK, 시계열 보조 인덱스, interval/시간 정합성 CHECK, Neon migration=direct 강제.
- **백엔드**: BFF 패턴 명시(§10.3), API `/v1` 버저닝 + cursor 페이지네이션 + 에러 envelope, contracts 분리(api-contracts/ingestion-schemas), BullMQ 처음부터 + 멱등 upsert(BullMQ는 v0.5에서 EventBridge Scheduler로 대체, §1.3), worker는 NestJS standalone.
- **프론트**: 스택 버전표 npm 실재 확인, ECharts SSR 래퍼(`ssr:false`)·multi-org 캐시·form/wire 스키마 분리·1주차 스파이크.
- **보안**: RLS(또는 scoped repo) default-deny, JWT 비대칭+JWKS·짧은 TTL·권한 매요청 DB 조회(취소 대응), 초대 토큰 해시/single-use/이메일 바인딩, rate limit·enumeration-safe, audit append-only.

### 1.3 v0.5에서 바꾼 점 (인프라 확정)

인프라를 **AWS serverless**로 확정했다. 로컬 Docker/Redis를 두지 않기로 한 결정(개발 DB도 Neon 직결)에 따라 BullMQ + Redis 전제가 무효화되었고, 그 대체로 다음을 채택한다.

- 컴퓨트: **Lambda** (NestJS API는 serverless-express 또는 Lambda Web Adapter, worker는 NestJS standalone 핸들러). 유휴 시 비용 ~$0, 콜드스타트 1~3초는 초대 기반 데모 단계에서 허용.
- 수집 스케줄링: **EventBridge Scheduler**가 cron·재시도·실패추적(DLQ=SQS)을 관리형으로 담당. BullMQ가 맡던 역할을 대체하며, at-least-once + 멱등 upsert 규약(§8.2)은 그대로 유지된다.
- Raw store: 처음부터 **S3** (기존 "로컬 디렉터리 → 이후 S3-compatible"을 앞당김).
- DB: Neon Postgres 유지 (§7·§9 전제 변경 없음). 단 **데모 기간 수급현황 수집 주기는 15분**으로 두어 Neon Free를 유지한다(~$0/월). 고객 인터뷰에서 실시간성 니즈 확인 시 5분 + Neon Launch(~$20/월)로 전환 — EventBridge schedule 표현식 변경뿐이라 전환 비용 없음. 비용 근거·duty cycle 계산은 `docs/infra-aws-cost-simulation.md` §2.3.
- Secrets: SSM Parameter Store.
- 프론트 호스팅: **OpenNext on AWS**(SST v3 `Nextjs` 컴포넌트 — CloudFront + Lambda + S3) 1순위. `@opennextjs/aws`는 next **16.2.6 이상** 필요(§7.3의 16.2.x 핀과 정합, 패치 버전 주의). fallback 순서: Amplify Hosting → Cloudflare Workers(OpenNext) → Vercel Pro(Hobby는 상업적 사용 금지라 제외).
- API Lambda 앞단에도 **CloudFront + OAC**를 둔다 — 커스텀 도메인(ACM 무료), Function URL 직접 노출 차단, 조회 응답 엣지 캐싱. CloudFront always-free(월 1TB·10M 요청)로 데모~PoC 추가 비용 $0. OAC 뒤 POST는 `x-amz-content-sha256` 헤더 필요(BFF fetch 래퍼에서 처리, 1주차 walking skeleton에서 확인).
- 배포/IaC 도구는 **SST v3 유력**(프론트 배포가 따라옴), 최종 확정은 3주차 배포 이슈에서. 1~2주차는 로컬 개발만으로 진행 가능.

## 2. 프로젝트 정의

### 2.1 프로젝트명

**Solar Market Intelligence MVP**

### 2.2 한 줄 설명

공공데이터 기반으로 전력수급, 지역별 태양광·풍력 발전량, SMP/REC 가격, 기상·일사량 기반 예측, 가상 설비 수익 시뮬레이션을 제공하는 내부/고객 미팅용 대시보드 MVP.

### 2.3 검증할 가설

1. 태양광 O&M 업체와 발전사업자는 발전량, 가격, 수익, 리포트를 한 화면에서 보고 싶어 한다.
2. 공공데이터만으로도 고객 미팅에서 문제 인식과 PoC 제안을 이끌어낼 수 있다.
3. 실제 고객 발전량 CSV가 붙으면 수익·정산·성능 비교 리포팅 SaaS로 확장할 수 있다.

### 2.4 1차 타깃

1차 타깃은 **태양광 O&M 업체**로 둔다.

이유:

- 여러 발전소를 관리할 가능성이 높다.
- 월간 리포팅과 성능 점검 업무가 반복된다.
- 개별 발전사업자보다 데이터 연동 PoC의 가치가 크다.
- 향후 발전량 CSV, 정산내역, 인버터 데이터로 확장하기 쉽다.

## 3. MVP 범위

### 3.1 Must Have

이 MVP의 목적은 "운영 SaaS"가 아니라 **가설 검증용 데모**다(§2.3, 상위 사업계획). 따라서 공공데이터 데모 단계에는 격리할 고객 데이터가 없으므로 풀 멀티테넌트 인증을 Must Have에서 빼고, **단일 로그인 게이트**로 시작한다. 초대 기반 5단계 RBAC·조직관리·감사로그는 고객 데이터 PoC(§17) 진입 시점의 범위다(§10.4, §14 일정).

| 범위 | 내용 | 완료 기준 |
|---|---|---|
| 데이터 수집 | 전력수급, 지역별 태양광 발전량, SMP, REC, 기상 또는 일사량 중 최소 5종 | 배치 실행, 원본 저장, 정제 테이블 적재 |
| 전력수급 상황판 | 현재수요, 공급능력, 예비력, 예비율, 최근 추이 | 최신 기준시각 표시 |
| 발전량/가격 대시보드 | 지역별 태양광 발전량, SMP/REC 추이 | 기간·지역 필터 동작 |
| 수익 시뮬레이터 | 정산유형 선택 + 설비용량, REC 가중치, 수수료율 입력 기반 예상 수익 | 정산유형(현물/고정가격계약)·계산 가정·면책 문구 표시 |
| 데이터 품질 표시 | 수집 성공/실패, 최신 데이터 기준일, 누락 여부 | 화면 또는 운영 로그에서 확인 |
| 로그인 게이트 | **단일 로그인 + 단일 조직 seed**(비공개 데모 접근 차단). 멀티테넌트 RBAC/초대/감사는 PoC 단계로 이연 | 비로그인 접근 차단, seed 계정 로그인 |
| 고객 인터뷰 | 타깃 O&M 업체 대상 검증 인터뷰(목업/데모 기반) | §15.0 성공 metric 달성 |

### 3.2 Should Have

| 범위 | 내용 | 완료 기준 |
|---|---|---|
| 발전량 예측 데모 | 1개 이상 지역의 다음날 태양광 발전량 baseline 예측 | 실제값 대비 MAE/MAPE 표시 |
| 샘플 월간 리포트 | Markdown 또는 PDF 샘플 리포트 | 발전량, 가격, 수익 요약 포함 |
| 지역 평균 비교 | 선택 지역과 전국/상위 지역 비교 | 그래프와 요약 수치 표시 |
| API 실패 알림 | 배치 실패 로그 또는 알림 | 재시도/실패 원인 기록 |

### 3.3 Could Have

- CSV 업로드 기반 발전소별 발전량 분석
- 산업분류별 전력사용량 기반 영업 타깃 분석
- 전기차 충전소 위치 분석
- PDF 다운로드 고도화
- 발전량 이상탐지

### 3.4 MVP에서 제외

- 실제 VPP 입찰/거래
- 전력거래소 연계 실거래
- 발전소 인버터 실시간 제어
- ESS 자동 충방전 제어
- 전기차 충전기 출력 제어
- 법적·회계적 정산 확정 또는 대행
- 고객별 실제 정산 자동화

## 4. 1차 화면 구성

| 화면 | 목적 | 핵심 지표 | 우선순위 |
|---|---|---|---:|
| 전력수급 상황판 | 현재 계통 상황 확인 | 현재수요, 공급능력, 예비력, 예비율 | P0 |
| 발전량·가격 대시보드 | 지역별 태양광 발전량과 가격 추이 확인 | 발전량, SMP, REC 평균가/종가 | P0 |
| 수익 시뮬레이터 | 가상 설비 기준 예상 수익 계산 | SMP 수익, REC 수익, 수수료, 총 예상수익 | P0 |
| 로그인/조직 관리 | 비공개 데모 접근과 고객사별 권한 분리 | 로그인 상태, 현재 조직, 역할, 초대 | P0 |
| 예측 데모 | 공공데이터 기반 예측 가능성 확인 | 예측 발전량, 실제 발전량, 오차율 | P1 |
| 월간 리포트 | 고객 미팅용 샘플 자료 생성 | 월간 요약, 그래프, 수익 계산 | P1 |

## 5. 데이터 소스 전략

### 5.1 데이터 사용 원칙

1. 원본 응답은 저장한다.
2. API 응답, 정제 테이블, 화면 조회용 mart를 분리한다.
3. 모든 시각은 내부 저장 시 `timestamptz`와 KST 기준 표시값을 함께 관리한다.
4. 원천 데이터의 거래시간 정의를 `interval_start_at`, `interval_end_at`으로 변환한다.
5. 지역명은 `region_code`로 표준화한다.
6. 단위는 `MW`, `MWh`, `kWh`, `원/kWh`, `원/REC`를 명시한다.
7. 수집 모듈은 datasource별 adapter로 분리한다.
8. 개발계정 트래픽 제한을 고려해 캐시와 증분 수집을 기본으로 한다.

### 5.2 1순위 데이터

개발계정 트래픽 한도는 데이터소스별로 **건/시간** 또는 **건/일** 단위가 다르다(아래 "한도 단위" 컬럼). 막연히 "100건"으로 보지 말고 단위를 기준으로 수집 스케줄을 역산한다. 1주차에 실제 활용신청 화면에서 단위를 재확인한다.

| 데이터 | 제공기관 | 용도 | 갱신/특징 | 한도 단위(개발계정, 확인필요) | MVP 판단 |
|---|---|---|---|---|---|
| 현재전력수급현황조회 | 한국전력거래소 | 전력수급 상황판 | 실시간, 5분 단위 조회 | 약 100건/시간 → 5분 수집(12회/시간) 가능 | P0 운영 데이터 |
| 지역별 시간별 태양광 발전량 정보 | 한국전력거래소 | 태양광 발전량 화면, 예측 label | 실시간, 광역시도·시간별, MWh | 약 100건/시간 → 시도 17개 루프 시 소진, 증분/캐시 필수 | P0 운영 데이터 |
| REC 현물시장 정보 | 한국전력거래소 | REC 가격 조회, 수익 계산 | 일별 거래(현물시장) | 약 100건/일 → 일 1~2콜로 충분 | P0 운영 데이터 |
| SMP 대체 소스 | 한국전력거래소 | SMP 가격 조회, 수익 계산 | 기존 `계통한계가격조회` API 삭제 예정 안내. 권장 대체 API 또는 일별 파일 데이터 검증 필요 | 약 100건/일(대체 API 기준, 확인필요) | P0 검증 게이트 |
| 기상청 단기예보 조회서비스 | 기상청 | 예측 feature | 5km 격자 기반 예보. **일사량 항목은 포함하지 않음**(기온/습도/강수/풍속/하늘) | 약 10000건/일 → 넉넉 | P1 예측 데이터 |
| 천리안위성 2A호 AI 기반 일사량 | 기상청 | 일사량 feature | 2023-06-26 06UTC 이후 30분 간격 생산. 위성 격자 산출물(시도 region_code로 바로 매핑 불가). 단위/공간해상도 1주차 확정 | 확인필요 | P1 예측 데이터 |

### 5.3 히스토리/보조 데이터

| 데이터 | 제공기관 | 용도 | 주의점 |
|---|---|---|---|
| 지역별 시간별 태양광 및 풍력 발전량 CSV | 한국전력거래소 | 과거 발전량 분석, baseline 학습 | 연간 갱신. 전력시장 참여 발전기 기준이며 자가용/한전 직접거래 발전기는 제외. ESS 충방전량이 포함될 수 있음 |
| 시간별 전국 전력수요량 CSV | 한국전력거래소 | 수요 패턴 분석, 배경 지표 | 연간 파일 기반으로 운영 화면의 최신성 보장에는 부적합 |
| 산업분류별 전력사용량 | 한국전력공사 | 영업 타깃 분석 | 2차 기능 |
| 전기차 충전소 정보 | 한국환경공단/공공데이터포털 | 충전 인프라 지도 | 2차 기능 |

### 5.4 데이터별 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---:|---|
| 실시간 API 개발계정 트래픽 제한(시간당/일별 상이) | 높음 | 데이터소스별 한도 **단위(건/시간 vs 건/일)** 확정 후 수집 스케줄 역산. 수급/태양광은 시간당 한도라 증분/캐시 필수, 운영계정("활용사례 등록") 전환 조건·소요기간 확인 |
| SMP 기존 API 삭제 예정 | 높음 | 대체 소스 확보(§5.5). **단 fallback(사용자 입력 가격)이 있으므로 SMP API 확정을 1주차 통과 게이트가 아니라 운영 품질 목표로 둔다** — 시뮬레이터는 사용자 입력 가격으로 먼저 오픈 |
| 연간 파일 데이터의 최신성 부족 | 중간 | 히스토리 분석과 학습용으로만 사용 |
| 발전량 집계 범위의 한계 | 높음 | "전력시장 참여 발전기 기준" 표시, 실제 발전소 정산값으로 사용 금지. REC 발급 대상(RPS 인증 발전량)과 모집단이 다름을 명시 |
| 수익모델-정산현실 괴리 | 높음 | 한국 태양광 다수는 고정가격계약(SMP+REC 20년 고정). 현물 SMP+REC 노출은 일부 → 시뮬레이터에 정산유형 선택 제공, "현물 가정" 1순위 면책(§13.3) |
| ESS 충방전량 혼입 | 중간 | 심야 태양광 발전량 이상치를 품질검사 대상으로 표시. baseline 예측 시 야간 ESS 방전 노이즈 학습 주의 |
| 기상청 격자와 KPX 지역 불일치 | 중간 | 시도 대표 격자 매핑으로 시작, 좌표 기반 확장은 2차 |
| 일사량 데이터 UTC 기준 + 위성 격자 | 중간 | UTC 원본시각과 KST 변환시각을 함께 저장. 위성 격자→시도 매핑은 단기예보(nx,ny)와 또 다른 체계임을 인지 |
| 데이터 이용허락 유형 혼재 | 중간 | 데이터셋별 유형(1~4) 1주차 개별 확인. 제2/4유형이면 SaaS 상업 제공 불가. 화면/리포트 출처표시 의무 이행 |

### 5.5 SMP 소스 확정 체크리스트

기존 `한국전력거래소_계통한계가격조회` OpenAPI는 공공데이터포털 설명에서 추후 삭제 예정으로 안내되어 있다. 따라서 1주차에 아래 순서로 확정한다.

| 우선순위 | 후보 | 확인할 것 | 판단 |
|---:|---|---|---|
| 1 | 한국전력거래소_계통한계가격 및 수요예측(하루전 발전계획용) API | 활용신청 가능 여부, 육지/제주 구분, 시간 필드, 단위, 트래픽 제한 | 운영용 1순위 후보 |
| 2 | 한국전력거래소_시간별 계통한계가격 파일 데이터 | 매일 갱신 여부, CSV 다운로드 자동화 가능 여부, 컬럼명 안정성 | API가 늦어질 때 fallback |
| 3 | 사용자 입력 SMP 또는 고정 샘플 가격 | 시뮬레이터만 먼저 열 수 있는지 | 데모 fallback |

SMP 소스가 1주차에 확정되지 않으면 `발전량/가격 대시보드`에서는 SMP 영역을 "소스 검증 중" 상태로 표시하고, `수익 시뮬레이터`는 사용자 입력 가격 기반으로 먼저 구현한다.

## 6. 시간·단위 정책

### 6.1 시간 정책

내부 표준은 다음과 같다.

```text
source_date        : 원천 데이터의 날짜 필드
source_hour        : 원천 데이터의 거래시간 필드
interval_start_at  : KST 기준 구간 시작 시각
interval_end_at    : KST 기준 구간 종료 시각
observed_at        : 관측/발표 기준 시각
created_at         : 시스템 저장 시각
```

SMP 계통한계가격의 거래시간 0시는 00:00 직후부터 01:00까지의 구간으로 안내되어 있다. 다른 KPX 데이터도 0-23인지 1-24인지 source별로 확인하고 adapter에서 명시적으로 변환한다.

시간 오염 방지 규약:
- `interval_start_at` 단독 UNIQUE는 0-23/1-24 변환 오류를 잡지 못한다(잘못 변환돼도 서로 다른 값이면 둘 다 적재됨). 따라서 시간단위 테이블에 `CHECK (interval_end_at = interval_start_at + interval '1 hour')`와 `source_hour CHECK (BETWEEN 0 AND 24)`를 두고(§9), interval↔source_hour 변환 정합성을 `data_quality_check` 항목으로 검사한다.
- 1주차에 SMP·발전량 각각의 시간 베이스(0-23/1-24)를 실제 응답 샘플로 **교차검증**한다. 태양광 발전량은 첫 비영(非零) 시간이 일출과 맞는지로 검증 가능하다.
- DB 세션 `timezone`을 API 서버·worker·migration **모든 컴포넌트에서 동일하게 고정**한다(UTC 권장, 표시값만 KST 변환). 세션 timezone에 의존하면 worker와 API의 설정이 다를 때 날짜 경계(자정·월말)가 어긋난다. `source_date`는 "KST 기준 날짜"임을 명시하고 `interval_start_at AT TIME ZONE 'Asia/Seoul'`의 날짜와 일치하는지 품질검사한다.
- `timestamptz`는 내부적으로 UTC 저장 + 세션 TZ 표시이므로, "KST 표시값 별도 컬럼 병행 저장"은 대부분 불필요한 비정규화 중복(오염원)이다. 일사량처럼 원천이 UTC라 헷갈리기 쉬운 경우에만 `observed_at_utc`/`observed_at_kst`를 두고 `CHECK`로 9시간 차이를 강제한다(§9.4).

### 6.2 단위 정책

| 항목 | 내부 단위 | 비고 |
|---|---|---|
| 발전량 | MWh | 수익 계산 시 kWh로 변환 |
| 설비용량 | kW | 사용자 입력 |
| 전력수요/공급능력 | MW | 전력수급 화면 |
| SMP | 원/kWh | API 응답 단위 확인 필수 |
| REC 가격 | 원/REC | 평균가/종가 선택 가능하게 설계 |
| 일사량 | 원천 단위 보존 + 표준 단위 컬럼 | API 명세 확인 후 확정 |

## 7. 권장 기술 스택

### 7.1 기본안

| 영역 | 권장 기술 | 이유 |
|---|---|---|
| Runtime | Node.js 24.18.0 LTS (Krypton) | Next.js, NestJS, Drizzle ORM, Better Auth, shadcn CLI 호환 범위를 안정적으로 만족 |
| Frontend | Next.js, React, TypeScript | 대시보드와 API 연동 생산성 |
| UI | shadcn/ui, Tailwind CSS, lucide-react | 컴포넌트 코드를 소유하면서 제품 톤을 직접 설계 |
| Form/Table | React Hook Form + Zod, TanStack Table | 입력 검증은 Zod와 공유하고, 데이터 테이블은 headless하게 구성 |
| Chart | ECharts | 시계열, 가격 추이, 지역 비교 구현 |
| Backend API | NestJS, TypeScript | 구조화된 모듈, DI, 테스트, 운영 안정성 |
| Contract/Validation | Zod | 요청/응답 DTO, 환경변수, 외부 API 응답 검증을 TypeScript 타입과 함께 관리 |
| Auth | Better Auth, Drizzle adapter, jose | TypeScript 기반 self-hosted 인증, 조직/역할 확장, NestJS JWT 검증 |
| DB Access | Drizzle ORM, drizzle-kit, pg | SQL 제어감, 타입 안정성, 명시적 migration 흐름 확보 |
| Data Pipeline | NestJS standalone application(worker) | DI/config/DB풀/adapter/contracts를 api와 재사용. 별도 TS worker는 코드 중복을 유발하므로 NestJS standalone으로 확정 |
| Queue/Scheduler | EventBridge Scheduler (+ SQS DLQ) | 수집 cron·재시도·실패 추적을 관리형으로. Redis/BullMQ 미사용(§1.3) |
| DB | Neon Postgres | 운영/스테이징은 Neon branch, 개발도 Neon 직결(로컬 PostgreSQL 없음) |
| ML | 초기 TypeScript baseline, 이후 Python/scikit-learn sidecar | 1차 예측은 단순화하고 ML 필요성이 확인되면 분리 |
| Storage | S3 | 원본 CSV/JSON 저장 (`raw_object.object_path` = S3 key) |
| Infra | AWS serverless (Lambda + EventBridge Scheduler + S3 + SSM) | 유휴 시 비용 ~$0. IaC(SST v3 vs CDK)는 3주차 결정. 프론트는 Amplify Hosting(불가 시 Vercel) |

### 7.2 스택 결정 기준

- 기본 스택은 `Next.js + shadcn/ui + NestJS + Neon Postgres + Drizzle ORM + Better Auth + Zod`로 둔다.
- UI는 Ant Design 대신 shadcn/ui를 사용한다. shadcn/ui는 완제품 라이브러리를 가져오는 방식이 아니라 컴포넌트 소스 코드를 프로젝트에 추가하는 방식이므로, 디자인 시스템을 직접 통제할 수 있다.
- shadcn/ui 기반 화면은 Tailwind CSS utility, CSS variable 기반 theme token, lucide icon, Radix/Base UI 계열 primitive를 조합해 만든다.
- 데이터 테이블은 shadcn Data Table 패턴처럼 TanStack Table을 사용하고, 정렬/필터/페이지네이션 상태를 명시적으로 관리한다. shadcn Data Table은 컴포넌트가 아니라 TanStack Table 배선 레시피이며 서버 페이지네이션은 별도 작업이므로, **MVP는 차트 중심으로 가고 테이블은 "최신 N건" 클라 페이지네이션으로 최소화**한다(본격 서버 테이블은 P1 이후).
- 차트는 ECharts를 쓰되 Next 16 App Router 기본이 RSC이고 ECharts는 `window`/canvas에 의존해 **서버 렌더 불가**다. 반드시 `"use client"` + `next/dynamic({ ssr:false })` + 고정/min-height를 한곳에서 처리하는 `<ChartContainer>` 단일 래퍼로 감싼다(컨테이너 height 없으면 0px 렌더 버그). P0/P1 화면 6종 중 5종이 그래프이므로 이 래퍼를 1주차 스파이크로 먼저 만든다.
- 폼은 React Hook Form과 Zod resolver를 사용한다. **form schema(입력 중 string)와 wire schema(API body number)를 분리**하고 변환 함수를 한곳에 둔다(한 스키마가 둘을 겸하면 타입이 지저분해지고 string↔number 400 불일치가 난다).
- 데이터 fetch는 BFF(§10.3)를 통해 Next 서버사이드에서 토큰을 주입하므로 브라우저 fetch 래퍼에 토큰 로직이 없다. 단 조직 전환(multi-org) 시 **react-query queryKey에 `organizationId`를 1급으로 포함**하고, 전환 시 `queryClient.clear()` + (필요시) 토큰 재발급을 묶어 테넌트 간 캐시 누출을 막는다(§18.2와 직결, 테스트 필수).
- `zod`는 v4 계열을 사용한다. 다만 일부 NestJS 보조 패키지는 Zod v3 peer dependency에 묶여 있으므로, 핵심 검증은 보조 패키지보다 직접 Zod schema와 pipe/helper로 구현한다.
- Drizzle ORM은 `drizzle-orm/node-postgres`와 `pg` pool 기반으로 시작한다. 복잡한 시계열/집계 쿼리는 Drizzle query builder와 raw SQL을 함께 사용한다.
- schema와 migration은 `packages/db`에서 관리하고, migration 생성/적용은 drizzle-kit로 통일한다. Better Auth가 생성하는 schema의 소유권 경계(introspect 편입 vs Better Auth CLI 별도 관리)는 1주차에 확정한다(§9.8).
- API 계약 패키지는 `api-contracts`(req/res, frontend+backend 공유)와 `ingestion-schemas`(외부 응답 검증, worker 전용)로 분리한다. zod는 single-version policy로 v4 고정.
- 운영/스테이징 DB는 Neon Postgres를 사용한다. 앱 런타임은 pooled `DATABASE_URL`, migration/관리 작업은 direct `DATABASE_DIRECT_URL`을 분리한다. **migration은 반드시 direct URL을 쓴다**(pooled transaction mode에서 DDL/prepared statement 깨짐, §9.0).
- 인증은 Better Auth를 self-hosted로 사용하고 Drizzle/Neon에 사용자, 세션, 조직, 초대 정보를 저장한다. NestJS는 Better Auth JWT를 `jose`로 검증한다(비대칭+JWKS).
- TypeScript는 최신 major보다 `5.9.x` 계열로 고정한다. Next/Nest/Drizzle/Zod 호환성과 도구 생태계를 우선한다.
- Python은 1차 기본 백엔드에 넣지 않는다. **TS baseline에서 멈추는 것을 기본값으로 두고**, Python sidecar 전환은 "고객 인터뷰에서 예측 정확도가 구매 결정 요인으로 확인될 때"라는 비즈니스 게이트가 충족될 때만 한다(`apps/ml`). 전환 대비를 위해 model feature 입출력 계약을 Zod schema로 미리 고정해 TS/Python이 같은 JSON 계약을 검증하게 한다.
- MVP에서는 Airflow를 도입하지 않는다. 배치 수가 늘고 재시도/의존성이 복잡해질 때 Prefect 또는 Airflow-lite를 검토한다.
- TimescaleDB는 처음부터 필수로 두지 않는다. PostgreSQL 파티션/인덱스로 시작하고 병목이 확인되면 도입한다.

### 7.3 권장 패키지 버전

2026-06-29 기준으로 아래 조합을 우선 검토한다.

| 패키지 | 권장 버전 | 비고 |
|---|---:|---|
| next | 16.2.x | Node >=20.9 요구 |
| react / react-dom | 19.2.x | Next 16, shadcn/ui, TanStack Query와 호환 |
| @nestjs/core / @nestjs/common | 11.1.x | Node >=20 요구 |
| better-auth | 1.6.x | 로그인, 세션, 조직/권한, JWT 플러그인 |
| drizzle-orm | 0.45.x | 타입 안전한 SQL query builder/ORM |
| drizzle-kit | 0.31.x | schema 기반 migration 생성/적용 |
| pg | 8.22.x | PostgreSQL driver와 connection pool |
| jose | 6.2.x | NestJS에서 JWT/JWKS 검증 |
| zod | 4.4.x | DTO, env, 외부 API 응답 검증 |
| @asteasolutions/zod-to-openapi | 8.5.x | 필요 시 Zod schema에서 OpenAPI 생성. Zod v4 peer 지원 |
| @tanstack/react-query | 5.101.x | API 상태/캐시 관리 |
| shadcn | 4.12.x | **컴포넌트 추가 CLI 버전**(`shadcn add`)이지 UI 컴포넌트 세트 버전이 아님. 컴포넌트는 소스로 복사됨. Node >=20.18.1 요구 |
| tailwindcss / @tailwindcss/postcss | 4.3.x | shadcn/ui 스타일 기반. **v4는 CSS-first(`@theme`), `tailwind.config.js` 사실상 폐지** — v3와 설정 패러다임 다름 |
| lucide-react | 1.22.x | shadcn/ui와 잘 맞는 아이콘. `latest`(1.22) 사용 |
| @tanstack/react-table | 8.21.x | 데이터 테이블, 정렬, 필터, 페이지네이션 (headless) |
| react-hook-form | 7.80.x | 폼 상태 관리 |
| @hookform/resolvers | 5.4.x | Zod 기반 폼 검증 연결 (Standard Schema, zod v4 OK) |
| echarts | 6.1.x | 시계열/대시보드 차트. ESM tree-shaking 권장(`echarts/core` 임포트) |
| echarts-for-react | 3.0.x | React 래퍼. peer가 `react>=16`이라 React 19 명시 미포함(설치 경고 가능, 동작 OK). 또는 래퍼 없이 echarts core 직접 사용 |
| @codegenie/serverless-express | 4.x | NestJS API를 Lambda 핸들러로 감싸는 어댑터 (또는 AWS Lambda Web Adapter 사용, 3주차 확정) |

2026-06-29 npm registry 확인 결과 위 버전은 모두 실재하며 peer dependency 사슬(better-auth ↔ drizzle-orm ↔ next ↔ zod ↔ zod-to-openapi)이 정합한다.

## 8. 데이터 레이어

```text
raw      : 원본 API 응답/CSV 파일 저장
staging  : 타입 변환, 컬럼명 정규화, 중복 제거
mart     : 화면/API 조회 최적화 테이블
model    : 예측 모델 학습/추론용 feature table
ops      : 수집 실행 이력, 오류, 품질 검사
```

### 8.1 수집 흐름

```text
Datasource Adapter
  -> Raw Store
  -> Staging Transform
  -> Quality Check
  -> Mart Upsert
  -> API/Dashboard
```

### 8.2 수집 운영 정책

- 모든 수집 실행은 `ingestion_run`에 기록한다.
- 원본 응답은 파일 경로와 hash를 저장한다.
- 중복 적재는 source natural key와 datasource_id 기준으로 막는다.
- API 오류는 status code, response body 일부, 재시도 횟수를 기록한다.
- mart 적재 전 row count, null count, 시간 연속성, 단위 범위를 검사한다.

멱등성·스케줄링 규약:
- **스케줄링은 EventBridge Scheduler로 한다**(§1.3). datasource별 schedule이 worker Lambda를 cron 호출하고, 재시도는 Scheduler retry policy, 최종 실패는 SQS DLQ에 적재한다. 재시도/실패추적/동시성 제어를 손으로 재구현하지 않는다. 로컬 개발에서는 같은 worker 엔트리포인트를 CLI로 직접 실행한다(스케줄러 없이 1회 수집).
- 수집 job은 at-least-once다(EventBridge 전달 보장과 동일 전제). **최종 멱등성은 mart의 `INSERT ... ON CONFLICT (natural key) DO UPDATE` upsert로 보장**한다(DB UNIQUE 제약을 단일 진실로). 중복 실행 방지는 큐 jobId 대신 `datasource:interval` 단위의 멱등 upsert와 `ingestion_run` 기록으로 처리한다.
- `ingestion_run.status`의 `partial` 정의: 요청 구간 중 일부 interval만 성공한 경우. 재시도는 이미 성공한 interval을 skip하는 재진입(resumable) 방식으로 한다.
- 수집 스케줄은 데이터소스별 트래픽 한도(건/시간 vs 건/일, §5.2·§5.4)에서 역산한다. 시간당 한도(수급·태양광)는 증분 수집 키(`source_date`/`source_hour`, `slot_at`)로 "새 구간이 나왔을 때만" 호출한다.

## 9. DB 설계 초안

### 9.0 스키마 공통 규약 (코드 착수 전 확정)

아래 DDL은 초안이며, 구현 전 다음 규약을 일괄 적용한다.

**레이어 네이밍.** raw/staging/mart/model/ops 5레이어는 **단일 schema + 테이블 prefix**(`raw_*`, `stg_*`, `mart_*`, `model_*`, `ops_*`)로 시작한다. PostgreSQL schema namespace 분리는 cross-schema FK와 drizzle-kit multi-schema 마이그레이션 복잡도가 커서 MVP에는 부적합하다. 현재 DDL의 테이블이 어느 레이어인지 prefix로 드러낸다(예: `generation_hourly` → `mart_generation_hourly`, `raw_object` → `raw_object` 유지, `ingestion_run` → `ops_ingestion_run`).

**NUMERIC precision.** 모든 측정값/가격/좌표 컬럼은 precision/scale을 명시하고 `CHECK`로 범위를 방어한다. 무제약 `NUMERIC` 금지(단위 오염 방어선·스토리지 효율). 표준:
- 발전량 `NUMERIC(12,3)` MWh, `CHECK (>= 0)`
- SMP `NUMERIC(10,2)` 원/kWh, `CHECK (smp_krw_per_kwh BETWEEN 0 AND 1000)` (자릿수 이상 탐지)
- REC 가격 `NUMERIC(12,2)`, 설비용량 `NUMERIC(12,3)`, 좌표 `NUMERIC(9,6)`, MW 지표 `NUMERIC(10,2)`, 비율 `NUMERIC(5,2)`

**UNIQUE 키 무결성.** UNIQUE 제약에 포함되는 컬럼은 **반드시 `NOT NULL`**로 둔다(Postgres는 NULL≠NULL이라 nullable 컬럼이 UNIQUE에 있으면 중복 적재 방지가 무력화된다). 지역 미상은 NULL 대신 `region` 테이블의 `'UNKNOWN'` 센티넬 row로 처리한다.

**enum 도메인.** `fuel_type`, `market_area`, `sky_code` 등 고정 도메인은 자유 TEXT 대신 `CHECK` 제약을 단다(이미 `status`/`organization_type`/`permission`에서 쓰는 컨벤션과 일관). PG enum 타입은 값 추가 시 migration이 번거로우므로 CHECK 또는 lookup FK를 쓴다.

**created_at/updated_at.** 모든 `created_at`은 `NOT NULL DEFAULT now()`. `updated_at`은 Drizzle `$onUpdate(() => new Date())`로 통일하거나 DB 트리거를 둔다.

**Neon pooled/direct 분리.** drizzle-kit migration은 **반드시 `DATABASE_DIRECT_URL`(direct, 5432)**을 사용한다 — PgBouncer transaction mode pooled URL로 DDL/migration을 실행하면 advisory lock·prepared statement·세션 상태가 깨진다. 런타임 `pg` Pool이 pooled URL(transaction mode)을 쓸 때는 named prepared statement 충돌에 주의하고, 충돌 시 prepared statement 회피 또는 `@neondatabase/serverless` driver 채택을 검토한다.

### 9.1 공통/운영 테이블

```sql
CREATE TABLE datasource (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  update_cycle TEXT,
  url TEXT,
  license TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name, provider)
);

CREATE TABLE ingestion_run (
  id BIGSERIAL PRIMARY KEY,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  requested_from TIMESTAMPTZ,
  requested_to TIMESTAMPTZ,
  row_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE raw_object (
  id BIGSERIAL PRIMARY KEY,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT NOT NULL REFERENCES ingestion_run(id),
  object_path TEXT NOT NULL,
  content_type TEXT,
  content_hash TEXT NOT NULL,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 동일 응답 재수집 멱등 처리. 시점별 보존이 필요하면 정책 재검토.
  UNIQUE (datasource_id, content_hash)
);

CREATE TABLE data_quality_check (
  id BIGSERIAL PRIMARY KEY,
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 9.2 지역 테이블

```sql
CREATE TABLE region (
  region_code TEXT PRIMARY KEY,
  region_name TEXT NOT NULL,
  kpx_region_name TEXT,
  kma_grid_x INTEGER,
  kma_grid_y INTEGER,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  sido_name TEXT,
  sigungu_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

초기에는 시도 대표 격자를 수동 정의한다. 이후 실제 발전소 좌표 또는 시군구 단위로 확장한다.

- 지역 미상 데이터의 UNIQUE 무결성을 위해 `region_code = 'UNKNOWN'` 센티넬 row를 seed로 만든다(§9.0).
- `kma_grid_x/y`는 1 region : 1 grid 가정이다. 시도당 격자가 여럿 필요해지면(§5.4, §12.4 인지) `region_grid_mapping(region_code, kma_grid_x, kma_grid_y, weight)` 별도 테이블로 분리한다. 위성 일사량 격자는 기상청 단기예보 격자와 또 다른 체계이므로 매핑을 별도로 둔다.
- `lat/lon`은 좌표 기반 확장 시 PostGIS `geography(Point,4326)` 도입을 검토한다.

### 9.3 발전량 테이블

```sql
CREATE TABLE generation_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  source_date DATE NOT NULL,
  source_hour INTEGER NOT NULL CHECK (source_hour BETWEEN 0 AND 24),
  region_code TEXT NOT NULL REFERENCES region(region_code),     -- UNIQUE 구성 컬럼 → NOT NULL (미상은 'UNKNOWN')
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('SOLAR', 'WIND')),
  generation_mwh NUMERIC(12,3) NOT NULL CHECK (generation_mwh >= 0),
  includes_ess BOOLEAN,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (interval_end_at = interval_start_at + interval '1 hour'),
  UNIQUE (interval_start_at, region_code, fuel_type, datasource_id)
);
CREATE INDEX ON generation_hourly (region_code, fuel_type, interval_start_at DESC);
```

### 9.4 기상/일사량 테이블

```sql
CREATE TABLE weather_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  base_at TIMESTAMPTZ NOT NULL,
  forecast_at TIMESTAMPTZ NOT NULL,
  region_code TEXT NOT NULL REFERENCES region(region_code),
  temperature_c NUMERIC(5,2),
  humidity_pct NUMERIC(5,2),
  precipitation_mm NUMERIC(7,2),
  precipitation_prob_pct NUMERIC(5,2),
  wind_speed_ms NUMERIC(5,2),
  sky_code TEXT,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_at, forecast_at, region_code, datasource_id)
);
CREATE INDEX ON weather_forecast_hourly (region_code, forecast_at);
-- 예보는 빠르게 증가할 수 있는 유일 테이블. 보관 정책(데모용 N일치 유지) 또는
-- forecast_at range 파티션을 도입 시점에 검토한다.

-- 위성 일사량은 실제 30분 간격이라 명칭을 _hourly가 아닌 _30min/무접미로 둔다.
-- 단위(W/m² 또는 MJ/m²)와 좌표체계는 1주차 실응답으로 확정한다.
CREATE TABLE solar_irradiance (
  id BIGSERIAL PRIMARY KEY,
  observed_at_utc TIMESTAMPTZ NOT NULL,
  observed_at_kst TIMESTAMPTZ NOT NULL,
  region_code TEXT NOT NULL REFERENCES region(region_code),
  irradiance_value NUMERIC(10,3),
  irradiance_unit TEXT,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (observed_at_kst = observed_at_utc + interval '9 hours'),  -- 이중 시각 정합성
  UNIQUE (observed_at_utc, region_code, datasource_id)
);
CREATE INDEX ON solar_irradiance (region_code, observed_at_kst DESC);
```

### 9.5 가격/시장 테이블

```sql
CREATE TABLE smp_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  source_date DATE NOT NULL,
  source_hour INTEGER NOT NULL CHECK (source_hour BETWEEN 0 AND 24),
  market_area TEXT NOT NULL CHECK (market_area IN ('LAND', 'JEJU')),
  smp_krw_per_kwh NUMERIC(10,2) NOT NULL CHECK (smp_krw_per_kwh BETWEEN 0 AND 1000),
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (interval_end_at = interval_start_at + interval '1 hour'),
  UNIQUE (interval_start_at, market_area, datasource_id)
);
CREATE INDEX ON smp_hourly (market_area, interval_start_at DESC);

-- REC 현물시장: 거래건수·평균가·거래량은 육지/제주 구분, 종가·총거래금액은 육지·제주 통합값.
-- 따라서 market_area에 'TOTAL'을 허용하고 close/total 값은 TOTAL 행에만 저장한다(area 행은 NULL).
CREATE TABLE rec_market_daily (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  market_area TEXT NOT NULL CHECK (market_area IN ('LAND', 'JEJU', 'TOTAL')),
  trade_count INTEGER,
  volume_rec NUMERIC(14,3),
  avg_price_krw_per_rec NUMERIC(12,2),       -- area별(LAND/JEJU)
  high_price_krw_per_rec NUMERIC(12,2),
  low_price_krw_per_rec NUMERIC(12,2),
  close_price_krw_per_rec NUMERIC(12,2),     -- 시장 통합값 → market_area='TOTAL' 행에만 채움
  total_trade_amount_krw NUMERIC(18,2),      -- 시장 통합값 → 'TOTAL' 행에만
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_date, market_area, datasource_id)
);
CREATE INDEX ON rec_market_daily (market_area, trade_date DESC);
```

### 9.6 전력수급/수요 테이블

```sql
-- observed_at은 5분 경계로 정규화한 slot_at을 UNIQUE 키로 둔다.
-- 원천 observed_at의 초/ms 흔들림이나 재조회 시 같은 5분 슬롯 중복 적재를 막는다.
CREATE TABLE supply_realtime (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL,
  slot_at TIMESTAMPTZ NOT NULL,                 -- date_trunc 또는 5분 floor (adapter에서 계산)
  supply_ability_mw NUMERIC(10,2),
  current_demand_mw NUMERIC(10,2),
  forecast_load_mw NUMERIC(10,2),
  reserve_power_mw NUMERIC(10,2),
  reserve_rate_pct NUMERIC(5,2),
  operating_reserve_power_mw NUMERIC(10,2),
  operating_reserve_rate_pct NUMERIC(5,2),
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_at, datasource_id)
);
CREATE INDEX ON supply_realtime (slot_at DESC);   -- /supply/current 최신 1건

CREATE TABLE demand_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  demand_mwh NUMERIC(12,3) NOT NULL CHECK (demand_mwh >= 0),
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (interval_end_at = interval_start_at + interval '1 hour'),
  UNIQUE (interval_start_at, datasource_id)
);
```

### 9.7 예측 결과 테이블

```sql
CREATE TABLE generation_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  forecast_run_at TIMESTAMPTZ NOT NULL,
  target_at TIMESTAMPTZ NOT NULL,
  region_code TEXT NOT NULL REFERENCES region(region_code),
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('SOLAR', 'WIND')),
  predicted_generation_mwh NUMERIC(12,3) NOT NULL CHECK (predicted_generation_mwh >= 0),
  actual_generation_mwh NUMERIC(12,3) CHECK (actual_generation_mwh >= 0),
  model_name TEXT NOT NULL,
  model_version TEXT,
  feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (forecast_run_at, target_at, region_code, fuel_type, model_name)
);
```

### 9.8 인증/권한 테이블

인증 자체의 사용자, 계정, 세션, verification, 조직, 멤버, 초대 테이블은 Better Auth의 Drizzle schema를 기준으로 생성한다. 실제 테이블명은 구현 시 prefix를 붙여 `auth_user`, `auth_session`, `auth_account`, `auth_organization`, `auth_member`, `auth_invitation`처럼 서비스 도메인 테이블과 충돌하지 않게 맞춘다.

**FK 정합성 선결 과제 (1주차 게이트).** 아래 도메인 테이블은 `auth_organization.id`, `auth_user.id`를 FK로 참조한다. Better Auth 1.6.x가 생성하는 이 id의 **실제 타입(TEXT/길이)을 introspect로 먼저 확정**해야 FK 컬럼 타입을 정확히 맞출 수 있다(불일치 시 FK 생성 자체가 실패). 또한 Better Auth 테이블의 migration 소유권(drizzle-kit introspect 후 packages/db에 편입 vs Better Auth CLI 별도 관리)을 1주차에 확정해 두 도구가 같은 테이블을 다투지 않게 한다.

서비스 도메인에서 추가로 필요한 테이블은 아래처럼 둔다.

```sql
CREATE TABLE organization_profile (
  organization_id TEXT PRIMARY KEY REFERENCES auth_organization(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('internal', 'om_company', 'generator')),
  business_registration_no TEXT,
  default_region_code TEXT REFERENCES region(region_code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()   -- Drizzle $onUpdate로 갱신
);

CREATE TABLE plant (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organization_profile(organization_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  market_area TEXT CHECK (market_area IN ('LAND', 'JEJU')),
  capacity_kw NUMERIC(12,3) CHECK (capacity_kw >= 0),
  commissioned_on DATE,
  address TEXT,
  lat NUMERIC(9,6),
  lon NUMERIC(9,6),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON plant (organization_id);

CREATE TABLE plant_access_grant (
  id BIGSERIAL PRIMARY KEY,
  plant_id BIGINT NOT NULL REFERENCES plant(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('viewer', 'analyst', 'admin')),
  granted_by TEXT REFERENCES auth_user(id) ON DELETE SET NULL,  -- nullable: grant 부여자 삭제 후에도 grant 유지
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plant_id, user_id)
);
CREATE INDEX ON plant_access_grant (user_id);

-- audit_log는 append-only. 감사 불변성을 위해 actor 삭제 시에도 기록을 남긴다(SET NULL).
-- 애플리케이션 DB 계정에는 UPDATE/DELETE 권한을 부여하지 않는다(별도 role/RLS).
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  organization_id TEXT REFERENCES organization_profile(organization_id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES auth_user(id) ON DELETE SET NULL,  -- actor 없는 이벤트는 NULL + action으로 식별
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (organization_id, created_at DESC);
```

초기 MVP에서는 조직 단위 RBAC를 권한의 기본 단위로 두고, 발전소 단위 권한은 고객 데이터 PoC부터 사용한다. 모든 고객 데이터 테이블에는 `organization_id` 또는 `plant_id`를 반드시 포함한다.

권한 이중화 규칙: org 단위 role(`auth_member.role`)과 plant 단위 `plant_access_grant.permission`이 충돌할 때, **plant grant는 org role의 상한을 넘지 못한다(deny-override)** — viewer가 특정 plant에서 admin으로 승격되는 권한상승을 막는다. grant 생성/변경은 audit 대상이다.

운영 인덱스(ops): `CREATE INDEX ON ingestion_run (datasource_id, started_at DESC);`, `CREATE INDEX ON raw_object (datasource_id, fetched_at DESC);`

## 10. API 설계 초안

API 요청/응답 계약은 Zod schema를 기준으로 정의한다. contracts 패키지는 역할에 따라 둘로 나눈다:
- `packages/api-contracts` — request/response 계약. frontend/backend가 공유.
- `packages/ingestion-schemas` — 외부 공공데이터 응답 검증 schema. **worker만 의존**(frontend는 절대 import 안 함). 외부 소스 변경이 API 계약을 오염시키지 않게 분리한다.

zod는 monorepo single-version policy로 v4에 고정하고, zod v3 peer를 강제하는 NestJS 보조 패키지는 배제한다(핵심 검증은 직접 Zod schema + 커스텀 pipe로 구현).

검증·계약 원칙:

- 모든 endpoint에 `/api/v1/` 버전 prefix를 둔다. 공공데이터 소스 변경으로 응답 계약이 바뀔 가능성이 크므로 breaking change를 버전으로 격리한다.
- 모든 query/path/body 입력은 NestJS controller 진입 시 Zod로 검증한다(공용 ZodValidationPipe를 1주차에 작성).
- 표준 에러 envelope을 api-contracts에 1개 정의하고(`{ code, message, details? }`) NestJS exception filter 1개로 통일한다. 400(검증)·401·403·404·409·**429(트래픽/레이트리밋 초과)**를 일관되게 반환한다.
- 시계열 endpoint는 **cursor 페이지네이션 + 서버측 max range 가드**를 필수로 한다. raw 해상도(5분/시간)는 짧은 범위만 허용하고, 넓은 범위는 서버에서 bucket 집계(downsampling)해 내려준다(전력수급 5분 해상도는 1년이면 10만 row를 넘는다).
- 응답 Zod 직렬화는 대량 시계열에 `.parse()`를 row마다 돌리면 비싸다. 운영에서는 envelope 메타만 검증하고 원소 배열은 타입 신뢰(또는 개발/테스트에서만 전수 parse)한다.
- 외부 공공데이터 API 응답은 raw 저장 후 staging 변환 전에 Zod로 최소 필수 필드와 타입을 검증한다.
- 환경변수는 앱 부팅 시 Zod로 검증하고, 누락/형식 오류가 있으면 프로세스를 시작하지 않는다.
- TypeScript 타입은 `z.infer<typeof Schema>`로 생성해 DTO와 타입 정의의 중복을 줄인다.
- OpenAPI 문서는 필요 시 `@asteasolutions/zod-to-openapi`로 생성한다.

```text
GET  /api/v1/health
GET  /api/v1/datasources/status

GET  /api/v1/supply/current
GET  /api/v1/supply/history?from=&to=&bucket=&cursor=&limit=

GET  /api/v1/generation/hourly?region=&fuelType=&from=&to=&cursor=&limit=
GET  /api/v1/generation/summary?region=&fuelType=&period=

GET  /api/v1/market/smp/hourly?area=&from=&to=&cursor=&limit=
GET  /api/v1/market/rec/daily?area=&from=&to=&cursor=&limit=

GET  /api/v1/weather/forecast?region=&from=&to=
GET  /api/v1/forecast/solar?region=&date=

POST /api/v1/simulator/revenue
POST /api/v1/report/monthly
```

### 10.1 수익 시뮬레이터 요청 예시

```json
{
  "regionCode": "GYEONGGI",
  "marketArea": "LAND",
  "fuelType": "SOLAR",
  "capacityKw": 500,
  "recWeight": 1.0,
  "brokerageFeeRate": 0.03,
  "periodStart": "2026-06-01",
  "periodEnd": "2026-06-30",
  "generationMethod": "regional_profile_scaled",
  "recPriceMethod": "daily_avg"
}
```

### 10.2 수익 시뮬레이터 응답 예시

```json
{
  "estimatedGenerationKwh": 62000,
  "estimatedSmpRevenue": 12300000,
  "estimatedRecRevenue": 8700000,
  "brokerageFee": 630000,
  "estimatedTotalRevenue": 20370000,
  "assumptions": {
    "smpSource": "KPX",
    "recSource": "KPX_REC_SPOT",
    "generationSource": "regional_profile_scaled",
    "isSettlementAmount": false
  },
  "warnings": [
    "공공데이터 기반 추정치이며 실제 정산 금액이 아닙니다.",
    "계약조건, 세금, REC 계약, 계량값, 설비 상태는 반영되지 않았습니다."
  ]
}
```

### 10.3 로그인/권한 API 및 처리 흐름

MVP는 공개 가입형 서비스가 아니라 **초대 기반 비공개 SaaS 데모**로 시작한다. 공개 데이터 대시보드도 고객사별 즐겨찾기, 업로드 파일, 리포트가 붙는 순간 권한 경계가 필요하므로 처음부터 로그인 후 접근을 기본값으로 둔다.

권장 흐름 (BFF 패턴):

브라우저는 NestJS를 **직접 호출하지 않는다.** 세션이 `httpOnly` 쿠키라 브라우저 JS가 토큰을 읽을 수 없으므로, Next.js 서버사이드(route handler / server action)가 BFF로서 세션→JWT 교환 후 `Authorization` 헤더를 실어 NestJS를 프록시한다. 이렇게 하면 토큰이 브라우저 JS에 절대 노출되지 않고, 크로스 도메인 쿠키·CORS credentials 문제가 사라진다.

```text
Browser (Next.js만 호출, 쿠키 자동 전송)
  -> Next.js App (BFF)
       - Better Auth session cookie 검증
       - Better Auth JWT 발급/조회 (authClient.token(), 서버사이드)
  -> NestJS API  Authorization: Bearer <jwt>   (Next 서버 → NestJS, 서버-서버)
       -> JwtAuthGuard (jose createRemoteJWKSet으로 JWKS 검증)
       -> OrganizationGuard
       -> PermissionGuard
       -> Controller/Service (resource ownership 재검사)
```

원칙:

- 로그인 UI와 세션 쿠키는 `apps/web`의 Better Auth가 담당한다.
- Better Auth route는 Next.js route handler에서 `/api/auth/*`로 제공한다.
- 브라우저에는 access token을 localStorage에 저장하지 않는다. 세션은 `httpOnly`, `secure`, `sameSite=lax` 쿠키를 사용한다.
- JWT 검증은 **비대칭 + JWKS**를 사용한다(NestJS는 공개키만 보유). jose 검증 시 `algorithms` 화이트리스트(예: EdDSA), `issuer`, `audience`, `expiration`을 명시적으로 강제한다(alg 신뢰 금지). kid 기반 무중단 키 회전 절차를 둔다.
- JWT TTL은 5~10분으로 짧게 두고, 갱신은 Better Auth 세션 기반으로 한다. **role/membership 같은 권한 사실은 JWT claim에 넣지 않고 매 요청 service layer에서 DB 조회**한다(멤버 제거·role 강등이 즉시 반영되도록 — stateless JWT 취소 불가 문제 회피).
- 권한 강제는 `APP_GUARD` 전역 등록 + **default-deny**로 한다. 공개 endpoint만 `@Public()`으로 opt-out(데코레이터 누락 시 fail-open 방지).
- resource ownership(권한 판정 3단계)은 guard가 아니라 service/repository에서 검증한다 — path의 `:organizationId`/`:plantId`를 신뢰하지 말고 로드한 resource의 org가 AuthContext와 일치하는지 확인(IDOR 차단).
- Next.js의 route 보호는 UX와 1차 방어선이다. 실제 데이터 접근 권한은 NestJS service 가까운 곳에서 다시 검사한다.
- 내부 배치/worker는 사용자 세션이 아니라 별도 machine credential 또는 service token을 사용한다.
- 1주차에 "로그인 → 보호 API 1개 호출 성공"의 walking skeleton을 게이트로 검증한다(BFF 토큰 전달 경로 실증).

추가 API (모두 `/api/v1/` prefix):

```text
GET  /api/v1/me
GET  /api/v1/organizations
GET  /api/v1/organizations/:organizationId/members
POST /api/v1/organizations/:organizationId/invitations
PATCH /api/v1/organizations/:organizationId/members/:memberId/role
DELETE /api/v1/organizations/:organizationId/members/:memberId

GET  /api/v1/plants
POST /api/v1/plants
PATCH /api/v1/plants/:plantId
GET  /api/v1/audit-logs?organizationId=&from=&to=&cursor=&limit=
```

### 10.4 권한 모델

초기 권한은 RBAC로 시작하고, 고객 발전소 데이터가 붙는 시점에 발전소 단위 ABAC를 덧붙인다.

| 역할 | 범위 | 가능 작업 |
|---|---|---|
| platform_admin | 전체 서비스 | 조직 생성, 모든 데이터/로그 조회, 장애 대응 |
| owner | 소속 조직 | 멤버 초대/권한 변경, 발전소/리포트/업로드 관리 |
| admin | 소속 조직 | 발전소 등록/수정, CSV 업로드, 리포트 생성, 시뮬레이션 저장 |
| analyst | 소속 조직 | 대시보드 조회, 시뮬레이션 실행, 리포트 생성 |
| viewer | 소속 조직 | 대시보드/리포트 조회 |

권한 판정 순서:

1. 인증 여부 확인 (인증 실패 시 401, 그 사실을 audit)
2. `organizationId`가 사용자의 membership에 포함되는지 확인 (guard)
3. 요청 resource가 해당 organization 소유인지 확인 (**service/repository에서 resource를 로드해 검증** — path id 신뢰 금지)
4. role이 action을 허용하는지 확인
5. 발전소 단위 override가 있으면 `plant_access_grant`를 추가 확인 (단 **org role 상한을 넘지 못함 — deny-override**, §9.8)

판정 1·2·4는 guard에서, 3·5는 resource를 알아야 하므로 service에서 한다. 한쪽 누락이 곧 격리 붕괴이므로 테넌트 데이터 접근은 `AuthContext`를 받는 **scoped repository로 단일화**하고, raw `db.select()` 직접 호출을 lint로 금지한다.

`platform_admin`은 단일 최대 침해 표면이므로 (a) cross-tenant 데이터/감사 조회를 **break-glass로 audit**, (b) MFA 강제, (c) 일상 계정과 분리한다.

초기 P0 화면은 `viewer` 이상이면 조회 가능하게 둔다. CSV 업로드, 리포트 생성, 발전소 설정 변경은 `analyst` 또는 `admin` 이상으로 제한한다. 조직 멤버 초대와 역할 변경은 `owner` 이상만 허용한다.

> 범위 주의(§3.1·기획 검토): 공공데이터 데모 단계에는 격리할 고객 데이터가 없다. 5단계 RBAC·조직관리·초대·감사로그 풀세트는 **고객 데이터 PoC(§17) 단계 범위**다. MVP 1차는 단일 로그인 게이트 + 단일 조직 seed로 시작하고, 아래 초대/RBAC 흐름은 PoC 시점에 켠다(§14 일정 참조).

### 10.5 가입/초대 정책

- 공개 회원가입은 열지 않는다.
- 초기 내부 데모 계정은 seed script로 만든다.
- 고객 미팅용 계정은 `platform_admin`이 조직을 만들고 `owner`를 초대한다.
- 초대 토큰 보안: **CSPRNG 128bit 이상**, DB에는 `hash(token)`만 저장(평문 금지), 7일 만료, **수락 즉시 무효화(single-use)**, 재발송 시 기존 토큰 rotate, 취소 시 즉시 무효. `auth_invitation`에 status(pending/accepted/revoked/expired) 상태머신을 둔다.
- **초대 수락 계정의 이메일이 초대받은 이메일과 일치하는지 검증**한다(불일치 시 거부). 이로써 토큰 탈취자가 자기 계정으로 수락해 타 조직에 침투하는 것을 막는다. OAuth 수락도 동일 검증.
- 초대 수락 시 사용자가 이미 존재하면 membership만 추가하고, 없으면 가입 후 membership을 연결한다.
- 로그인/초대/비밀번호 재설정 endpoint와 `/api/auth/*`에 **IP·계정 단위 rate limit**(예: 로그인 5회/15분)을 둔다. 로그인·재설정 응답은 계정 존재 여부를 드러내지 않게 **enumeration-safe**(동일 메시지·타이밍)로 통일한다.
- 이메일/비밀번호 로그인을 1차로 두되, 고객사 요구가 생기면 Google/Microsoft OAuth를 추가한다.
- 엔터프라이즈 SSO, SAML, SCIM은 MVP 범위 밖으로 둔다.

## 11. 화면 설계

### 11.1 전력수급 상황판

목적: 현재 전력계통 상황을 빠르게 확인한다.

핵심 컴포넌트:

- 현재수요 카드
- 공급능력 카드
- 공급예비력 카드
- 공급예비율 카드
- 최근 24시간 수요/예비율 그래프
- 최신 데이터 기준시각
- API 수집 상태

### 11.2 발전량·가격 대시보드

목적: 지역별 태양광 발전량과 시장 가격의 흐름을 함께 본다.

핵심 컴포넌트:

- 지역 선택 필터
- 기간 선택 필터
- 태양광 발전량 시계열
- SMP 시계열
- REC 평균가/종가 시계열
- 전일/전주/전년 동월 대비 변화율
- 데이터 한계 안내

### 11.3 수익 시뮬레이터

목적: 가상 발전소 기준으로 예상 수익을 계산한다.

입력값:

- 지역
- 시장 구분: 육지/제주
- 설비용량 kW
- REC 가중치
- 중개 수수료율
- 기간
- 발전량 산정 방식
- REC 가격 기준: 평균가/종가

출력값:

- 예상 발전량
- SMP 수익
- REC 수익
- 중개 수수료
- 총 예상 수익
- 일별/월별 추이
- 계산 가정과 면책 문구

### 11.4 예측 데모

목적: 공공데이터 기반 지역 단위 발전량 예측 가능성을 확인한다.

핵심 컴포넌트:

- 지역 선택
- 날짜 선택
- 예측 발전량 그래프
- 실제 발전량과 비교
- MAE/MAPE 표시
- 날씨·일사량 요약
- 모델 버전과 실행일시

### 11.5 월간 리포트

목적: 고객 미팅 또는 내부 공유용 샘플 자료를 생성한다.

리포트 항목:

- 월간 전력수급 요약
- 지역별 태양광 발전량 추이
- SMP/REC 가격 추이
- 가상 발전소 수익 시뮬레이션
- 예측 모델 성능 요약
- 데이터 한계 및 가정

### 11.6 로그인/조직 관리

목적: 비공개 데모 접근과 고객사별 데이터 접근을 분리한다.

핵심 컴포넌트:

- 로그인 화면
- 현재 조직 선택 메뉴
- 내 역할/권한 표시
- 조직 멤버 목록
- 초대 생성/재발송/취소
- 역할 변경
- 접근 불가 화면
- 감사 로그 목록

MVP에서는 조직 생성과 최초 owner 초대는 `platform_admin`만 수행한다. 일반 고객 사용자는 초대 수락, 조직 전환, 본인 세션 관리만 가능하게 둔다.

## 12. 예측 모델 계획

### 12.1 1차 baseline

복잡한 딥러닝 모델보다 설명 가능한 baseline부터 시작한다.

```text
예측값 =
  같은 지역의 최근 N일 동일 시간대 발전량 중앙값
  + 요일/계절 보정
  + 날씨/일사량 보정 계수
```

초기 N은 7일과 30일을 비교한다. 태양광은 야간 발전량이 0에 가까우므로 MAPE는 일출 후/일몰 전 또는 실제 발전량이 일정 임계값 이상인 시간대에만 보조 지표로 사용한다.

### 12.2 2차 ML 모델

baseline 이후 LightGBM 또는 XGBoost를 검토한다.

| 분류 | Feature 후보 |
|---|---|
| 시간 | hour, day_of_week, month, holiday 여부 |
| 지역 | region_code, 위도, 경도 |
| 과거 발전량 | 전일 동일시간, 7일 중앙값, 30일 평균 |
| 기상 | 기온, 습도, 강수량, 강수확률, 풍속, 하늘상태 |
| 일사량 | 위성 기반 일사량 |
| 시장/계통 | 전국 전력수요, 수급상태 |

Target:

```text
region_code + target_at 기준 태양광 발전량 MWh
```

### 12.3 평가 지표

| 지표 | 설명 |
|---|---|
| MAE | 평균 절대 오차 |
| RMSE | 큰 오차에 민감한 지표 |
| MAPE | 발전량 0 근처에서는 왜곡되므로 daylight 구간 중심으로 사용 |
| 시간대별 오차율 | 오전/정오/오후별 성능 확인 |
| 날씨별 오차율 | 맑음/흐림/강수 조건별 성능 확인 |
| 지역별 오차율 | 지역별 모델 성능 차이 확인 |

### 12.4 예측 기능의 주의점

- 공공데이터의 발전량은 지역 집계 단위이며 개별 발전소 예측과 다르다.
- 기상청 격자와 KPX 지역 단위의 매핑 오차가 있다.
- 태양광 발전량에는 설비 보급량 변화 효과가 섞일 수 있다.
- 장기 시계열 비교에는 지역별 설비용량 보정이 필요하다.
- ESS 충방전량이 포함될 수 있어 야간 이상치를 품질검사 대상으로 둔다.

## 13. 수익 계산 로직

### 13.0 정산유형 선택 (도메인 전제)

한국 태양광 발전사업자의 **상당수는 한국에너지공단 고정가격계약(SMP+REC 20년 고정, FIT 유사) 또는 장기 REC 계약**으로 정산받는다. 현물 SMP + 현물 REC에 그대로 노출되는 사업자는 일부(주로 계약 미체결분·초과물량)다. 따라서 현물 가격 기반 단순 계산은 다수 고객의 실제 수익과 **체계적으로 어긋난다.**

이 괴리는 세부 주의사항이 아니라 **수익 모델의 근본 전제**이므로, 시뮬레이터는 정산유형을 먼저 선택하게 한다.

| settlementType | 설명 | 수익 계산 |
|---|---|---|
| spot_exposure | 현물 SMP + 현물 REC 노출 | §13.1 공식 (디폴트 가정, 1순위 면책 표시) |
| fixed_price_contract | 고정가격계약(SMP+REC 합산 고정단가) | 발전량 × 고정단가(사용자 입력) |
| custom | 사용자가 단가/조건 직접 입력 | 입력값 기반 |

화면 상단에 "본 추정은 현물시장 노출 가정이며, 고정가격계약 사업자에게는 적용되지 않습니다"를 1순위 면책으로 표시한다.

### 13.1 기본 공식 (spot_exposure 기준)

```text
예상 발전량(kWh) = 설비용량(kW) × 추정 이용시간(h)
SMP 수익 = 시간별 발전량(kWh) × 시간별 SMP(원/kWh)
발급 REC = 인증 발전량(MWh) × 1(REC/MWh) × REC 가중치   # RPS는 1MWh=1REC 기준 + 가중치
REC 수익 = 발급 REC × REC 가격(원/REC)
중개 수수료 = (SMP 수익 + REC 수익) × 수수료율
예상 총수익 = SMP 수익 + REC 수익 - 중개 수수료
```

REC 발급식 주의:
- REC는 **1MWh = 1REC를 기준으로 발급되고 가중치가 곱해진 "가중부여 REC"**가 거래된다.
- 식의 "인증 발전량"은 RPS 설비로 인증·계량된 발전량이다. **공공데이터 발전량(전력시장 거래량)은 RPS 인증 발전량이 아니므로 시뮬레이션 가정값**이다.
- REC는 보통 **분기/반기 단위로 발급·정산**되며 시간별이 아니다. 일별 현물가로 일 단위 매칭하는 것은 실제 정산 주기와 다른 근사다.

### 13.2 발전량 산정 방식

MVP에서는 아래 방식 중 하나를 선택할 수 있게 설계한다.

| 방식 | 설명 | 권장도 |
|---|---|---:|
| user_input_generation | 사용자가 예상 발전량을 직접 입력 | 높음 |
| regional_profile_scaled | 지역 발전량 패턴을 설비용량 기준으로 정규화해 추정 | 중간 |
| fixed_capacity_factor | 사용자가 입력한 이용률/이용시간으로 추정 | 높음 |

`regional_profile_scaled`는 지역 총 발전량을 단순히 설비용량으로 나누는 방식이 아니어야 한다. 지역별 누적 설비용량으로 정규화해야 하는데, 해당 데이터는 **한국에너지공단 신재생 보급통계 / KPX EPSIS에 분기·연 단위로 공개**되므로 1주차에 출처를 확인한다(있으면 정규화 품질이 크게 오름). 확보 전에는 "시뮬레이션용 패턴"으로만 표시한다.

### 13.3 주의사항

- 결과는 법적 정산금액이 아니라 시뮬레이션 결과다.
- **다수 사업자는 고정가격계약으로 정산받으므로 현물 가정(spot_exposure) 결과가 실제와 크게 다를 수 있다(§13.0).**
- 실제 정산은 계약조건, 계량값, REC 계약, 세금, 수수료, 정산 규칙에 따라 달라진다.
- REC 가중치는 발전원, 설치유형, 설비조건에 따라 달라지므로 사용자가 직접 입력한다.
- REC는 분기/반기 발급·정산이라 일별 현물가 기반 계산은 근사임을 표시한다.
- SMP는 육지/제주 구분이 필요하다.
- REC 가격은 평균가/종가/계약가 기준에 따라 결과가 달라진다. **REC 종가·거래금액은 육지·제주 통합값**이고 평균가·거래건수만 육지/제주 구분됨(§9.5 참조).

## 14. 개발 일정

### 14.0 인력 가정과 일정 전제 (먼저 확정)

일정의 현실성은 인력 규모에 좌우되므로 이를 명시한다.

- **인력 규모를 §16에서 먼저 확정한다.** 아래 일정은 **개발 2인(프론트 1 + 백엔드/데이터 1)** 기준이다. 1인 풀스택이면 현 범위는 10~12주가 필요하므로, 그 경우 예측·리포트(P1)와 멀티테넌트 인증을 제외하고 P0 핵심(수급/대시보드/시뮬레이터/단일 로그인)만 6주로 잡는다.
- **외부 의존(공공데이터 활용신청 승인)은 통제 불가 대기다.** 활용신청은 기획 확정 전이라도 **D-14에 선제출**해 크리티컬 패스에서 뺀다. SMP는 사용자 입력 가격 fallback을 1순위로 깔고 시작하므로 SMP API 확정은 게이트가 아니다(§5.4).
- **고객 인터뷰는 0~1주차로 전진**한다(목업/피그마 기반 최소 5건). 6주차에 몰아서 하는 build trap을 피한다.
- 멀티테넌트 인증(초대·RBAC·감사)은 본 6주에서 빼고 단일 로그인 게이트로 대체한다(§3.1). 회수한 시간을 인터뷰·시뮬레이터 완성도·데모 리허설에 쓴다.

### 14.1 6주 MVP 일정

| 주차 | 목표 | 산출물 | 게이트 |
|---:|---|---|---|
| 0~1주차 | 인터뷰 선행 + 데이터 소스 확정 + 환경 구성 | 인터뷰 5건+, API 신청(D-14 선제출), 응답 샘플, DB schema, Neon 연결(pooled/direct), **인증 walking skeleton(BFF)**, ECharts/토큰 fetch 래퍼 스파이크 | 도메인 체크리스트(§5.5·아래) + 로그인→보호 API 1콜 성공 |
| 2주차 | P0 수집 파이프라인(EventBridge+Lambda 전제, 로컬은 CLI 실행) | 전력수급, 태양광, SMP, REC 적재 | 원본 저장/중복 방지(upsert 멱등) |
| 3주차 | 핵심 대시보드 + 단일 로그인 | 전력수급 화면, 발전량·가격 화면, 필터, 단일 로그인 게이트 | 최신 기준시각·데이터 한계 표시 |
| 4주차 | 수익 시뮬레이터 | 정산유형 선택 계산 API, 화면, 면책 문구 | 샘플 시나리오 검증 |
| 5주차 | (버퍼/조건부) 예측 데모·리포트 | baseline 예측, 오차율, Markdown 리포트 | **인터뷰에서 예측 니즈 확인 시에만 착수**, 아니면 버퍼/리포트·비교에 사용 |
| 6주차 | QA + 인터뷰 마무리 + PoC 제안 | 데모 시나리오, 추가 인터뷰, PoC 제안서 초안 | 내부 데모 통과 + §15.0 metric 점검 |

### 14.2 1주차 상세 태스크

- **타깃 O&M 업체 인터뷰 선행(목업/피그마 기반 최소 5건)** — §15.0 metric 검증 시작
- **공공데이터 API 활용신청(D-14 선제출)** + 데이터셋별 이용허락 유형(1~4) 확인
- 데이터 소스별 응답 샘플 저장
- **도메인 체크리스트 확정**: SMP 응답 단위(원/kWh 자릿수)·육지/제주, 트래픽 한도(건/시간 vs 건/일), REC 발급식·정산주기·종가 통합값, 거래시간 0–23/1–24 교차검증, 일사량 단위·좌표체계, 지역 누적 설비용량 출처(에너지공단 보급통계)
- DB schema 초안 작성(§9.0 규약 적용: NUMERIC precision, NOT NULL UNIQUE, CHECK, 인덱스)
- Better Auth `auth_*` id 타입 **introspect** + FK 설계 확정 + migration 소유권 경계 결정
- Neon branch 전략과 `DATABASE_URL`/`DATABASE_DIRECT_URL` 분리(**migration=direct 강제**)
- 단일 로그인 게이트 + seed 계정 생성 방식 결정(멀티테넌트 RBAC는 PoC 단계로 이연)
- **인증 walking skeleton(BFF 토큰 전달)** + ECharts `<ChartContainer>` 래퍼 + 토큰 fetch 래퍼 스파이크
- 지역명/지역코드 매핑 초안 작성(`UNKNOWN` 센티넬 포함)
- AWS 계정/리전 확정 + S3 raw bucket 네이밍 결정 (배포 IaC는 3주차)
- monorepo 구조 확정(apps/web, apps/api, packages/db, packages/api-contracts, packages/ingestion-schemas, NestJS standalone worker)

### 14.3 2주차 상세 태스크

- 현재전력수급현황 수집
- 지역별 태양광 발전량 수집
- SMP 데이터 수집
- REC 데이터 수집
- raw/staging/mart 구조 구현
- ingestion_run/raw_object/data_quality_check 기록
- 중복 적재 방지

### 14.4 3주차 상세 태스크

- Better Auth 로그인 화면 구현
- Next.js 보호 route와 현재 조직 선택 구현
- NestJS JWT guard, organization guard, permission guard 구현
- 역할별 메뉴/버튼 노출 제어
- 전력수급 상황판 구현
- 발전량 시계열 그래프 구현
- SMP/REC 가격 그래프 구현
- 필터: 기간, 지역, 시장 구분
- 기본 에러/로딩 처리
- 데이터 최신성 표시

### 14.5 4주차 상세 태스크

- 수익 시뮬레이터 API 구현
- 수익 시뮬레이터 화면 구현
- 발전량 산정 방식 선택 옵션 구현
- REC 가격 기준 선택 옵션 구현
- 가정/주의사항 표시
- 샘플 데이터 기반 시나리오 작성

### 14.6 5주차 상세 태스크

- 기상청 단기예보 연동
- 일사량 데이터 연동 가능성 검증
- 지역-기상격자 매핑
- baseline 예측 모델 구현
- 실제값 vs 예측값 비교
- MAE/MAPE 계산
- 월간 리포트 Markdown 초안

### 14.7 6주차 상세 태스크

- 데이터 누락/중복 QA
- 예측 성능 리포트 작성
- 고객 인터뷰용 데모 흐름 작성
- 내부 공유 문서 업데이트
- PoC 제안서 초안 작성
- 다음 단계 의사결정 자료 작성

## 15. Definition of Done

### 15.0 성공 metric (outcome — 기술 완료가 아닌 가설 검증 기준)

기존 DoD는 모두 "기능이 동작한다"는 build 기준이다. 이 프로젝트는 가설 검증 데모이므로, 기능 완료와 별개로 **가설별 outcome metric**으로 성공/실패를 판정한다. 이 metric을 못 채우면 기능이 다 됐어도 "성공"이 아니다.

| 가설(§2.3) | 측정 가능한 성공 기준 |
|---|---|
| 1. 한 화면에서 발전량·가격·수익·리포트를 보고 싶어 한다 | 데모 후 "내 발전소로 돌려보고 싶다/이 화면이 업무에 쓸모 있다" 긍정 반응 ≥ 인터뷰의 절반 |
| 2. 공공데이터만으로 PoC를 끌어낼 수 있다 | 타깃 O&M 업체 인터뷰 ≥ 8건 완료, 데모 후 PoC/CSV 제공 의사 ≥ 2곳 |
| 3. 고객 CSV가 붙으면 리포팅 SaaS로 확장된다 | "발전량 CSV를 제공할 의향" 표명 ≥ 2곳, 확장 기능 우선순위 인터뷰 피드백 수집 |

각 P0 기능 DoD에는 "이 화면이 고객 질문 1개를 답한다"는 outcome 한 줄을 덧붙인다.

### 15.1 데이터 수집

- 최소 5개 데이터 소스를 적재한다.
- 원본과 정제 데이터를 분리한다.
- 수집 실행 이력이 남는다.
- 수집 실패 로그가 남는다.
- 중복 적재가 방지된다.
- 최신 데이터 기준시각을 조회할 수 있다.

### 15.2 대시보드

- 기간/지역/시장 구분 필터가 동작한다.
- 시계열 그래프가 정상 렌더링된다.
- 최근 데이터 기준일 또는 기준시각이 표시된다.
- 데이터 한계가 화면에 표시된다.
- API 실패 또는 데이터 없음 상태를 사용자에게 보여준다.

### 15.3 API 계약/검증

- 주요 request query/body schema가 Zod로 정의되어 있다.
- 잘못된 입력은 일관된 400 응답으로 반환된다.
- 주요 response schema가 frontend 타입과 공유된다.
- 공공데이터 API 응답의 최소 필수 필드 검증이 staging 전 단계에 포함된다.
- 환경변수 검증 실패 시 앱이 시작되지 않는다.

### 15.4 인증/권한

- 로그인하지 않은 사용자는 보호 화면에 접근할 수 없다.
- NestJS 보호 API는 JWT 없이는 401을 반환한다(default-deny — 데코레이터 누락 endpoint도 차단).
- 사용자가 속하지 않은 organization 데이터 요청은 403/404를 반환하며, **tenant matrix 테스트**(타 org 토큰·타 org resource id 직접 지정 차단)가 통과한다.
- `viewer`, `analyst`, `admin`, `owner`, `platform_admin` 역할별 허용 작업이 테스트된다.
- 멤버 제거/role 강등이 다음 요청부터 즉시 반영된다(권한을 매 요청 DB 조회).
- 초대 기반 가입과 role 변경 흐름이 동작한다(초대 토큰 single-use·이메일 일치 검증 포함).
- 로그인 성공/실패, 권한 거부, 권한 변경, CSV 업로드, 리포트 생성, export, admin cross-tenant 접근은 `audit_log`에 남는다(append-only).

### 15.5 수익 시뮬레이터

- 사용자가 설비용량, REC 가중치, 수수료율, 기간을 입력할 수 있다.
- SMP 수익, REC 수익, 총 예상수익을 계산한다.
- 계산 가정과 면책 문구가 표시된다.
- 동일 입력에 대해 재현 가능한 결과가 나온다.

### 15.6 예측 데모

- 최소 1개 지역 이상 예측값을 생성한다.
- 실제값과 비교해 MAE 또는 MAPE를 표시한다.
- 모델 버전과 실행일시가 저장된다.
- 예측 결과가 "개별 발전소 예측이 아님"을 명시한다.

### 15.7 리포트

- 월간 요약 리포트를 생성할 수 있다.
- 발전량 그래프, SMP/REC 요약, 수익 시뮬레이션 결과가 포함된다.
- 데이터 한계와 계산 가정이 포함된다.

## 16. 의사결정 필요사항

아래 의사결정은 **코드 착수 전 클로징 회의에서 닫는다.** 미결 의사결정 위에 일정을 확정하면 전제가 뒤집힐 때 일정 전체가 재작성된다. 각 항목에 권장안을 함께 둔다.

| # | 결정 사항 | 권장안 |
|---:|---|---|
| 0 | **개발 인력 규모(가장 먼저)** | 일정 전제(§14.0). 2인이면 축소된 6주 범위 가능, 1인이면 P0만 6주 |
| 1 | 초기 타깃을 태양광 O&M 업체로 확정 | 확정. 단 "지역 평균 vs 내 발전소(사용자 입력)" 비교를 hero로 끌어올려 지불의사 가설 검증 |
| 2 | MVP를 비공개 초대형 데모로 | 확정. 단 인증은 **단일 로그인 게이트**로 시작, 초대/RBAC는 PoC 단계 |
| 3 | 기본 스택 확정 | 확정(버전표 npm 검증 통과) |
| 4 | 예측을 P1 데모로 | 확정. 단 **인터뷰에서 예측 니즈 확인 시에만** 5주차 착수 |
| 5 | 고객 인터뷰 개발 전 병행 | **Yes — 0~1주차 전진(전제로 확정, 더 이상 미결 아님)** |
| 6 | SMP 늦어지면 사용자 입력 가격으로 먼저 오픈 | **Yes — fallback을 기본 경로로(SMP API는 게이트 아님)** |
| 7 | 이메일/비밀번호 우선, OAuth 2차 | 확정 |
| 8 | Better Auth self-hosted 시작, SSO 시 managed 재검토 | 확정. 권한 원장을 서비스 DB로 분리해 전환 가능성 유지 |

## 17. 고객 데이터 연동 확장 계획

공공데이터 MVP 이후 가장 먼저 붙일 고객 데이터는 **발전량 CSV 업로드**다.

### 17.1 고객 데이터 1단계

| 데이터 | 예시 | 활용 |
|---|---|---|
| 발전소 정보 | 위치, 설비용량, 준공일 | 지역 평균 비교, 수익 계산 |
| 시간별/일별 발전량 | CSV/Excel | 실제 수익 계산, 이상탐지 |
| 계약조건 | 수수료율, REC 계약 여부 | 실제 리포트 계산 |
| 정산내역 | 월별 입금액 | 예상값 vs 실제값 비교 |

### 17.2 고객 데이터 2단계

| 데이터 | 예시 | 활용 |
|---|---|---|
| 인버터 데이터 | 출력, 장애코드, 상태 | 실시간 모니터링, 고장탐지 |
| 계량기 데이터 | 시간대별 계량값 | 정산 자동화 |
| 유지보수 이력 | 점검일, 교체 이력 | 성능 저하 원인 분석 |
| 패널 정보 | 방향, 경사각, 모듈 종류 | 개별 발전소 예측 정확도 개선 |

## 18. 보안 및 운영 고려사항

MVP 단계에서도 로그인 이메일, 조직명, 초대 이력 같은 최소 개인정보가 생긴다. 고객 데이터 PoC로 넘어가면 발전소 위치, 설비용량, 수익 추정치, 업로드 파일이 민감정보가 되므로 처음부터 아래 정책을 적용한다.

### 18.1 인증/세션

- 세션 쿠키는 `httpOnly`, `secure`, `sameSite=lax`로 설정한다. Better Auth의 CSRF 보호/origin 검증을 활성 확인하고, NestJS는 쿠키가 아닌 Bearer 토큰을 받으므로 CSRF 표면이 작다(web↔api CORS allowlist는 좁게).
- access token은 브라우저 localStorage에 저장하지 않으며, BFF(§10.3)를 통해 서버사이드에서만 다룬다.
- JWT는 **비대칭+JWKS**로 검증하고 TTL 5~10분으로 짧게 둔다. **권한 사실(role/membership)은 claim에 넣지 않고 매 요청 DB 조회**(또는 짧은 TTL 캐시+무효화)한다 — stateless JWT는 취소가 불가하므로 멤버 제거/role 강등이 토큰 만료까지 살아있는 문제를 이렇게 회피한다. JWKS는 kid 병행으로 무중단 회전한다.
- 비밀번호 로그인 사용 시 최소 길이, **IP·계정 단위 rate limit(brute force/credential stuffing 방어)**, 비밀번호 재설정 이메일을 구현한다. 로그인/재설정 응답은 enumeration-safe로 통일한다.
- 최소 `platform_admin`/`owner`에 MFA를 적용한다. 세션은 idle/absolute timeout과 강제 로그아웃(세션 무효화)을 지원한다.
- OAuth provider를 추가할 경우 허용 domain 또는 초대 기반 가입 검사를 유지한다.
- 보안 헤더(HSTS, CSP, X-Content-Type-Options)와 CORS allowlist를 기본 적용한다.

### 18.2 권한/테넌트 격리

- 모든 고객 데이터 조회는 `organization_id` 또는 `plant_id` scope를 요구한다.
- **격리를 관례(수동 WHERE)에 맡기지 않는다.** Drizzle은 org filter를 자동으로 붙이지 않으므로 쿼리 하나만 누락해도 cross-tenant 노출(OWASP A01)이다. → **MVP부터 PostgreSQL RLS**(Neon 지원: 트랜잭션에서 `SET LOCAL app.current_org`, 정책 `USING (organization_id = current_setting('app.current_org'))`)를 default-deny 백스톱으로 둔다. RLS가 부담이면 최소한 **`AuthContext`를 받는 scoped repository로 단일화**하고 raw `db.select()` 직접 호출을 lint로 금지한다.
- NestJS service layer에서 membership과 resource ownership(로드한 resource의 org가 내 membership에 속하는지)을 확인한다. path/query의 id를 신뢰하지 않는다(IDOR 차단).
- **공유 공공데이터(mart_* 시계열, org 컬럼 없음)와 테넌트 데이터(plant/organization_profile/audit_log/업로드/리포트)의 경계를 코드에서 명확히 분리·강제**한다.
- organization scope 누락 방지 테스트는 **tenant matrix 테스트**로 구체화한다: 모든 보호 endpoint에 대해 (a) 인증 없이 401, (b) 타 org 토큰으로 403/404, (c) 타 org resource id 직접 지정 시 차단을 자동 검증하고, endpoint 인벤토리 대비 default-deny 커버리지를 검사한다.

### 18.3 데이터/파일 보호

- 발전소 위치, 수익정보, 계약조건, 업로드 파일은 organization 단위로 접근을 제한한다.
- 업로드 원본 파일은 private object storage에 저장하고 다운로드 URL은 짧은 만료시간 + org-scope presigned로 둔다.
- 업로드 시 **확장자 + MIME + 매직바이트 검증, 크기 제한, 경로 traversal 방지**를 한다. CSV는 셀 선행 `= + - @`를 escape해 **CSV injection(수식 실행)**을 막는다.
- 로그에는 이메일, API key, token, 원본 파일 본문 같은 민감정보를 남기지 않는다(로그 마스킹).
- 리포트 PDF/Markdown은 생성자, 생성시각, organization scope를 기록하고 **출처표시(공공데이터 제공기관)**를 자동 삽입한다.

### 18.4 운영 비밀값

- 공공데이터 API key, Better Auth secret, JWT signing key, Neon connection string은 환경변수로 관리하되, 가능하면 배포 플랫폼 secret 또는 secret manager를 사용한다(다중 인스턴스/회전/감사 추적).
- `DATABASE_URL`은 앱 런타임용 pooled URL, `DATABASE_DIRECT_URL`은 migration/admin 작업용 direct URL로 분리한다. **migration은 반드시 direct URL을 쓴다**(§9.0).
- 로컬 `.env`는 git에 포함하지 않는다.
- 운영 key rotation 절차를 문서화한다 — JWT 서명키/JWKS는 kid 병행으로 **무중단 rollover**, Better Auth secret·공공 API key의 회전 주기와 절차를 구체화한다.

### 18.5 감사/복구

- 감사 로그 대상: 로그인 **성공/실패**, 권한 거부(403), 초대 생성/수락/취소/재발송, role 변경, plant_access_grant 변경, CSV 업로드, 리포트 생성, **데이터 export/다운로드, platform_admin의 cross-tenant 접근(break-glass)**.
- `audit_log`는 **append-only**다. 애플리케이션 DB 계정에 UPDATE/DELETE 권한을 부여하지 않는다(별도 role 또는 RLS). actor 없는 이벤트는 NULL actor + action으로 식별하고, IP는 신뢰 프록시 hop만 X-Forwarded-For를 파싱한다.
- Neon 백업/restore 정책과 branch 기반 staging 복구 절차를 확인한다.
- PII 보호: 사업자등록번호 암호화/접근제한, 탈퇴 시 개인정보 보존·삭제 정책, 로그 마스킹. 고객 데이터 PoC 전 서비스 이용약관, 개인정보 처리방침, 데이터 처리 동의 문구(개인정보보호법 관점)를 준비한다.

## 19. 주요 리스크

| 리스크 | 영향 | 대응 |
|---|---:|---|
| 공공데이터 API 변경/중단 | 높음 | 원본 저장, 대체 데이터 소스 확보, adapter 분리 |
| SMP 대체 소스 미확정 | 높음 | 1주차 게이트로 관리, 시뮬레이터 가격 수동 입력 fallback |
| 데이터 해상도 부족 | 높음 | 공공데이터는 데모용으로 한정, 고객 데이터 PoC로 보완 |
| 예측 정확도 낮음 | 중간 | 정확도보다 오차 분석과 설명 가능성에 초점 |
| 고객 지불의사 부족 | 높음 | 개발 전 인터뷰, 리포트 자동화 니즈 검증 |
| 기존 중개사업자 포털과 중복 | 중간 | O&M/설치업체/리포팅 자동화로 차별화 |
| 규제 영역 오해 | 중간 | 실제 거래·입찰·제어 제외를 명시 |
| 데이터 라이선스/이용 조건 | 중간 | 출처 표시, 이용조건 확인 |
| 조직별 데이터 접근 누락 / IDOR | 높음 | RLS 또는 scoped repository(default-deny), service layer ownership 검사, tenant matrix 테스트, 감사 로그 |
| JWT 취소 불가 (탈취·강등 후 잔존) | 높음 | 짧은 TTL + 권한은 매 요청 DB 조회, 세션 무효화로 강제 로그아웃 |
| 초대 토큰 위조·계정 바인딩 공격 | 높음 | 해시 저장·single-use·이메일 일치 검증·재발송 rotate |
| brute force / 계정 열거 | 중간 | rate limit, enumeration-safe 응답, MFA(admin) |
| 인증 라이브러리 변경 리스크 | 중간 | 권한 원장을 서비스 DB schema로 분리하고 managed provider 전환 가능성 유지 |

## 20. 참고 데이터 출처

실제 개발 전 각 데이터의 최신 API 명세, 활용신청 조건, 이용허락범위, 업데이트 주기, 트래픽 제한을 다시 확인한다.

1. 한국전력거래소_지역별 시간별 태양광 및 풍력 발전량
   https://www.data.go.kr/data/15065269/fileData.do

2. 한국전력거래소_지역별 시간별 태양광 발전량 정보
   https://www.data.go.kr/data/15103243/openapi.do

3. 한국전력거래소_계통한계가격조회
   https://www.data.go.kr/data/15076302/openapi.do

4. 한국전력거래소_시간별 계통한계가격
   https://www.data.go.kr/data/15086088/fileData.do

5. 한국전력거래소_REC 현물시장 정보
   https://www.data.go.kr/data/15099762/openapi.do

6. 한국전력거래소_현재전력수급현황조회
   https://www.data.go.kr/data/15056640/openapi.do

7. 한국전력거래소_시간별 전국 전력수요량
   https://www.data.go.kr/data/15065266/fileData.do

8. 기상청_단기예보 조회서비스
   https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15084084

9. 기상청_천리안위성 2A호 인공지능 기반 일사량 조회서비스
   https://www.data.go.kr/data/15139479/openapi.do

## 21. 참고 기술 문서

1. Better Auth Drizzle adapter
   https://www.better-auth.com/docs/adapters/drizzle

2. Better Auth JWT plugin
   https://www.better-auth.com/docs/plugins/jwt

3. Better Auth organization plugin
   https://www.better-auth.com/docs/plugins/organization

4. Better Auth admin plugin
   https://www.better-auth.com/docs/plugins/admin

5. Auth.js Drizzle adapter
   https://authjs.dev/getting-started/adapters/drizzle

6. Neon Drizzle guide
   https://neon.tech/docs/guides/drizzle

7. npm `better-auth`
   https://registry.npmjs.org/better-auth/latest

8. npm `jose`
   https://registry.npmjs.org/jose/latest

## Appendix A. 1차 MVP 요약

```text
공공데이터 기반 MVP
= 전력수급 상황판
+ 지역별 태양광 발전량 분석
+ SMP/REC 가격 조회
+ 가상 설비 수익 시뮬레이터
+ 초대 기반 로그인/조직 권한
+ 제한적 발전량 예측 데모
+ 샘플 리포트 생성
```

## Appendix B. 향후 유료 SaaS 방향

```text
고객 데이터 연동 SaaS
= 발전량 CSV 업로드
+ 발전소별 수익/정산 리포트
+ 지역 평균 대비 성능 비교
+ 발전량 이상탐지
+ 예측 오차 분석
+ 고객별 월간 리포트 자동 발송
```

## Appendix C. 최종 판단

이 프로젝트는 "VPP 플랫폼"으로 시작하면 범위가 너무 크다. 초기에는 **공공데이터 기반 분석 MVP**로 시작하고, 이후 고객 데이터가 붙는 순간부터 **태양광 발전사업자/O&M 업체용 수익·정산·예측 리포팅 SaaS**로 발전시키는 것이 가장 현실적이다.
