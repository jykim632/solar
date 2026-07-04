'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * shadcn/ui 표준 다크모드 — `.dark` 클래스 기반(next-themes).
 * 기존 시안(v4)은 prefers-color-scheme 자동 전환이었으므로 기본값을
 * `system`으로 두어 동일한 UX(OS 설정 추종)를 유지한다.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
