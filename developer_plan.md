# Solar Market Intelligence MVP 개발계획서

- 문서 버전: v0.2
- 작성일: 2026-06-29
- 수정일: 2026-06-29
- 상태: 내부 검토용 초안
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

| 범위 | 내용 | 완료 기준 |
|---|---|---|
| 데이터 수집 | 전력수급, 지역별 태양광 발전량, SMP, REC, 기상 또는 일사량 중 최소 5종 | 배치 실행, 원본 저장, 정제 테이블 적재 |
| 전력수급 상황판 | 현재수요, 공급능력, 예비력, 예비율, 최근 추이 | 최신 기준시각 표시 |
| 발전량/가격 대시보드 | 지역별 태양광 발전량, SMP/REC 추이 | 기간·지역 필터 동작 |
| 수익 시뮬레이터 | 설비용량, REC 가중치, 수수료율 입력 기반 예상 수익 | 계산 가정과 면책 문구 표시 |
| 데이터 품질 표시 | 수집 성공/실패, 최신 데이터 기준일, 누락 여부 | 화면 또는 운영 로그에서 확인 |

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

| 데이터 | 제공기관 | 용도 | 갱신/특징 | MVP 판단 |
|---|---|---|---|---|
| 현재전력수급현황조회 | 한국전력거래소 | 전력수급 상황판 | 실시간, 5분 단위 조회 | P0 운영 데이터 |
| 지역별 시간별 태양광 발전량 정보 | 한국전력거래소 | 태양광 발전량 화면, 예측 label | 실시간, 개발계정 트래픽 100 | P0 운영 데이터 |
| REC 현물시장 정보 | 한국전력거래소 | REC 가격 조회, 수익 계산 | 실시간, 개발계정 트래픽 100 | P0 운영 데이터 |
| SMP 대체 소스 | 한국전력거래소 | SMP 가격 조회, 수익 계산 | 기존 `계통한계가격조회` API 삭제 예정 안내. 권장 대체 API 또는 일별 파일 데이터 검증 필요 | P0 검증 게이트 |
| 기상청 단기예보 조회서비스 | 기상청 | 예측 feature | 격자 기반 예보 | P1 예측 데이터 |
| 천리안위성 2A호 AI 기반 일사량 | 기상청 | 일사량 feature | 2023-06-26 06UTC 이후 30분 간격 생산 | P1 예측 데이터 |

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
| 실시간 API 개발계정 트래픽 100 제한 | 높음 | 수집 주기 제한, 캐시, 운영계정 신청 조건 확인 |
| SMP 기존 API 삭제 예정 | 높음 | 1주차에 대체 API/파일 소스 확정 전까지 SMP 기능 완료로 보지 않음 |
| 연간 파일 데이터의 최신성 부족 | 중간 | 히스토리 분석과 학습용으로만 사용 |
| 발전량 집계 범위의 한계 | 높음 | "전력시장 참여 발전기 기준" 표시, 실제 발전소 정산값으로 사용 금지 |
| ESS 충방전량 혼입 | 중간 | 심야 태양광 발전량 이상치를 품질검사 대상으로 표시 |
| 기상청 격자와 KPX 지역 불일치 | 중간 | 시도 대표 격자 매핑으로 시작, 좌표 기반 확장은 2차 |
| 일사량 데이터 UTC 기준 | 중간 | UTC 원본시각과 KST 변환시각을 함께 저장 |

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
| Frontend | Next.js, React, TypeScript | 대시보드와 API 연동 생산성 |
| UI | Ant Design 또는 TailwindCSS | 표, 필터, 카드, 차트 구현 |
| Chart | ECharts 또는 Highcharts | 시계열/지역 비교에 적합 |
| Backend API | FastAPI 또는 NestJS | 팀 역량에 따라 선택. Python ETL/ML과 붙이면 FastAPI가 단순 |
| Data Pipeline | Python, Pandas, SQLAlchemy | API 수집, 파일 정제, baseline 모델 |
| Scheduler | cron 또는 GitHub Actions | MVP 단계에서는 충분 |
| DB | PostgreSQL | TimescaleDB는 데이터량과 조회 패턴 확인 후 도입 |
| ML | scikit-learn | baseline 이후 LightGBM/XGBoost 검토 |
| Storage | Local object directory, 이후 S3-compatible | 원본 CSV/JSON 저장 |
| Infra | Docker Compose | 로컬/서버 배포 일관성 |

### 7.2 스택 결정 기준

- 팀이 JS/TS에 강하면 `Next.js + NestJS + Python ETL`로 간다.
- 팀이 데이터/ML 중심이면 `Next.js + FastAPI + Python ETL`이 단순하다.
- MVP에서는 Airflow를 도입하지 않는다. 배치 수가 늘고 재시도/의존성이 복잡해질 때 Prefect 또는 Airflow-lite를 검토한다.
- TimescaleDB는 처음부터 필수로 두지 않는다. PostgreSQL 파티션/인덱스로 시작하고 병목이 확인되면 도입한다.

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

## 9. DB 설계 초안

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
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  object_path TEXT NOT NULL,
  content_type TEXT,
  content_hash TEXT,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
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
  lat NUMERIC,
  lon NUMERIC,
  sido_name TEXT,
  sigungu_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

초기에는 시도 대표 격자를 수동 정의한다. 이후 실제 발전소 좌표 또는 시군구 단위로 확장한다.

### 9.3 발전량 테이블

```sql
CREATE TABLE generation_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  source_date DATE NOT NULL,
  source_hour INTEGER NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  fuel_type TEXT NOT NULL,
  generation_mwh NUMERIC NOT NULL,
  includes_ess BOOLEAN,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (interval_start_at, region_code, fuel_type, datasource_id)
);
```

### 9.4 기상/일사량 테이블

```sql
CREATE TABLE weather_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  base_at TIMESTAMPTZ NOT NULL,
  forecast_at TIMESTAMPTZ NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  temperature_c NUMERIC,
  humidity_pct NUMERIC,
  precipitation_mm NUMERIC,
  precipitation_prob_pct NUMERIC,
  wind_speed_ms NUMERIC,
  sky_code TEXT,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (base_at, forecast_at, region_code, datasource_id)
);

CREATE TABLE solar_irradiance_hourly (
  id BIGSERIAL PRIMARY KEY,
  observed_at_utc TIMESTAMPTZ NOT NULL,
  observed_at_kst TIMESTAMPTZ NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  irradiance_value NUMERIC,
  irradiance_unit TEXT,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (observed_at_utc, region_code, datasource_id)
);
```

### 9.5 가격/시장 테이블

```sql
CREATE TABLE smp_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  source_date DATE NOT NULL,
  source_hour INTEGER NOT NULL,
  market_area TEXT NOT NULL,
  smp_krw_per_kwh NUMERIC NOT NULL,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (interval_start_at, market_area, datasource_id)
);

CREATE TABLE rec_market_daily (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  market_area TEXT,
  trade_count INTEGER,
  volume_rec NUMERIC,
  avg_price_krw_per_rec NUMERIC,
  high_price_krw_per_rec NUMERIC,
  low_price_krw_per_rec NUMERIC,
  close_price_krw_per_rec NUMERIC,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (trade_date, market_area, datasource_id)
);
```

### 9.6 전력수급/수요 테이블

```sql
CREATE TABLE supply_realtime (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL,
  supply_ability_mw NUMERIC,
  current_demand_mw NUMERIC,
  forecast_load_mw NUMERIC,
  reserve_power_mw NUMERIC,
  reserve_rate_pct NUMERIC,
  operating_reserve_power_mw NUMERIC,
  operating_reserve_rate_pct NUMERIC,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (observed_at, datasource_id)
);

CREATE TABLE demand_hourly (
  id BIGSERIAL PRIMARY KEY,
  interval_start_at TIMESTAMPTZ NOT NULL,
  interval_end_at TIMESTAMPTZ NOT NULL,
  demand_mwh NUMERIC NOT NULL,
  datasource_id INTEGER NOT NULL REFERENCES datasource(id),
  ingestion_run_id BIGINT REFERENCES ingestion_run(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (interval_start_at, datasource_id)
);
```

### 9.7 예측 결과 테이블

```sql
CREATE TABLE generation_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  forecast_run_at TIMESTAMPTZ NOT NULL,
  target_at TIMESTAMPTZ NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  fuel_type TEXT NOT NULL,
  predicted_generation_mwh NUMERIC NOT NULL,
  actual_generation_mwh NUMERIC,
  model_name TEXT NOT NULL,
  model_version TEXT,
  feature_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (forecast_run_at, target_at, region_code, fuel_type, model_name)
);
```

## 10. API 설계 초안

```text
GET  /api/health
GET  /api/datasources/status

GET  /api/supply/current
GET  /api/supply/history?from=&to=

GET  /api/generation/hourly?region=&fuelType=&from=&to=
GET  /api/generation/summary?region=&fuelType=&period=

GET  /api/market/smp/hourly?area=&from=&to=
GET  /api/market/rec/daily?area=&from=&to=

GET  /api/weather/forecast?region=&from=&to=
GET  /api/forecast/solar?region=&date=

POST /api/simulator/revenue
POST /api/report/monthly
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

### 13.1 기본 공식

```text
예상 발전량(kWh) = 설비용량(kW) × 추정 이용시간(h)
SMP 수익 = 시간별 발전량(kWh) × 시간별 SMP(원/kWh)
REC 발급량 = 발전량(MWh) × REC 가중치
REC 수익 = REC 발급량 × REC 가격(원/REC)
중개 수수료 = (SMP 수익 + REC 수익) × 수수료율
예상 총수익 = SMP 수익 + REC 수익 - 중개 수수료
```

### 13.2 발전량 산정 방식

MVP에서는 아래 방식 중 하나를 선택할 수 있게 설계한다.

| 방식 | 설명 | 권장도 |
|---|---|---:|
| user_input_generation | 사용자가 예상 발전량을 직접 입력 | 높음 |
| regional_profile_scaled | 지역 발전량 패턴을 설비용량 기준으로 정규화해 추정 | 중간 |
| fixed_capacity_factor | 사용자가 입력한 이용률/이용시간으로 추정 | 높음 |

`regional_profile_scaled`는 지역 총 발전량을 단순히 설비용량으로 나누는 방식이 아니어야 한다. 지역별 누적 설비용량 데이터가 없으면 "시뮬레이션용 패턴"으로만 표시한다.

### 13.3 주의사항

- 결과는 법적 정산금액이 아니라 시뮬레이션 결과다.
- 실제 정산은 계약조건, 계량값, REC 계약, 세금, 수수료, 정산 규칙에 따라 달라진다.
- REC 가중치는 발전원, 설치유형, 설비조건에 따라 달라지므로 사용자가 직접 입력한다.
- SMP는 육지/제주 구분이 필요하다.
- REC 가격은 평균가/종가/계약가 기준에 따라 결과가 달라진다.

## 14. 개발 일정

### 14.1 6주 MVP 일정

| 주차 | 목표 | 산출물 | 게이트 |
|---:|---|---|---|
| 1주차 | 데이터 소스 확정 및 환경 구성 | API 신청 목록, 응답 샘플, DB schema, Docker compose | SMP 대체 소스 확정 |
| 2주차 | P0 수집 파이프라인 구축 | 전력수급, 태양광, SMP, REC 적재 | 원본 저장/중복 방지 |
| 3주차 | 핵심 대시보드 구현 | 전력수급 화면, 발전량·가격 화면 | 최신 기준시각 표시 |
| 4주차 | 수익 시뮬레이터 구현 | 계산 API, 화면, 면책 문구 | 샘플 시나리오 검증 |
| 5주차 | 예측 데모와 리포트 초안 | baseline 예측, 오차율, Markdown 리포트 | 1개 지역 이상 |
| 6주차 | QA 및 고객 인터뷰 준비 | 데모 시나리오, 인터뷰 질문지, PoC 제안서 초안 | 내부 데모 통과 |

### 14.2 1주차 상세 태스크

- 공공데이터 API 활용신청
- 데이터 소스별 응답 샘플 저장
- SMP 대체 API 또는 파일 소스 확정
- 개발계정 트래픽 제한 확인
- DB schema 초안 작성
- 지역명/지역코드 매핑 초안 작성
- Docker Compose 구성
- Frontend/Backend/ETL repository 구조 결정

### 14.3 2주차 상세 태스크

- 현재전력수급현황 수집
- 지역별 태양광 발전량 수집
- SMP 데이터 수집
- REC 데이터 수집
- raw/staging/mart 구조 구현
- ingestion_run/raw_object/data_quality_check 기록
- 중복 적재 방지

### 14.4 3주차 상세 태스크

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

### 15.3 수익 시뮬레이터

- 사용자가 설비용량, REC 가중치, 수수료율, 기간을 입력할 수 있다.
- SMP 수익, REC 수익, 총 예상수익을 계산한다.
- 계산 가정과 면책 문구가 표시된다.
- 동일 입력에 대해 재현 가능한 결과가 나온다.

### 15.4 예측 데모

- 최소 1개 지역 이상 예측값을 생성한다.
- 실제값과 비교해 MAE 또는 MAPE를 표시한다.
- 모델 버전과 실행일시가 저장된다.
- 예측 결과가 "개별 발전소 예측이 아님"을 명시한다.

### 15.5 리포트

- 월간 요약 리포트를 생성할 수 있다.
- 발전량 그래프, SMP/REC 요약, 수익 시뮬레이션 결과가 포함된다.
- 데이터 한계와 계산 가정이 포함된다.

## 16. 의사결정 필요사항

1. 초기 타깃을 태양광 O&M 업체로 확정할 것인가?
2. MVP를 무료 공개형 대시보드로 만들 것인가, 고객 미팅용 비공개 데모로 만들 것인가?
3. 기본 스택을 `Next.js + FastAPI + PostgreSQL + Python ETL`로 확정할 것인가?
4. 예측 기능을 1차 핵심 기능이 아니라 P1 데모 기능으로 둘 것인가?
5. 고객 인터뷰를 개발 전부터 병행할 것인가?
6. SMP 대체 소스가 늦어질 경우 수익 시뮬레이터를 REC/사용자 입력 가격 기반으로 먼저 열 것인가?

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

MVP 단계에서는 개인정보나 고객 영업정보를 다루지 않는 구조가 바람직하다. 고객 데이터 PoC로 넘어갈 경우 다음을 고려한다.

- 고객별 데이터 접근 권한 분리
- 발전소 위치/수익정보 보호
- 업로드 파일 암호화 저장
- API 키 관리
- 로그에 민감정보 미기록
- 백업 및 복구 정책
- 서비스 이용약관 및 데이터 처리 동의

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

## Appendix A. 1차 MVP 요약

```text
공공데이터 기반 MVP
= 전력수급 상황판
+ 지역별 태양광 발전량 분석
+ SMP/REC 가격 조회
+ 가상 설비 수익 시뮬레이터
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
