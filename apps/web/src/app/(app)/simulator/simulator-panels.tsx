'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * 시뮬레이터 폼 + 결과 (목업 v4 레이아웃 이식, solar-742).
 * 계산 로직/검증(RHF+Zod form-wire 분리)과 API 연결은 solar-cgc.1/.4에서.
 * 지금은 레이아웃 확정용 — 계산하기를 누르면 예시 결과 카드만 표시.
 */
export function SimulatorPanels() {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="p-4">
        <form
          className="space-y-3.5 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setShowResult(true);
          }}
        >
          <h2 className="text-sm font-semibold">시뮬레이션 조건</h2>

          <Field label="지역">
            <PlainSelect defaultValue="경기" options={['경기', '전남', '경북', '충남', '제주']} />
          </Field>

          <Field label="시장 구분">
            <PlainSelect defaultValue="육지" options={['육지', '제주']} />
          </Field>

          <Field label="설비용량 (kW)">
            <Input type="number" defaultValue={998} className="tabular" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="REC 가중치">
              <Input type="number" defaultValue={1.0} step={0.1} className="tabular" />
            </Field>
            <Field label="중개 수수료율 (%)">
              <Input type="number" defaultValue={1.0} step={0.1} className="tabular" />
            </Field>
          </div>

          <Field label="기간">
            <PlainSelect
              defaultValue="2026-04 (1개월)"
              options={['2026-04 (1개월)', '2025-11 ~ 2026-04 (6개월)']}
            />
          </Field>

          <Field label="발전량 산정 방식">
            <PlainSelect
              defaultValue="지역 시간별 실적 비례"
              options={['지역 시간별 실적 비례', '설비이용률 직접 입력']}
            />
          </Field>

          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs text-text-secondary">
              SMP 단가 (원/kWh)
              <span
                className="rounded border px-1 py-px text-[10px]"
                style={{ color: 'var(--status-warning)' }}
              >
                직접 입력
              </span>
            </Label>
            <Input type="number" defaultValue={128.5} step={0.1} className="tabular" />
            <p className="text-[11px] text-text-muted">
              SMP 소스 검증 중 — 검증 완료 시 시장 데이터로 자동 대체됩니다.
            </p>
          </div>

          <Field label="REC 가격 기준">
            <PlainSelect
              defaultValue="현물시장 평균가"
              options={['현물시장 평균가', '현물시장 종가 (육지 기준)']}
            />
          </Field>

          <Button type="submit" className="w-full" style={{ background: 'var(--series-1)' }}>
            계산하기
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        {showResult ? (
          <Card className="p-5">
            <div className="text-xs text-text-secondary">총 예상 수익 (예시 — 계산 API 연결 전)</div>
            <div className="tabular mt-1 font-semibold" style={{ fontSize: 48, lineHeight: 1.15 }}>
              ₩—
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              계산 API(POST /api/v1/simulator/revenue)가 연결되면 이 자리에 실제 추정 결과가
              표시됩니다.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
              {['예상 발전량', 'SMP 수익', 'REC 수익', '중개 수수료'].map((label) => (
                <div key={label}>
                  <div className="text-xs text-text-secondary">{label}</div>
                  <div className="mt-0.5 font-semibold">—</div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="flex items-center justify-center p-12 text-sm text-text-muted">
            조건을 입력하고 계산하기를 누르면 결과가 여기 표시됩니다.
          </Card>
        )}

        <Card className="px-4 py-3 text-xs leading-relaxed text-text-muted">
          계산 가정: 발전량은 같은 지역 공공데이터 실적에 설비용량을 비례 배분한 추정값입니다. SMP
          단가는 사용자 입력값을 전 시간대에 동일 적용하며, REC 수익은 발전량 × 가중치 × 선택 기준가로
          계산합니다. 세금·계통 접속 비용·설비 감가는 포함하지 않습니다. 본 결과는 법적·회계적 정산
          근거로 사용할 수 없습니다.
        </Card>
      </div>
    </div>
  );
}

/** 라벨 + 컨트롤 세로 배치 헬퍼. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-text-secondary">{label}</Label>
      {children}
    </div>
  );
}

/** 값 상태를 별도로 관리하지 않는 레이아웃용 단순 Select (계산 배선은 cgc.1/.4). */
function PlainSelect({ defaultValue, options }: { defaultValue: string; options: string[] }) {
  return (
    <Select defaultValue={defaultValue}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
