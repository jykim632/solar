/**
 * @solar/ingestion-schemas — worker-only zod schemas.
 *
 * These validate raw external public-data responses (KPX/KMA) at the
 * "raw 저장 후 staging 변환 전" gate (CLAUDE.md: Zod 계약 검증 규약).
 * They are intentionally separate from @solar/api-contracts so that
 * loose, source-shaped external payloads never leak into the API contract.
 */
export * from './datagokr.js';
