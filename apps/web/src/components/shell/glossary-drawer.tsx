'use client';

import { useEffect, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { GLOSSARY } from '@/lib/glossary';

/** 용어 사전 drawer (목업 v4 이식) — 헤더 '도움말' 버튼으로 토글. */
export function GlossaryButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        title="용어 사전 열기"
      >
        <CircleHelp size={14} strokeWidth={2} />
        도움말
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-[51] flex w-[340px] max-w-[90vw] flex-col border-l"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            role="dialog"
            aria-label="용어 사전"
          >
            <div
              className="flex h-14 shrink-0 items-center justify-between border-b px-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-sm font-semibold">용어 사전</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="닫기"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {Object.entries(GLOSSARY).map(([key, term]) => (
                <div key={key}>
                  <div className="text-sm font-semibold">
                    {term.name}
                    {term.unit && (
                      <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                        {term.unit}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {term.desc}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
