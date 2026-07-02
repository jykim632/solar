import { headers } from 'next/headers';
import { auth } from './auth';

/** Server-side session lookup for layouts/pages (1차 방어선 — UX용, §10.3). */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
