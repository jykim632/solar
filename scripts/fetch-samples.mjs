#!/usr/bin/env node
/**
 * 데이터 소스별 응답 샘플 수집 (solar-8wv.4).
 *
 * 활용신청 승인 후 실행: set -a; source .env; set +a; node scripts/fetch-samples.mjs
 * 결과는 data/samples/에 저장. 실패해도 에러 응답을 *.error.* 로 남긴다
 * (스키마/에러 구조 확정 근거 — 원본 저장 원칙 §8).
 *
 * 주의: 개발계정 트래픽 제한(일부 API 100건/일)이 있으므로 남발 금지.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(import.meta.dirname, '../data/samples');

const key = process.env.DATA_GO_KR_API_KEY;
if (!key) {
  console.error('DATA_GO_KR_API_KEY is required (source .env first).');
  process.exit(1);
}

// 어제 날짜 (KST) — 발전량/REC는 일 단위 확정 데이터라 어제가 안전.
const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
kstNow.setUTCDate(kstNow.getUTCDate() - 1);
const ymd = kstNow.toISOString().slice(0, 10).replaceAll('-', '');

// 단기예보 base_date/base_time: 실황은 매시 40분 이후 직전 정시 제공.
const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
nowKst.setUTCHours(nowKst.getUTCHours() - 1);
const baseDate = nowKst.toISOString().slice(0, 10).replaceAll('-', '');
const baseTime = `${String(nowKst.getUTCHours()).padStart(2, '0')}00`;

/** @type {{name: string, url: string, ext: string}[]} */
const targets = [
  {
    name: 'pv-gen',
    ext: 'json',
    url: `https://apis.data.go.kr/B552115/PvAmountByLocHr/getPvAmountByLocHr?serviceKey=${key}&pageNo=1&numOfRows=50&dataType=json&tradeYmd=${ymd}`,
  },
  {
    name: 'rec',
    ext: 'json',
    url: `https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2?serviceKey=${key}&pageNo=1&numOfRows=10&dataType=json`,
  },
  {
    name: 'supply-realtime',
    ext: 'xml',
    url: `https://openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime?serviceKey=${key}`,
  },
  {
    name: 'fcst-ultra-ncst',
    ext: 'json',
    url: `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${key}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=60&ny=127`,
  },
];

await mkdir(OUT_DIR, { recursive: true });

for (const t of targets) {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(t.url, { headers: { 'user-agent': 'solar-mvp-sample/1.0' } });
    const body = await res.text();
    const ok =
      res.ok &&
      !body.includes('SERVICE KEY IS NOT REGISTERED') &&
      !body.includes('SERVICE_KEY_IS_NOT_REGISTERED') &&
      !body.toLowerCase().startsWith('unauthorized');
    const file = path.join(OUT_DIR, `${t.name}-${stamp}${ok ? '' : '.error'}.${t.ext}`);
    await writeFile(file, body);
    console.log(`${ok ? '✓' : '✗'} ${t.name}: HTTP ${res.status}, ${body.length}B → ${path.basename(file)}`);
  } catch (err) {
    console.log(`✗ ${t.name}: ${err.message}`);
  }
}
