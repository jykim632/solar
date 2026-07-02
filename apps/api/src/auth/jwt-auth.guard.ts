import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env';
import type { AuthClaims } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

type SolarJwtPayload = JWTPayload & { email?: unknown };

/**
 * 전역 default-deny guard (§10.3). Better Auth JWKS로 서명 검증 —
 * algorithms whitelist(EdDSA)/issuer/audience를 명시 강제한다(alg 신뢰 금지).
 * createRemoteJWKSet은 기본 cooldown/max-age로 JWKS를 캐시한다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly reflector: Reflector) {
    const apiEnv = env();
    this.issuer = apiEnv.AUTH_BASE_URL;
    this.audience = apiEnv.AUTH_BASE_URL;
    this.jwks = createRemoteJWKSet(new URL(`${apiEnv.AUTH_BASE_URL}/api/auth/jwks`));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { auth?: AuthClaims }>();
    const token = bearerTokenFromHeader(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const { payload } = await jwtVerify<SolarJwtPayload>(token, this.jwks, {
        algorithms: ['EdDSA'],
        issuer: this.issuer,
        audience: this.audience,
      });

      request.auth = {
        sub: requiredString(payload.sub),
        email: requiredString(payload.email),
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid bearer token');
    }
  }
}

function bearerTokenFromHeader(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token, extra] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return null;
  }

  return token;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UnauthorizedException('Required JWT claim is missing');
  }

  return value;
}
