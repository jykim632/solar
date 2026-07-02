# Neon branch 전략 (solar-8wv.10)

로컬 Postgres/Docker 없이 Neon에 직접 연결하는 전제(사용자 override)에서의 branch 운용 결정.
6주 솔로 MVP 규모에 맞춰 최소 구성으로 간다.

## 토폴로지

```
main            default/root branch. 향후 production. 배포 플랫폼 secret만 이 URL을 가진다.
└── dev         장수명 개발 branch. 로컬 .env는 항상 여기를 가리킨다. 만료(auto-delete) 비활성.
    └── tmp/*   위험한 schema/data migration 시험용 단기 branch (TTL 1일). 예외적으로만 사용.
```

- feature별 ephemeral branch는 쓰지 않는다 — 솔로 6주 MVP에 과도한 오버헤드.
- branch 관리는 Neon Console로 한다. neonctl CLI 자동화는 이 규모에선 도입하지 않는다.

## 워크플로

1. Console에서 `main`으로부터 `dev` branch 생성. **만료(expiration) 비활성** 확인.
2. `dev`의 pooled/direct connection string을 로컬 `.env`에 기입.
3. 개발은 `dev`에서만:
   ```bash
   pnpm db:generate   # migration 파일 생성 (git 커밋 대상)
   pnpm db:migrate    # dev에 적용 (DATABASE_DIRECT_URL 사용)
   pnpm db:seed       # 멱등 seed
   ```
4. 배포 시점에 같은 migration을 `main`에 적용:
   ```bash
   set -a; source .env.neon-main; set +a
   pnpm db:migrate && pnpm db:seed
   ```
   런타임 배포는 `main`의 pooled URL을 배포 플랫폼 secret으로.
5. dev DB를 초기화하고 싶으면 Console에서 `dev`를 `main` 기준으로 **reset** 후 재seed (지저분한 데모 데이터 폐기용 — 의도적).
6. 위험 migration만 `tmp/<이슈ID>` branch(TTL 1일)에서 먼저 시험 후 삭제.

## .env 레이아웃

변수명은 고정, 값으로 branch를 선택한다. `PROD_DATABASE_URL` 같은 신규 변수 금지.

```
.env             # 현재 작업 branch(평소 dev)의 pooled + direct URL
.env.neon-dev    # dev URL 보관용 (로컬 전용, .gitignore의 .env.*로 이미 제외)
.env.neon-main   # main URL 보관용 — 릴리스 migration 때만 source
```

- 런타임 = `DATABASE_URL`(pooled, host에 `-pooler` 포함)
- migration/seed/admin = `DATABASE_DIRECT_URL`(direct, `-pooler` 없음)

## 주의사항 (gotchas)

- **migration은 branch별로 따로 적용된다.** dev에 migrate해도 main은 그대로 — 배포 시 main에 같은 migration을 반드시 다시 실행.
- branch는 생성 시점 데이터를 copy-on-write로 복사한 뒤 분기한다. dev의 데모 데이터는 main으로 흐르지 않는다.
- Free/Launch plan은 프로젝트당 branch 10개. 임시 branch는 쓰고 바로 삭제(스토리지 delta·history 잠금 누적 방지).
- Console에서 만든 branch는 auto-delete가 기본일 수 있다 — 장수명 `dev`는 반드시 비활성, `tmp/*`는 유지.
- scale-to-zero로 첫 쿼리에 cold start 지연이 있다. 데모 직전 `main`을 미리 warm할 것 (Free plan은 비활성화 불가).
- pooled URL(PgBouncer transaction mode)로 DDL/migration 실행 금지 — `drizzle.config.ts`가 `DATABASE_DIRECT_URL`을 강제한다 (§9.0/§18.4).
