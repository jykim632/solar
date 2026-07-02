import type { Request } from 'express';

/**
 * Verified JWT claims. §10.3에 따라 role/membership은 JWT에 없다 — 권한
 * 사실은 매 요청 service layer에서 DB 조회한다.
 */
export type AuthClaims = Readonly<{
  sub: string;
  email: string;
}>;

export type AuthenticatedRequest = Request & {
  auth: AuthClaims;
};
