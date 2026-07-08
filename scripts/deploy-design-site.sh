#!/usr/bin/env bash
# UI 시안(docs/design/layout-mockup.html) → design.haearim.cloud 재배포.
# 리소스(S3/CloudFront/Route53/ACM)는 2026-07-03 CLI로 생성됨 — solar-m68/solar-lfp 노트 참조.
# Week 3에 SST v3 도입 시 이 스크립트와 리소스를 SST StaticSite로 흡수 검토.
set -euo pipefail

export AWS_PROFILE=haearim
export AWS_CREDENTIAL_PROCESS=  # 글로벌 env의 credential_process 오버라이드

BUCKET="haearim-design-site"
DISTRIBUTION_ID="E1DMJ3E8GD4404"
MOCKUP="$(dirname "$0")/../docs/design/layout-mockup.html"

aws s3 cp "$MOCKUP" "s3://$BUCKET/index.html" --content-type "text/html; charset=utf-8"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/index.html" --query "Invalidation.Id" --output text

echo "deployed: https://design.haearim.cloud"
