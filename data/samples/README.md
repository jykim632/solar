# 데이터 소스 응답 샘플 (solar-8wv.4)

- 수집일: 2026-07-03 (활용신청 승인 후 실응답)
- 목적: 스키마·시간 베이스·단위 확정 근거 (§14.2), 지역명 매핑 검증 (solar-8wv.15)

## 상태 요약

| 소스 | endpoint | 상태 | 샘플 |
|---|---|---|---|
| 지역별 시간별 태양광 발전량 (15103243) | `apis.data.go.kr/B552115/PvAmountByLocHr` | ✅ 정상 | `pv-gen-20251231-full.json` |
| REC 현물시장 정보 (15099762) | `apis.data.go.kr/B552115/RecMarketInfo2` | ✅ 정상 | `rec-2026-07-03.json`, `rec-latest-2026-07-03.json` |
| 기상청 단기예보 (15084084) | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` | ✅ 정상 | `fcst-ultra-ncst-2026-07-03.json` |
| 위성 AI 일사량 (API허브 산업특화) | `apihub.kma.go.kr/api/typ01/cgi-bin/url/nph_sun_sat_ana_txt` | ✅ 정상 | `solar-irradiance-point-2026-07-03.txt` |
| 현재전력수급현황 (15056640) | `openapi.kpx.or.kr/openapi/sukub5mMaxDatetime` | ⚠️ **resultCode 20 ACCESS DENIED** | `supply-realtime-2026-07-03.error.xml` |
| 계통한계가격조회 (15076302, 삭제예정) | — | 미신청 (§5.5 대체 대상) | — |

## 실응답으로 확정된 사실 (adapter 설계 반영)

### 태양광 발전량 getPvAmountByLocHr

- **tradeNo는 1~24 베이스** (0~23 아님) — §6.1 interval 변환 시 `interval_start = tradeNo - 1`시
- **regionNm 실문자열 17종** (swagger 문서와 달리 축약 아님):
  `서울시 부산시 대구시 인천시 광주시 대전시 울산시 세종시`(광역·특별) + `경기도 강원도 충청북도 충청남도 전라북도 전라남도 경상북도 경상남도 제주도`
  — **'강원특별자치도'/'전북특별자치도' 아닌 구명칭**. seed 반영 완료.
- 전국 합계 row 없음. 세종 독립 row 있음. 17지역 × 24시간 = 일 408 rows.
- `amgo` 소수 6자리 (MWh로 추정 — §6.2 단위 표기 재확인 권장)
- **데이터 lag 큼**: 2026-07-03 기준 전체 지역은 4/30까지, 5/31은 제주만, 6월 없음
  → 월 단위 갱신으로 추정. **대시보드 '데이터 기준시점' 표시 필수**(§15), 실시간 아님.
- tradeYmd 생략 시 2021-01-01부터 전체(80만+ rows) 페이지네이션.

### REC 현물시장 getRecMarketInfo2

- `bzDd` 필터 동작. 2017-05-30부터 총 904건(개장일만 — 화/목 패턴).
- 최신(2026-07-02): `clsPrc=71500` = `landLwPrc`와 일치, `jejuAvgPrc=86185` 별도
  → **clsPrc는 육지 기준 종가로 보임**. §6.3 '종가 통합값' 해석 재검토 필요 —
  제주 가격은 jeju* 필드로 별도 저장 권장.
- 단위 원/REC. 육지/제주 각각 고가/저가/평균/상하한/물량/건수 필드 완비.

### 기상청 단기예보 getUltraSrtNcst

- 정상 동작. nx/ny(region seed 격자)로 조회, 카테고리 8종(PTY/REH/RN1/T1H/UUU/VEC/VVV/WSD).
- 초단기실황은 일사량 없음 — 일사량은 위성 API 사용(아래).

### 위성 AI 일사량 (산업특화 지점조회)

- 변수 `AI-DSR`, 30분 간격, **UTC 시간**, 단위 MJ/㎡.
- **요청당 최대 24슬롯 제한** → 하루치(48슬롯)는 2회 분할 호출.
- region seed의 시도 대표 lat/lon 그대로 사용 가능 (서울 검증).

### 현재전력수급현황 — 미해결

- 활용신청 승인 후에도 `resultCode 20 SERVICE ACCESS DENIED`.
- 401(미신청)과 다른 에러 — 포털 마이페이지에서 이 API 신청 건의 승인 상태
  (자동승인 vs 심사중) 확인 필요. 심사 대기일 가능성 큼.

## 재수집

```bash
set -a; source .env; set +a
node scripts/fetch-samples.mjs
```

## 파일 목록

- `specs/swagger-pv-gen-15103243.json`, `specs/swagger-rec-15099762.json` — 포털 추출 스펙
- `pv-gen-20251231-full.json` — 하루치 전체 408 rows (지역 문자열·tradeNo 검증 근거)
- `pv-gen-2026-07-03.json` — 최신 조회 응답 (totalCount 0 — lag 증거)
- `rec-2026-07-03.json` / `rec-latest-2026-07-03.json` — 첫 페이지(2017) / 최신 페이지(2026-07)
- `fcst-ultra-ncst-2026-07-03.json` — 초단기실황 정상 응답
- `solar-irradiance-point-2026-07-03.txt` — 위성 AI 일사량 텍스트 응답
- `supply-realtime-2026-07-03.error.xml` — 수급현황 ACCESS DENIED (미해결)
