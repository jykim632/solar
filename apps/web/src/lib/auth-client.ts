'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side auth client. Same-origin — defaults to window.location.origin
 * with the standard /api/auth base path. Only session/sign-in/sign-out flows;
 * JWTs never reach browser JS (BFF pattern, §10.3).
 */
export const authClient = createAuthClient();
