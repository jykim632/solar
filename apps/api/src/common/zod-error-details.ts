import type { ApiErrorDetail } from '@solar/api-contracts';
import type { ZodError } from 'zod';

/** Zod v4 issue projection for the standard API envelope (§10, §15.3). */
export function zodErrorToApiErrorDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
  }));
}

function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.map((part) => String(part)).join('.');
}
