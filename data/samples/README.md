# 데이터 소스 응답 샘플 (solar-8wv.4)

- 수집 시도일: 2026-07-03
- 목적: 스키마·시간 베이스·단위 확정 근거 (§14.2), 지역명 매핑 검증 (solar-8wv.15)

## 상태 요약

| 소스 | endpoint | 인증 결과 | 비고 |
|---|---|---|---|
| 지역별 시간별 태양광 발전량 (15103243) | `apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr` | **401 Unauthorized** | 활용신청 필요 |
| REC 현물시장 정보 (15099762) | `apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2` | **401 Unauthorized** | 활용신청 필요 |
| 현재전력수급현황 (15056640) | `openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime` | **resultCode 30** (SERVICE KEY IS NOT REGISTERED) | 활용신청 필요 |
| 계통한계가격조회 (15076302, 삭제예정) | `openapi.kpx.or.kr/openapi/smp1hToday/getSmp1hToday` | **resultCode 30** | §5.5 — 어차피 대체 대상 |
| 기상청 단기예보 (15084084) | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0/*` | **401 Unauthorized** | 활용신청 필요 |
| 기상청 API허브 (KMA_API_KEY) | `apihub.kma.go.kr/api/typ01,typ02/*` | **403** "활용신청이 필요한 API" | API허브에서 API별 신청 필요 |

**결론: `.env`의 키 자체는 유효한 형식이나, 어떤 데이터셋에도 활용신청이 승인되어 있지 않다.**
`.env` 주석의 "already approved"는 사실과 다름 → **solar-8wv.3 (활용신청 D-14 선제출)이 실제 선행 조건.**

## 활용신청 필요 목록 (data.go.kr, 같은 계정에서 각각 신청)

1. 15103243 — 한국전력거래소_지역별 시간별 태양광 발전량 정보
2. 15099762 — 한국전력거래소_REC 현물시장 정보
3. 15056640 — 한국전력거래소_현재전력수급현황조회
4. 15084084 — 기상청_단기예보 조회서비스
5. (P1, 조건부) 15139479 — 기상청_천리안위성 2A호 일사량 → data.go.kr 페이지가 apihub.kma.go.kr(seqApi=971)로 redirect. **API허브에서 별도 신청** (KMA_API_KEY 계정)
6. (§5.5 1순위 후보) 한국전력거래소_계통한계가격 및 수요예측(하루전 발전계획용) — 포털에서 검색해 신청 가능 여부 자체를 확인해야 함

승인은 보통 자동(즉시)~2시간, 일부 기관 심사는 수일. 신청 후 이 문서의 스크립트로 재수집한다.

## 신청 승인 후 재수집 방법

```bash
set -a; source .env; set +a
node scripts/fetch-samples.mjs        # data/samples/*.json|xml 갱신
```

## swagger 스펙에서 확정된 사실 (포털 페이지 내장 spec 추출, specs/ 참조)

### 태양광 발전량 getPvAmountByLocHr

- 요청: `serviceKey, pageNo, numOfRows, dataType(xml/json), tradeYmd(YYYYMMDD, optional)`
- 응답 item: `tradeYmd`(거래일자), `tradeNo`(**거래시간**), `regionNm`(지역), `amgo`(발전량), `rn`(순번)
- **미확정(실응답 필요)**: `tradeNo`가 0–23인지 1–24인지 (§6.1 시간 정책), `amgo` 단위(MWh 추정), `regionNm` 실문자열(seed의 kpx_region_name 검증), 전국 합계 row 존재 여부, 세종 독립 row 여부

### REC 현물시장 getRecMarketInfo2

- 요청: `serviceKey, pageNo, numOfRows, dataType, bzDd(현물시장거래일, optional)`
- 응답 item: `bzDd`, `clsPrc`(**종가 — 통합값으로 보임**), 육지/제주 각각 `{land,jeju}{AvgPrc,HgPrc,LwPrc,UplmtPrc,LwlmtPrc,OrdRecValue,OrdCnt,TrdCnt,TrdRecValue}`, `totCnt`, `totRecValue`, `bidTrdVal`
- **계획서 §6.3 "REC 종가 통합값" 가정과 부합** — clsPrc가 육지/제주 공통 단일 종가인지 실응답으로 확인
- **미확정**: 가격 단위(원/REC), 개장일(화/목)만 데이터가 있는지

### 현재전력수급현황 getSukub5mMaxDatetime

- swagger 미내장 (구형 openapi.kpx.or.kr). 포털 문서 기준 응답: `baseDatetime`(YYYYMMDDHHmmss), `suppAbility`(공급능력 MW), `currPwrTot`(현재수요 MW), `forecastLoad`(최대예측수요 MW), `suppReservePwr/Rate`, `operReservePwr/Rate`
- XML 응답. 5분 단위 갱신 → worker의 slot_at 정규화 대상 (solar-2af.4)

### 기상청 단기예보 (VilageFcstInfoService_2.0)

- `apis.data.go.kr/1360000/VilageFcstInfoService_2.0/{getUltraSrtNcst,getUltraSrtFcst,getVilageFcst}`
- 요청: `serviceKey, pageNo, numOfRows, dataType, base_date, base_time, nx, ny` — region seed의 kma_grid_x/y와 정합
- 트래픽: 개발계정 10,000/일 (data.go.kr 표준)

## 파일 목록

- `specs/swagger-pv-gen-15103243.json` — 태양광 발전량 swagger (포털 추출)
- `specs/swagger-rec-15099762.json` — REC 현물시장 swagger (포털 추출)
- `kpx-supply-realtime.xml` — 수급현황 **에러 응답 샘플** (resultCode 30, 인증 실패 시 응답 구조 참고용)
- (승인 후) `pv-gen-*.json`, `rec-*.json`, `supply-*.xml`, `fcst-*.json` 추가 예정
