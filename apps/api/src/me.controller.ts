import { Controller, Get, Req } from '@nestjs/common';
import type { AuthClaims, AuthenticatedRequest } from './auth/auth.types';

/** Walking skeleton 보호 endpoint (§10.3, solar-8wv.12). */
@Controller('me')
export class MeController {
  @Get()
  getMe(@Req() request: AuthenticatedRequest): AuthClaims {
    return request.auth;
  }
}
