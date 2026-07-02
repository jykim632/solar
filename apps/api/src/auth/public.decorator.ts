import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Default-deny opt-out (§10.3). 공개 endpoint에만 명시적으로 붙인다. */
export function Public() {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
