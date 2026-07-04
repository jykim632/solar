'use client';

import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { GLOSSARY } from '@/lib/glossary';

/** 용어 사전 drawer (목업 v4 이식) — 헤더 '도움말' 버튼으로 토글. shadcn Sheet 기반(포커스 트랩·ESC·backdrop 내장). */
export function GlossaryButton() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" title="용어 사전 열기">
            <CircleHelp />
            도움말
          </Button>
        }
      />
      <SheetContent side="right" className="w-[340px] max-w-[90vw] sm:max-w-[340px]">
        <SheetHeader className="border-b">
          <SheetTitle>용어 사전</SheetTitle>
          <SheetDescription className="sr-only">
            대시보드에서 쓰이는 지표·단위 용어 설명
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {Object.entries(GLOSSARY).map(([key, term]) => (
            <div key={key}>
              <div className="text-sm font-semibold">
                {term.name}
                {term.unit && (
                  <span className="ml-1.5 text-xs font-normal text-text-muted">{term.unit}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{term.desc}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
