# AWS 인프라 비용 시뮬레이션 · 잠재 비용 보고서

- 작성일: 2026-07-02
- 기준: `developer_plan.md` v0.5 §1.3 인프라 확정안 (Lambda + EventBridge Scheduler + S3 + SSM + CloudFront, DB=Neon, 프론트=OpenNext on AWS/SST v3)
- 수집 주기 전제: **데모 기간 수급현황 15분** (Neon Free 유지), PoC부터 5분 복원 — §2.3
- 리전: ap-northeast-2 (서울)
- 환율 가정: 1 USD = 1,380 KRW (개산용)

> 이 문서는 견적이 아니라 **자릿수(order-of-magnitude) 확인용 시뮬레이션**이다. 실제 청구는 사용 패턴·프리티어 소진에 따라 달라진다. 가격 출처는 각 표에 명시.

## 1. 사용량 모델 (계획서에서 역산)

### 1.1 수집 worker (EventBridge Scheduler → Lambda)

계획서 §5.2 수집 주기 기준. Lambda 메모리 512MB, 평균 실행시간은 외부 API 1콜 + raw S3 저장 + staging/mart upsert 기준 보수적으로 잡음.

| 데이터소스 | 주기 | 호출/월 | 평균 실행 | GB-s/월 |
|---|---|---:|---:|---:|
| 현재전력수급현황 (P0) | **데모 15분** (PoC부터 5분) | 2,880 (5분 시 8,640) | 3s | 4,320 (5분 시 12,960) |
| 지역별 태양광 발전량 (P0) | 1시간 (17개 시도 증분 루프) | 720 | 20s | 7,200 |
| SMP (P0) | 일 2회 | 60 | 5s | 150 |
| REC 현물시장 (P0) | 일 2회 | 60 | 5s | 150 |
| 기상청 단기예보 (P1, 조건부) | 일 8회 (발표 주기) | 240 | 15s | 1,800 |
| 위성 일사량 (P1, 조건부) | 30분 | 1,440 | 10s | 7,200 |
| **합계 (P0만, 데모 15분)** | | **~3,700** | | **~11,800** |
| **합계 (P0만, 5분 복원)** | | **~9,500** | | **~20,500** |
| **합계 (P0+P1, 5분)** | | **~11,200** | | **~29,500** |

이하 §2.1의 사용량 대입은 보수적으로 **5분 주기 기준**으로 계산한다 (15분이면 그보다 더 작다 — 어차피 프리티어 내라 결론 불변).

### 1.2 API Lambda + 프론트

초대 기반 비공개 데모 기준.

| 시나리오 | 활성 사용자 | API 요청/월 | API GB-s/월 (512MB·평균 400ms) |
|---|---:|---:|---:|
| A. 데모 (3~6주차) | 5~10명, 데모 세션 위주 | ~50,000 | ~10,000 |
| B. PoC 파일럿 | 2~3개 조직, 20~30명 | ~300,000 | ~60,000 |
| C. 성장 가정 | 10개 조직, 100명 | ~1,500,000 | ~300,000 |

### 1.3 스토리지 증가율

- raw 객체: 월 ~1.2만 건 × 평균 20KB ≈ **월 ~0.25GB** (연간 CSV 파일 포함해도 월 1GB 미만)
- Neon DB: mart 시계열 (5분 수급 288행/일 + 시간별 태양광 17행×24 + 가격 일별) ≈ **월 ~0.1GB** + 인덱스

## 2. 월 비용 시뮬레이션

### 2.1 AWS 컴퓨트·스케줄링 (Lambda + EventBridge + SQS)

서울 리전 실측 가격 (2026-07-02, AWS Price List API — 출처: pricing.us-east-1.amazonaws.com offers, aws.amazon.com/lambda/pricing 외).

| 항목 | 서울 단가 | 프리티어 (always-free) |
|---|---|---|
| Lambda duration (x86) | $0.0000166667/GB-s | 400,000 GB-s/월 |
| Lambda duration (**arm64**) | $0.0000133334/GB-s (20% 저렴) | 〃 (공유) |
| Lambda requests | $0.20/1M | 1M/월 |
| Lambda Function URL | **무료** (엔드포인트 요금 없음) | — |
| EventBridge Scheduler | $1.15/1M 호출 (※ 서울은 US $1.00보다 비쌈) | **14M/월** |
| SQS standard (DLQ) | $0.40/1M | 1M/월 |
| API Gateway HTTP API (참고) | $1.23/1M | — (Function URL 권장으로 불필요) |

이 프로젝트 사용량 대입:

| 항목 | 데모(A) | 성장(C) | 프리티어 적용 후 |
|---|---:|---:|---:|
| worker+API duration | ~30K GB-s | ~330K GB-s | **$0** (< 400K) |
| worker+API requests | ~60K | ~1.51M | **$0 → $0.10** (C만 0.5M 초과) |
| EventBridge Scheduler | ~9.5K 호출 | ~11K | **$0** (≪ 14M) |
| SQS DLQ | 수십 건 | 수백 건 | **$0** |

**프리티어를 전혀 못 받는다고 가정해도** 데모 ~$0.5/월, 성장 시나리오 ~$6/월 (arm64 기준 그 이하). AWS 컴퓨트는 이 아키텍처에서 비용 요인이 아니다.

### 2.2 스토리지·로그·기타 AWS

| 항목 | 서울 단가 | 이 프로젝트 (데모 기준) |
|---|---|---:|
| S3 storage | $0.025/GB-월 | 1년차 누적 ~3GB → ~$0.08/월 |
| S3 PUT | $4.50/1M | 월 ~1.2만 건 → ~$0.05 |
| CloudWatch Logs 수집 | **$0.76/GB** (※ US $0.50의 1.5배, 서울 주의) | 월 ~0.1–0.5GB → 프리티어(5GB) 내 $0 |
| CloudWatch Logs 보관 | $0.0314/GB-월 | retention 미설정 시 무한 누적 — §3 참조 |
| SSM Parameter Store (standard) | **무료** | $0 |
| Data transfer out | 100GB/월 always-free, 초과 $0.126/GB | 데모 트래픽 ≪ 100GB → $0 |
| ECR (컨테이너 배포 시) | $0.10/GB-월 | 이미지 ~1GB → ~$0.10/월 |

**AWS 합계: 데모 ~$0–1/월, 성장 시나리오에서도 ~$7–8/월.**

### 2.3 Neon Postgres — **최대 단일 비용 항목**

2026-07 기준 Neon은 Free / Launch / Scale 구성이며, Launch·Scale은 최소요금 없는 순수 종량제다 (출처: neon.com/pricing, neon.com/docs/introduction/plans).

| 플랜 | 요금 | 이 프로젝트 적용 시 |
|---|---|---|
| Free | $0 — 100 CU-hours/project/월, 0.5GB storage, egress 5GB/월 | **5분 주기면 불가, 15분 주기면 가능** (아래 참조) — 데모는 15분 채택 |
| Launch | $0.106/CU-hour + $0.35/GB-month storage | 상시 0.25 CU 기준 **~$19.4 + storage ≈ $20/월** (PoC부터) |

**5분 주기에서 Free가 안 되는 이유 (구조적):** 수급현황을 5분 주기로 수집하는 worker가 DB를 5분마다 접속 → Neon scale-to-zero(5분 비활성 시 suspend)가 절대 발동하지 않음 → compute 상시 가동. 0.25 CU × 730h = **~182.5 CU-hours/월 > Free 한도 100**. 월 중순쯤 한도 소진 → **다음 달까지 DB suspend** (서비스 정지). 따라서 수집이 도는 순간부터 Launch 플랜이 필수다.

- Launch 예상: compute ~$19.4/월(0.25 CU 상시) + storage ~$0.35/GB — MVP 데이터 증가율(월 ~0.1GB)로는 storage는 수 센트 수준. **합계 ~$20/월**.

**데모 기간 $0 옵션 — 수집 주기 15분 (✅ 채택, 2026-07-02, developer_plan.md §1.3 반영):** 수급현황 수집을 5분 → **15분**으로 낮추면 Neon Free가 가능해진다. 계산: worker 실행 ~10–30초 + suspend 타이머 5분 → 15분 사이클당 compute 가동 ~5.5분 = duty cycle ~37% → 0.25 CU × 730h × 0.37 ≈ **~67 CU-hours/월 < Free 한도 100** (시간별 태양광·일별 SMP/REC 수집과 데모 API 사용을 얹어도 ~75 내외). 유의점:
- 원천 API는 "현재" 스냅샷만 주므로 5분 해상도 데이터는 **소급 복구 불가** — 15분 주기면 15분 해상도로 확정됨. 데모 대시보드 용도로는 충분.
- Free storage 한도 0.5GB — mart 증가율(월 ~0.1GB) 기준 **~4–5개월 후 소진**. 6주 데모는 여유, PoC 전환 시점에 Launch(~$20/월)로 올리면 됨.
- 주기는 EventBridge schedule 표현식 하나라 나중에 5분으로 되돌리는 비용은 0. **고객 인터뷰에서 실시간성 니즈가 확인되면 그때 5분 + Launch로 전환**하는 순서가 합리적.

### 2.4 프론트 호스팅 (Next.js 16 SSR)

2026-07 조사 기준 (출처: aws.amazon.com/amplify/pricing, vercel.com/pricing + fair-use-guidelines, developers.cloudflare.com/workers/platform/pricing, opennext.js.org/cloudflare).

| 옵션 | 월 비용 (데모 규모) | Next.js 16 | 비고 |
|---|---|---|---|
| **OpenNext on AWS (SST v3)** — CloudFront+Lambda+S3 | ~$0 (CloudFront always-free 1TB/10M req 내) | ✅ `@opennextjs/aws` peer dep이 **16.2.6+** 지원 (16.0.x–16.2.5 제외) | IaC 후보인 SST v3의 `Nextjs` 컴포넌트가 이 구성을 자동 생성 (CloudFront, server/image Lambda, S3, SQS ISR 큐, DynamoDB). **전 스택 AWS 단일화** |
| Amplify Hosting | ~$0 (12개월 무료 티어 내) → 이후 소액 | ⚠️ 공식 문서는 12–15만 명시. 커뮤니티 보고로는 App Router 동작 확인 | build $0.01/min(1,000min 무료), SSR $0.30/1M req + $0.20/GB-hr, 전송 $0.15/GB. **무료 티어가 12개월 한정** |
| Vercel Hobby | $0 | ✅ | **상업적 사용 금지** (fair-use 명문화: 제품/서비스 홍보·유급 개발 포함). 이 프로젝트는 SaaS 데모/PoC = 상업적 → **사용 불가** |
| Vercel Pro | $20/user/월 (usage credit $20 포함) | ✅ | 데모 트래픽은 포함량(1TB 전송, 10M edge req) 내 여유 |
| Cloudflare Workers (OpenNext) | $0 (Free: 10만 req/일) 또는 $5/월 (Paid) | ✅ 공식 지원 (`@opennextjs/cloudflare`가 Next.js 16 전 버전 명시) | egress 무과금. Node Middleware 미지원 주의. Better Auth 호환은 배포 전 검증 필요 |

판단 (2026-07-02 CloudFront 검토 반영):
- **1순위: OpenNext on AWS (SST v3)** — AWS 인프라 단일화 관점에서 최적. IaC를 SST v3로 정하면 프론트 배포가 따라오고, CloudFront always-free(아래 §2.4.1)로 데모 비용 $0, Amplify의 "12개월 무료 만료"(§3 #4)와 "Next 16 미공식"(§3 #5) 리스크가 동시에 해소된다. 조건: **next를 16.2.6 이상으로** (§7.3의 16.2.x 핀과 정합). 유의: SST가 기본 핀하는 OpenNext 버전(3.9.14)이 낮으므로 `openNextVersion`으로 4.x 명시 필요.
- 2순위 Amplify(빌드만으로 되는 가장 쉬운 경로), 3순위 Cloudflare Workers, 4순위 Vercel Pro. Vercel Hobby는 상업 프로젝트 금지라 후보 제외.

### 2.4.1 CloudFront — API·프론트 공통 엣지 (권장 추가)

2026-07 기준 CloudFront pay-as-you-go always-free: **월 1TB 전송 + 10M 요청 + 2M CloudFront Function 호출** (출처: aws.amazon.com/cloudfront/pricing/pay-as-you-go — 신규 flat-rate 플랜과 별개로 유지 확인). 초과 시 한국 엣지 $0.120/GB, $0.012/1만 요청. ACM 인증서 무료(SNI).

이 프로젝트에서 CloudFront의 역할 2가지:

1. **프론트**: OpenNext/SST 배포의 기본 구성요소 (위 표 1순위). 별도 결정 불필요 — SST가 만들어 준다.
2. **API Lambda 앞단**: Lambda Function URL은 무료지만 도메인이 `*.lambda-url.on.aws` 고정이다. CloudFront + **OAC(Origin Access Control)** 를 앞에 두면 (a) `api.도메인.com` 커스텀 도메인 + 무료 ACM 인증서, (b) Function URL 직접 노출 차단(OAC가 SigV4 서명, `AuthType: AWS_IAM`), (c) 공공데이터 기반 조회 응답의 엣지 캐싱(예: 수급현황 60s TTL → Lambda·Neon 부하 절감)을 얻는다. 데모 트래픽은 free tier에 완전히 흡수되어 **추가 비용 $0**.
   - 유의: OAC 뒤 Lambda URL에 PUT/POST 시 클라이언트가 `x-amz-content-sha256` 헤더를 보내야 함 — BFF(Next 서버사이드) fetch 래퍼에서 한 줄 처리, 1주차 walking skeleton에서 확인.

비용 요약: CloudFront 도입은 데모~PoC 규모에서 **$0 추가**이며, §2.5 합계를 바꾸지 않는다.

### 2.5 시나리오 합계 (월)

| 구성 요소 | A. 데모 (3~6주차, **15분 수집**) | B. PoC 파일럿 (5분 수집 복원) | C. 성장 |
|---|---:|---:|---:|
| AWS (Lambda+EventBridge+S3+CloudFront+로그) | ~$0–1 | ~$1–3 | ~$7–8 |
| Neon | **$0 (Free, 15분 주기·§2.3)** | ~$20 (Launch) | ~$25–45 (0.5 CU 구간 증가 가정) |
| 프론트 호스팅 | $0 (OpenNext on AWS, CloudFront always-free) | ~$0 | ~$0–5 (free tier 초과분) |
| **합계** | **~$0–1** | **~$21–23 (≈3만원)** | **~$32–58 (≈4.5–8만원)** |

데모 단계는 수집 주기를 15분으로 두면 **월 ~$0–1**로 운영 가능하다. 5분 실시간성이 고객 니즈로 확인되는 시점(PoC)부터 Neon Launch ~$20/월이 바닥 비용이 된다. 프론트를 OpenNext on AWS로 가면 Vercel Pro $20이 빠져 PoC~성장 구간 합계도 이전 추정보다 낮다. "안 쓸 때 거의 무료"라는 목표는 AWS 부분에선 완전히 성립하고, DB만 조건부다.

## 3. 잠재 비용 (숨은 비용·리스크)

계산에 안 잡히지만 실제 청구서에 나타날 수 있는 항목. **위험도 = 발생 확률 × 금액 임팩트.**

| # | 항목 | 위험도 | 내용 · 대응 |
|---|---|---|---|
| 1 | **Neon Free 한도** | 관리됨 (15분 채택) | §2.3. 15분 주기로 Free 유지하되, **5분으로 복원하는 순간 유료 전환 불가피**($20/월). storage 0.5GB도 ~4–5개월 뒤 소진 — PoC 예산에 $20/월 반영. Free 한도 소진 시 경고 없이 다음 달까지 DB suspend되므로 Neon 콘솔 사용량 알림 설정 |
| 2 | **CloudWatch Logs 무한 누적** | 높음 | Lambda 로그 그룹은 기본 retention이 '무기한'. 수집 worker가 5분마다 로그를 쌓으면 조용히 증가. **모든 로그 그룹 retention 14~30일 설정을 IaC에 포함** (0원 예방) |
| 3 | **로그 과다 출력** | 중간 | 서울 수집 단가 $0.76/GB는 US의 1.5배. 디버그 로그를 프로덕션에 켜두면 (예: 요청/응답 body 전체 로깅) 월 수 GB→수 달러. 구조화 로그 + 레벨 관리 |
| 4 | **Amplify 무료 티어 만료 (12개월)** | 해소 (fallback 시만) | OpenNext on AWS 1순위 채택으로 기본 경로에선 무관. Amplify fallback 사용 시에만: 13개월차부터 SSR $0.30/1M + 전송 $0.15/GB + build $0.01/min (데모 규모 월 $1–5) |
| 5 | **OpenNext/SST × Next.js 16 검증 리스크** | 중간 | `@opennextjs/aws`는 next 16.2.6+ 필요, SST 기본 핀(3.9.14)이 낮아 `openNextVersion` 4.x 명시 필요. Week 3 게이트에서 배포 실패 시 **시간 비용**(반나절~이틀). fallback: Amplify → CF Workers → Vercel Pro ($0→$20) |
| 6 | **Lambda 콜드스타트 → 과잉 대응** | 중간 | 느리다고 Provisioned Concurrency를 켜면 상시 과금(512MB 1개 ≈ $6.5/월)으로 서버리스 이점 소멸. 데모 단계에선 켜지 않는다. 대안: EventBridge로 5분 warmer ping (프리티어 내 $0) |
| 7 | **NAT Gateway 함정** | 낮음 (설계로 회피) | Lambda를 VPC 안에 넣으면 외부 API 호출에 NAT Gateway 필요 — **시간당 $0.059 + $0.059/GB ≈ 최소 $43/월**. Neon은 공용 인터넷 DB이므로 **Lambda를 VPC 밖에 두면 원천 회피**. IaC 때 실수로 VPC 배치하지 않도록 명시 |
| 8 | **worker 폭주 (버그·재시도 루프)** | 낮음~중간 | 무한 재시도 버그가 나면 Lambda·Neon compute가 같이 탄다 (Neon autoscaling 2 CU까지 → 최악 월 ~$155). **AWS Budgets 알림($10/$30) + Scheduler 재시도 상한(예: 3회) + Lambda reserved concurrency 상한**을 1일차에 설정 |
| 9 | **S3 버저닝·불완전 멀티파트** | 낮음 | raw 버킷에 versioning 켜면 재적재마다 이전 버전 누적. lifecycle rule (불완전 멀티파트 7일 정리, 필요 시 old version 만료) 기본 적용 |
| 10 | **개발계정 API 트래픽 한도 초과** | — (비용 아님) | 공공데이터 쪽은 과금이 아니라 차단. 비용 리스크 없음 |
| 11 | **신규 AWS 계정 프리티어 제도 변경** | 확인 필요 | 2025-07-15 이후 신규 계정은 "크레딧 $100~200 + 6개월" 체계. Lambda/SQS/CloudWatch always-free는 유지되나, S3 5GB·API GW 1M 같은 구 12개월 오퍼는 소멸. **기존 계정 사용 시 무관** — 어느 계정으로 배포할지 1주차에 확정 |
| 12 | **AWS Activate 크레딧** | 기회 | 자가펀딩 Founders 트랙 $1,000 (조건 충족 시 최대 $5,000). 승인 5–10 영업일. **신청하면 첫 1~2년 AWS 비용 전액 상쇄 가능** — Week 3 배포 이슈에 신청 태스크 추가 권장 |

### 최악 시나리오 상한 (러너웨이 가드 없을 때)

버그로 worker가 최대 동시성으로 한 달 폭주하는 극단 가정에서도, 지출 상한은 대략: Lambda 수십 달러 + Neon ~$155 (2 CU 상시) + 로그 수 달러 = **~$200/월 수준**. AWS Budgets 알림 2개(월 $10, $30 초과 시 이메일)만 걸어두면 실질적으로 며칠 내 감지된다.

## 4. 권고

1. **예산 기준선: 월 ~$0–1 (데모, 15분 수집 + Neon Free) → ~$21–40 (PoC, 5분 복원 + Launch)**. 데모 단계 유일한 결정은 수집 주기 15분이며, 실시간성 니즈가 인터뷰에서 확인되면 그때 5분 + Launch로 올린다 (schedule 표현식 변경뿐이라 전환 비용 0).
2. **1일차 (비용 가드, 총 30분 작업)**: AWS Budgets $10/$30 알림, 전 로그 그룹 retention 30일, Scheduler 재시도 상한 3회, S3 lifecycle rule. 전부 무료이고 이 문서의 잠재 비용 #2·#8·#9를 원천 차단한다.
3. **Lambda는 arm64 + Function URL + CloudFront(OAC)로**: duration 20% 저렴 + API Gateway $1.23/1M 회피 + 커스텀 도메인/캐싱은 CloudFront always-free로 해결 (§2.4.1).
4. **Lambda를 VPC에 넣지 않는다** (#7). Neon·공공데이터 API 모두 공용 인터넷이므로 VPC 불필요. NAT $43/월 함정 회피.
5. **AWS Activate Founders 신청** (Week 3 배포 이슈에 포함): $1,000 크레딧이면 1년차 AWS 비용 전액 상쇄.
6. **프론트는 OpenNext on AWS(SST v3, CloudFront+Lambda+S3)를 1순위로** — next 16.2.6+ 조건 확인 후 Week 3 게이트에서 검증. fallback: Amplify → Cloudflare Workers → Vercel Pro (§2.4 판단 참조).
7. **Neon 비용 레버는 컴퓨트 크기가 아니라 수집 주기다.** 데모는 15분(Free), PoC부터 5분(Launch). §2.3의 duty cycle 계산 참조.

---

*가격 출처: AWS Price List API (ap-northeast-2, 2026-07-02), aws.amazon.com/lambda·eventbridge·s3·cloudwatch·systems-manager·amplify/pricing, aws.amazon.com/free, aws.amazon.com/startups/credits, neon.com/pricing·docs, vercel.com/pricing·fair-use-guidelines, developers.cloudflare.com/workers/platform/pricing, opennext.js.org/cloudflare. 서울 리전 단가는 마케팅 페이지가 아닌 Price List API 실측값 기준 (EventBridge $1.15/1M, CloudWatch $0.76/GB 등 US 단가와 다름).*
