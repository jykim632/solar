# Part 2. 내부 공유용 문서

## 1. 프로젝트 요약

### 프로젝트명

**Solar Market Intelligence MVP**

### 목적

공공데이터를 활용해 전력수급, 지역별 태양광·풍력 발전량, SMP/REC 가격, 기상 기반 발전량 예측, 수익 시뮬레이션을 제공하는 대시보드를 만든다. 이를 통해 VPP 전체 사업이 아니라 **VPP 주변의 수익·예측·정산 자동화 SaaS 가능성**을 검증한다.

### 핵심 방향

처음부터 VPP 통합제어 플랫폼을 만들지 않는다.  
초기에는 **공공데이터 기반 분석 대시보드 → 고객 데이터 연동 PoC → 발전사업자/O&M용 리포팅 SaaS** 순서로 간다.

## 2. 왜 지금 검토하는가

- 재생에너지와 분산자원이 증가하면서 발전량 예측, 수익 분석, 정산 자동화의 필요성이 커질 가능성이 있다.
- 공공데이터포털에서 전력수급, 발전량, SMP, REC, 기상, 충전소 관련 데이터를 제공하고 있어 초기 데모 구축이 가능하다.
- 실제 VPP 사업은 무겁지만, 그 하위 모듈인 예측·리포팅·수익 시뮬레이션은 소규모 개발팀도 접근 가능하다.
- 공공데이터 MVP는 고객 데이터 확보 전 단계에서 포트폴리오와 PoC 제안 자료로 활용할 수 있다.

## 3. 만들 것

1. 전력수급 상황판
2. 지역별 태양광·풍력 발전량 분석
3. 기상 기반 지역별 태양광 발전량 예측
4. SMP·REC 가격 조회 및 추이 분석
5. 가상 설비용량 기반 수익 시뮬레이터
6. 샘플 월간 리포트 생성

## 4. 만들지 않을 것

1. 실제 VPP 입찰/거래
2. 전력거래소 연계 실거래
3. 발전소 인버터 실시간 제어
4. ESS 자동 충방전 제어
5. 전기차 충전기 출력 제어
6. 개별 발전소 실제 정산 확정
7. 법적·회계적 정산 대행

## 5. 공공데이터만으로 가능한 것과 불가능한 것

### 가능한 것

- 전국/지역 전력수급 분석
- 지역별 태양광·풍력 발전량 분석
- 기상 데이터 기반 지역 발전량 예측
- SMP·REC 기반 가상 수익 계산
- 지역/업종별 시장 분석
- 데모 리포트 생성

### 불가능하거나 제한적인 것

- 개별 발전소 정확한 발전량 예측
- 실제 발전소 고장탐지
- 개별 고객 정산 자동화
- ESS/충전기 자동제어
- 전력시장 실입찰

## 6. 1차 MVP 화면 구성

| 화면 | 목적 | 핵심 지표 |
|---|---|---|
| 전력수급 상황판 | 현재 계통 상황 확인 | 현재수요, 공급능력, 예비력, 예비율 |
| 지역별 발전량 분석 | 재생에너지 발전 패턴 확인 | 지역, 시간, 연료원, 발전량 |
| 발전량 예측 | 내일/오늘 지역 발전량 예측 | 예측 발전량, 실제 발전량, 오차율 |
| 수익 시뮬레이터 | 발전사업 수익성 가정 계산 | SMP 수익, REC 수익, 총 예상수익 |
| 리포트 | 고객 미팅용 자료 | 월간 요약, 그래프, 수익 계산 |

## 7. 예상 일정

| 주차 | 목표 |
|---:|---|
| 1주차 | 데이터 소스 확정, API 신청, DB 설계 |
| 2주차 | 전력수급/발전량/SMP/REC 수집 파이프라인 구축 |
| 3주차 | 1차 대시보드 구현 |
| 4주차 | 발전량 예측 baseline 모델 구현 |
| 5주차 | 수익 시뮬레이터 및 리포트 생성 기능 구현 |
| 6주차 | 테스트, 데모 정리, 고객 인터뷰 자료 작성 |

## 8. 의사결정 필요사항

1. 초기 타깃을 태양광 O&M 업체로 둘 것인가?
2. MVP를 무료 공개형 대시보드로 만들 것인가, 고객 미팅용 비공개 데모로 만들 것인가?
3. 개발 스택을 Next.js + API 서버 + PostgreSQL/TimescaleDB + Python ETL 구조로 확정할 것인가?
4. 예측 기능을 1차 핵심으로 둘 것인가, 수익/리포팅 기능을 핵심으로 둘 것인가?
5. 고객 인터뷰를 개발 전 병행할 것인가, 데모 후 진행할 것인가?

## 9. 내부 공유용 핵심 메시지

> 이 프로젝트는 VPP 전체를 만드는 것이 아니다. 공공데이터로 가능한 전력시장·태양광 발전량·가격·수익 분석 MVP를 먼저 만들고, 고객 데이터 연동 가능성을 검증하는 프로젝트다. 최종 사업화 방향은 “태양광 발전사업자/O&M 업체용 수익·정산·예측 리포팅 SaaS”로 좁혀서 검토한다.

---

# Part 3. 개발계획서

## 1. 개발 목표

6주 이내에 공공데이터 기반 MVP를 구현한다.

### 1.1 1차 산출물

- 웹 대시보드
- 공공데이터 수집 배치
- 정규화 DB
- 지역별 태양광 발전량 예측 baseline 모델
- SMP/REC 수익 시뮬레이터
- 샘플 리포트 출력 기능

### 1.2 기술 목표

- 공공데이터 API/파일을 안정적으로 수집한다.
- 전력 데이터의 시간/지역/단위를 정규화한다.
- 대시보드에서 조회 가능한 mart 테이블을 구성한다.
- 예측 모델은 baseline → ML 모델 순으로 개선한다.
- 실제 고객 데이터 연동을 고려해 schema를 확장 가능하게 설계한다.

## 2. 권장 기술 스택

| 영역 | 권장 기술 | 비고 |
|---|---|---|
| Frontend | Next.js, React, TypeScript | 대시보드 구현 |
| UI | Ant Design 또는 TailwindCSS | 표/필터/카드/차트 |
| Chart | Highcharts, ECharts, ApexCharts 중 택1 | 시계열/지역 비교 |
| Backend API | Spring Boot 또는 NestJS | 기존 역량에 맞춰 선택 |
| Data Pipeline | Python, Pandas, SQLAlchemy | API 수집/정제 |
| Scheduler | cron, GitHub Actions, Airflow-lite, Prefect 중 택1 | 초기에는 cron 충분 |
| DB | PostgreSQL + TimescaleDB | 시계열 데이터 저장 |
| ML | scikit-learn, LightGBM/XGBoost | baseline 이후 도입 |
| Storage | Local/S3-compatible object storage | 원본 CSV/JSON 저장 |
| Infra | Docker Compose | 로컬/서버 배포 |

## 3. 데이터 소스 목록

### 3.1 1순위 데이터

| 데이터 | 제공기관 | 형태 | 주요 필드 | 용도 |
|---|---|---|---|---|
| 지역별 시간별 태양광 및 풍력 발전량 | 한국전력거래소 | CSV/API | 거래일자, 거래시간, 지역, 연료원, 발전량 | 발전량 분석, 예측 label |
| 지역별 시간별 태양광 발전량 정보 | 한국전력거래소 | API | 일자, 광역시/도, 거래시간, 발전량 | 태양광 발전량 조회 |
| 기상청 단기예보 조회서비스 | 기상청 | API | 기온, 강수, 하늘상태, 습도, 풍속 등 | 발전량 예측 feature |
| 천리안위성 2A호 AI 기반 일사량 | 기상청 | API | 일사량/태양복사량 | 태양광 예측 핵심 feature |
| 계통한계가격/SMP | 한국전력거래소 | API/CSV | 시간, SMP(육지), SMP(제주) | 수익 계산 |
| REC 현물시장 정보 | 한국전력거래소 | API/파일 | 거래량, 평균가, 최고가, 최저가, 종가 | REC 수익 계산 |
| 현재전력수급현황 | 한국전력거래소 | API | 공급능력, 현재수요, 예비력, 예비율 | 전력수급 상황판 |
| 시간별 전국 전력수요량 | 한국전력거래소 | CSV/API | 날짜, 24시간 전력수요 | 수요 패턴 분석 |

### 3.2 2순위 데이터

| 데이터 | 제공기관 | 용도 |
|---|---|---|
| 산업분류별 전력사용량 | 한국전력공사 | 업종/지역별 시장 분석 |
| 산업분류별 법정동별 전력사용량 | 한국전력공사 | 세부 지역 타깃 분석 |
| 업종별 전력사용량 | 한국전력공사 | 업종별 수요 특성 분석 |
| 전기자동차 충전소 정보 | 한국환경공단 | 충전소 위치/상태 분석 |
| 전국전기차충전소표준데이터 | 공공데이터포털 | 충전 인프라 지도 |

## 4. 데이터 수집 전략

### 4.1 원칙

1. 원본 데이터는 반드시 저장한다.
2. API 응답과 정제 테이블을 분리한다.
3. 시간대는 KST 기준으로 통일한다.
4. 거래시간의 의미를 별도 문서화한다.
5. 지역명은 표준 region_code로 통일한다.
6. 단위는 MW, MWh, 원/kWh, 원/REC를 명확히 구분한다.
7. API 변경 가능성에 대비해 datasource별 adapter를 분리한다.

### 4.2 데이터 레이어

```text
raw      : 원본 API 응답/CSV 저장
staging  : 타입 변환, 컬럼명 정규화, 중복 제거
mart     : 화면/API 조회 최적화 테이블
model    : 예측 모델 학습/추론용 feature table
```

### 4.3 지역 매핑

전력거래소 데이터의 지역 단위와 기상청 격자 단위가 다르므로 지역 매핑 테이블이 필요하다.

```text
region_code
region_name
kpx_region_name
kma_grid_x
kma_grid_y
lat
lon
sido_name
sigungu_name
```

초기에는 시도 대표 격자를 수동으로 정의하고, 이후 시군구/발전소 좌표 기반으로 확장한다.

## 5. 데이터베이스 설계 초안

### 5.1 공통 테이블

```sql
CREATE TABLE datasource (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL,
  update_cycle TEXT,
  url TEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE region (
  region_code TEXT PRIMARY KEY,
  region_name TEXT NOT NULL,
  kpx_region_name TEXT,
  kma_grid_x INTEGER,
  kma_grid_y INTEGER,
  lat NUMERIC,
  lon NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);
```

### 5.2 발전량 테이블

```sql
CREATE TABLE generation_hourly (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  trade_hour INTEGER NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  fuel_type TEXT NOT NULL,
  generation_mwh NUMERIC NOT NULL,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (trade_date, trade_hour, region_code, fuel_type, datasource_id)
);
```

### 5.3 기상 테이블

```sql
CREATE TABLE weather_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  base_datetime TIMESTAMP NOT NULL,
  forecast_datetime TIMESTAMP NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  temperature_c NUMERIC,
  humidity_pct NUMERIC,
  precipitation_mm NUMERIC,
  precipitation_prob_pct NUMERIC,
  wind_speed_ms NUMERIC,
  sky_code TEXT,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (base_datetime, forecast_datetime, region_code, datasource_id)
);

CREATE TABLE solar_irradiance_hourly (
  id BIGSERIAL PRIMARY KEY,
  observed_datetime TIMESTAMP NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  irradiance NUMERIC,
  unit TEXT,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (observed_datetime, region_code, datasource_id)
);
```

### 5.4 가격/시장 테이블

```sql
CREATE TABLE smp_hourly (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  trade_hour INTEGER NOT NULL,
  market_area TEXT NOT NULL,
  smp_krw_per_kwh NUMERIC NOT NULL,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (trade_date, trade_hour, market_area, datasource_id)
);

CREATE TABLE rec_market_daily (
  id BIGSERIAL PRIMARY KEY,
  trade_date DATE NOT NULL,
  market_area TEXT,
  volume_rec NUMERIC,
  avg_price_krw_per_rec NUMERIC,
  high_price_krw_per_rec NUMERIC,
  low_price_krw_per_rec NUMERIC,
  close_price_krw_per_rec NUMERIC,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (trade_date, market_area, datasource_id)
);
```

### 5.5 전력수급/수요 테이블

```sql
CREATE TABLE supply_realtime (
  id BIGSERIAL PRIMARY KEY,
  base_datetime TIMESTAMP NOT NULL,
  supply_ability_mw NUMERIC,
  current_demand_mw NUMERIC,
  forecast_load_mw NUMERIC,
  reserve_power_mw NUMERIC,
  reserve_rate_pct NUMERIC,
  operating_reserve_power_mw NUMERIC,
  operating_reserve_rate_pct NUMERIC,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (base_datetime, datasource_id)
);

CREATE TABLE demand_hourly (
  id BIGSERIAL PRIMARY KEY,
  demand_date DATE NOT NULL,
  demand_hour INTEGER NOT NULL,
  demand_mwh NUMERIC NOT NULL,
  datasource_id INTEGER REFERENCES datasource(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (demand_date, demand_hour, datasource_id)
);
```

### 5.6 예측 결과 테이블

```sql
CREATE TABLE generation_forecast_hourly (
  id BIGSERIAL PRIMARY KEY,
  forecast_run_datetime TIMESTAMP NOT NULL,
  target_datetime TIMESTAMP NOT NULL,
  region_code TEXT REFERENCES region(region_code),
  fuel_type TEXT NOT NULL,
  predicted_generation_mwh NUMERIC NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (forecast_run_datetime, target_datetime, region_code, fuel_type, model_name)
);
```

## 6. API 설계 초안

```text
GET /api/supply/current
GET /api/supply/history?from=&to=
GET /api/demand/hourly?from=&to=
GET /api/generation/hourly?region=&fuelType=&from=&to=
GET /api/generation/summary?region=&fuelType=&period=
GET /api/weather/forecast?region=&from=&to=
GET /api/smp/hourly?area=&from=&to=
GET /api/rec/daily?area=&from=&to=
GET /api/forecast/solar?region=&date=
POST /api/simulator/revenue
POST /api/report/monthly
```

### 6.1 수익 시뮬레이터 요청 예시

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
  "generationSource": "regional_average"
}
```

### 6.2 수익 시뮬레이터 응답 예시

```json
{
  "estimatedSmpRevenue": 12300000,
  "estimatedRecRevenue": 8700000,
  "brokerageFee": 630000,
  "estimatedTotalRevenue": 20370000,
  "assumptions": {
    "smpSource": "KPX",
    "recSource": "KPX_REC_SPOT",
    "generationSource": "regional_average_scaled_by_capacity"
  }
}
```

## 7. 화면 설계

### 7.1 화면 A: 전력수급 상황판

#### 목적

현재 전력계통 상황을 빠르게 확인한다.

#### 핵심 컴포넌트

- 현재수요 카드
- 공급능력 카드
- 공급예비력 카드
- 공급예비율 카드
- 최근 24시간 수요 그래프
- 수급예보 테이블

#### 주요 데이터

- 현재전력수급현황
- 시간별 전국 전력수요량
- 전력수급예보

### 7.2 화면 B: 지역별 태양광·풍력 발전량

#### 목적

지역별 재생에너지 발전량 패턴을 확인한다.

#### 핵심 컴포넌트

- 지역 선택 필터
- 연료원 선택 필터
- 시간대별 발전량 그래프
- 지역별 발전량 순위
- 전일/전주/전년 동월 대비 변화율

#### 주요 데이터

- 지역별 시간별 태양광 및 풍력 발전량
- 지역별 시간별 태양광 발전량 정보

### 7.3 화면 C: 태양광 발전량 예측

#### 목적

기상 데이터와 과거 발전량을 기반으로 지역 단위 태양광 발전량을 예측한다.

#### 핵심 컴포넌트

- 지역 선택
- 날짜 선택
- 예측 발전량 그래프
- 실제 발전량과 비교
- 오차율 표시
- 날씨 요인 표시

#### 주요 데이터

- 지역별 태양광 발전량
- 기상청 단기예보
- 천리안위성 2A호 일사량

### 7.4 화면 D: SMP·REC 수익 시뮬레이터

#### 목적

가상 발전소 기준으로 예상 수익을 계산한다.

#### 입력값

- 지역
- 설비용량 kW
- REC 가중치
- 중개 수수료율
- 기간
- 발전량 산정 방식

#### 출력값

- 예상 발전량
- SMP 수익
- REC 수익
- 중개 수수료
- 총 예상 수익
- 월별/일별 추이

### 7.5 화면 E: 월간 리포트

#### 목적

고객 미팅 또는 내부 공유용 리포트를 자동 생성한다.

#### 리포트 항목

- 월간 전력수급 요약
- 지역별 태양광 발전량 추이
- SMP/REC 가격 추이
- 가상 발전소 수익 시뮬레이션
- 예측 모델 성능 요약
- 데이터 한계 및 가정

## 8. 예측 모델 계획

### 8.1 1차 baseline 모델

복잡한 딥러닝 모델보다 baseline부터 시작한다.

#### 방법

```text
예측값 = 같은 지역의 최근 7일 동일 시간대 평균 발전량
       + 요일 보정
       + 월/계절 보정
       + 날씨 보정 계수
```

### 8.2 2차 ML 모델

baseline 이후 LightGBM 또는 XGBoost를 도입한다.

#### Feature 후보

| 분류 | Feature |
|---|---|
| 시간 | hour, day_of_week, month, holiday 여부 |
| 지역 | region_code, 위도, 경도 |
| 과거 발전량 | 전일 동일시간, 7일 평균, 30일 평균 |
| 기상 | 기온, 습도, 강수량, 강수확률, 풍속, 하늘상태 |
| 일사량 | 위성 기반 일사량 |
| 시장/계통 | 전국 전력수요, 수급상태 |

#### Target

```text
region_code + target_datetime 기준 태양광 발전량 MWh
```

### 8.3 평가 지표

| 지표 | 설명 |
|---|---|
| MAE | 평균 절대 오차 |
| RMSE | 큰 오차에 민감한 지표 |
| MAPE | 비율 기반 오차, 단 발전량 0 근처에서 주의 |
| 시간대별 오차율 | 오전/정오/오후별 성능 확인 |
| 날씨별 오차율 | 맑음/흐림/강수 조건별 성능 확인 |
| 지역별 오차율 | 지역별 모델 성능 차이 확인 |

### 8.4 예측 기능의 주의점

- 공공데이터의 발전량은 지역 집계 단위이므로 개별 발전소 예측과 다르다.
- 기상청 격자와 KPX 지역 단위의 매핑 오차가 존재한다.
- 태양광 발전량에는 설비용량 증가 효과가 섞여 있을 수 있다.
- 장기 시계열 비교 시 설비 보급량 변화에 대한 보정이 필요하다.

## 9. 수익 계산 로직

### 9.1 기본 공식

```text
SMP 수익 = 시간별 발전량(kWh) × 시간별 SMP(원/kWh)
REC 발급량 = 발전량(MWh) × REC 가중치
REC 수익 = REC 발급량 × REC 평균가(원/REC)
중개 수수료 = (SMP 수익 + REC 수익) × 수수료율
예상 총수익 = SMP 수익 + REC 수익 - 중개 수수료
```

### 9.2 주의사항

- 실제 정산은 계약조건, 정산 규칙, REC 계약, 세금, 중개 수수료 등에 따라 달라질 수 있다.
- 공공데이터 기반 결과는 법적 정산금액이 아니라 시뮬레이션 결과로 표시해야 한다.
- REC 가중치는 발전원, 설치유형, 설비조건에 따라 달라지므로 사용자가 직접 입력하도록 한다.
- SMP는 육지/제주 구분이 필요하다.

## 10. 개발 일정

### 10.1 6주 MVP 일정

| 주차 | 목표 | 산출물 |
|---:|---|---|
| 1주차 | 데이터 소스 확정 및 환경 구성 | API 신청 목록, DB schema, Docker compose |
| 2주차 | 데이터 수집 파이프라인 구축 | 발전량, SMP, REC, 수급 데이터 적재 |
| 3주차 | 대시보드 1차 구현 | 전력수급/발전량/SMP·REC 화면 |
| 4주차 | 기상 데이터 연동 및 예측 baseline | 예측 테이블, 오차율 계산 |
| 5주차 | 수익 시뮬레이터 및 리포트 | 수익 계산 API, 리포트 초안 |
| 6주차 | QA 및 고객 인터뷰 준비 | 데모 시나리오, 인터뷰 질문지, 발표자료 |

### 10.2 주차별 상세 태스크

#### 1주차

- 공공데이터 API 활용신청
- 데이터 소스별 응답 샘플 수집
- DB schema 초안 작성
- 지역명/지역코드 매핑 초안 작성
- Docker Compose 구성
- Frontend/Backend/ETL repository 구성

#### 2주차

- KPX 발전량 데이터 수집
- SMP 데이터 수집
- REC 데이터 수집
- 현재전력수급현황 수집
- 시간별 전력수요량 적재
- raw/staging/mart 구조 구현

#### 3주차

- 전력수급 상황판 구현
- 지역별 발전량 그래프 구현
- SMP/REC 가격 그래프 구현
- 필터: 기간, 지역, 연료원
- 기본 에러/로딩 처리

#### 4주차

- 기상청 단기예보 연동
- 일사량 데이터 연동
- 지역-기상격자 매핑
- baseline 예측 모델 구현
- 실제값 vs 예측값 비교
- MAE/MAPE 계산

#### 5주차

- 수익 시뮬레이터 API 구현
- 수익 시뮬레이터 화면 구현
- 가정/주의사항 표시
- 월간 리포트 Markdown/PDF 생성 초안
- 샘플 데이터 기반 시나리오 작성

#### 6주차

- 데이터 누락/중복 QA
- 예측 성능 리포트 작성
- 고객 인터뷰용 데모 흐름 작성
- 내부 공유 문서 업데이트
- PoC 제안서 초안 작성

## 11. Definition of Done

### 11.1 데이터 수집

- 최소 6개 데이터 소스를 적재한다.
- 원본과 정제 데이터를 분리한다.
- 수집 실패 로그가 남는다.
- 중복 적재가 방지된다.

### 11.2 대시보드

- 기간/지역/연료원 필터가 동작한다.
- 시계열 그래프가 정상 렌더링된다.
- 최근 데이터 기준일이 표시된다.
- 데이터 한계가 화면에 표시된다.

### 11.3 예측 모델

- 최소 1개 지역 이상 예측값을 생성한다.
- 실제값과 비교하여 오차율을 표시한다.
- 모델 버전과 실행일시가 저장된다.

### 11.4 수익 시뮬레이터

- 사용자가 설비용량, REC 가중치, 수수료율을 입력할 수 있다.
- SMP 수익, REC 수익, 총 예상수익을 계산한다.
- 계산 가정과 면책 문구가 표시된다.

### 11.5 리포트

- 월간 요약 리포트를 생성할 수 있다.
- 최소 발전량 그래프, SMP/REC 요약, 수익 시뮬레이션 결과가 포함된다.

## 12. MVP 백로그

### 12.1 Must Have

- 공공데이터 수집 배치
- 지역별 발전량 조회
- SMP/REC 조회
- 전력수급 상황판
- 수익 시뮬레이터
- baseline 발전량 예측

### 12.2 Should Have

- 월간 리포트 생성
- 예측 오차 분석
- 지역 평균 비교
- 데이터 최신성 표시
- API 실패 알림

### 12.3 Could Have

- 영업 타깃 지도
- 전기차 충전소 위치 분석
- 산업분류별 전력사용량 분석
- CSV 업로드 기반 발전소별 수익 계산
- PDF 다운로드

### 12.4 Won’t Have, MVP 단계 제외

- 인버터 연동
- 실시간 장비 제어
- ESS 충방전 스케줄링
- 전기차 충전기 출력 제어
- 실제 전력시장 입찰

## 13. 고객 데이터 연동 시 확장 계획

공공데이터 MVP 이후 가장 먼저 붙일 고객 데이터는 **발전량 CSV 업로드**다.

### 13.1 고객 데이터 1단계

| 데이터 | 예시 | 활용 |
|---|---|---|
| 발전소 정보 | 위치, 설비용량, 준공일 | 지역 평균 비교, 수익 계산 |
| 시간별/일별 발전량 | CSV/Excel | 실제 수익 계산, 이상탐지 |
| 계약조건 | 수수료율, REC 계약 여부 | 실제 리포트 계산 |
| 정산내역 | 월별 입금액 | 예상값 vs 실제값 비교 |

### 13.2 고객 데이터 2단계

| 데이터 | 예시 | 활용 |
|---|---|---|
| 인버터 데이터 | 출력, 장애코드, 상태 | 실시간 모니터링, 고장탐지 |
| 계량기 데이터 | 시간대별 계량값 | 정산 자동화 |
| 유지보수 이력 | 점검일, 교체 이력 | 성능 저하 원인 분석 |
| 패널 정보 | 방향, 경사각, 모듈 종류 | 개별 발전소 예측 정확도 개선 |

## 14. 보안 및 운영 고려사항

MVP 단계에서는 개인정보나 고객 영업정보를 다루지 않는 구조가 바람직하다. 고객 데이터 PoC로 넘어갈 경우 다음을 고려한다.

- 고객별 데이터 접근 권한 분리
- 발전소 위치/수익정보 보호
- 업로드 파일 암호화 저장
- API 키 관리
- 로그에 민감정보 미기록
- 백업 및 복구 정책
- 서비스 이용약관 및 데이터 처리 동의

## 15. 참고 데이터 출처

아래는 본 계획서 작성 시 검토한 대표 공공데이터다. 실제 개발 전 각 데이터의 최신 API 명세, 활용신청 조건, 이용허락범위, 업데이트 주기를 다시 확인해야 한다.

1. 한국전력거래소_지역별 시간별 태양광 및 풍력 발전량  
   https://www.data.go.kr/data/15065269/fileData.do

2. 한국전력거래소_지역별 시간별 태양광 발전량 정보  
   https://www.data.go.kr/data/15103243/openapi.do

3. 기상청_단기예보 조회서비스  
   https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15084084

4. 기상청_천리안위성 2A호 인공지능 기반 일사량 조회서비스  
   https://www.data.go.kr/data/15139479/openapi.do

5. 한국전력거래소_계통한계가격조회  
   https://www.data.go.kr/data/15076302/openapi.do

6. 한국전력거래소_시간별 계통한계가격  
   https://www.data.go.kr/data/15086088/fileData.do

7. 한국전력거래소_REC 현물시장 정보  
   https://www.data.go.kr/data/15099762/openapi.do

8. 한국전력거래소_오늘의 REC 시장  
   https://www.data.go.kr/data/15090556/fileData.do

9. 한국전력거래소_현재전력수급현황조회  
   https://www.data.go.kr/data/15056640/openapi.do

10. 한국전력거래소_시간별 전국 전력수요량  
    https://www.data.go.kr/data/15065266/fileData.do

11. 한국전력공사_산업분류별 전력사용량  
    https://www.data.go.kr/data/15101309/fileData.do

12. 한국전력공사_산업분류별 법정동별 전력사용량  
    https://www.data.go.kr/data/15104908/fileData.do

13. 한국환경공단_전기자동차 충전소 정보  
    https://www.data.go.kr/data/15076352/openapi.do

14. 전국전기차충전소표준데이터  
    https://www.data.go.kr/data/15013115/standard.do

---

# Appendix A. 1차 MVP 요약

```text
공공데이터 기반 MVP
= 전력수급 상황판
+ 지역별 태양광·풍력 발전량 분석
+ 기상/일사량 기반 지역별 태양광 발전량 예측
+ SMP/REC 수익 시뮬레이터
+ 샘플 리포트 생성
```

# Appendix B. 향후 유료 SaaS 방향

```text
고객 데이터 연동 SaaS
= 발전량 CSV 업로드
+ 발전소별 수익/정산 리포트
+ 지역 평균 대비 성능 비교
+ 발전량 이상탐지
+ 예측 오차 분석
+ 고객별 월간 리포트 자동 발송
```

# Appendix C. 최종 판단

이 프로젝트는 “VPP 플랫폼”으로 시작하면 범위가 너무 크다.  
초기에는 **공공데이터 기반 분석 MVP**로 시작하고, 이후 고객 데이터가 붙는 순간부터 **태양광 발전사업자/O&M 업체용 수익·정산·예측 리포팅 SaaS**로 발전시키는 것이 가장 현실적이다.

