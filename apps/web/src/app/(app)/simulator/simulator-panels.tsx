'use client';

import { useState } from 'react';

/**
 * 시뮬레이터 폼 + 결과 (목업 v4 레이아웃 이식, solar-742).
 * 계산 로직/검증(RHF+Zod form-wire 분리)과 API 연결은 solar-cgc.1/.4에서.
 * 지금은 레이아웃 확정용 — 계산하기를 누르면 예시 결과 카드만 표시.
 */
export function SimulatorPanels() {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
      <form
        className="card space-y-3.5 p-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setShowResult(true);
        }}
      >
        <h2 className="text-sm font-semibold">시뮬레이션 조건</h2>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            지역
          </span>
          <select className="mt-1 w-full">
            <option>경기</option>
            <option>전남</option>
            <option>경북</option>
            <option>충남</option>
            <option>제주</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            시장 구분
          </span>
          <select className="mt-1 w-full">
            <option>육지</option>
            <option>제주</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            설비용량 (kW)
          </span>
          <input type="number" defaultValue={998} className="tabular mt-1 w-full" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              REC 가중치
            </span>
            <input type="number" defaultValue={1.0} step={0.1} className="tabular mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              중개 수수료율 (%)
            </span>
            <input type="number" defaultValue={1.0} step={0.1} className="tabular mt-1 w-full" />
          </label>
        </div>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            기간
          </span>
          <select className="mt-1 w-full">
            <option>2026-04 (1개월)</option>
            <option>2025-11 ~ 2026-04 (6개월)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            발전량 산정 방식
          </span>
          <select className="mt-1 w-full">
            <option>지역 시간별 실적 비례</option>
            <option>설비이용률 직접 입력</option>
          </select>
        </label>

        <label className="block">
          <span
            className="flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            SMP 단가 (원/kWh)
            <span
              className="rounded border px-1 py-px text-[10px]"
              style={{ borderColor: 'var(--border)', color: 'var(--status-warning)' }}
            >
              직접 입력
            </span>
          </span>
          <input type="number" defaultValue={128.5} step={0.1} className="tabular mt-1 w-full" />
          <span className="mt-1 block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            SMP 소스 검증 중 — 검증 완료 시 시장 데이터로 자동 대체됩니다.
          </span>
        </label>

        <label className="block">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            REC 가격 기준
          </span>
          <select className="mt-1 w-full">
            <option>현물시장 평균가</option>
            <option>현물시장 종가 (육지 기준)</option>
          </select>
        </label>

        <button
          type="submit"
          className="w-full rounded-lg py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--series-1)' }}
        >
          계산하기
        </button>
      </form>

      <div className="space-y-4">
        {showResult ? (
          <div className="card p-5">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              총 예상 수익 (예시 — 계산 API 연결 전)
            </div>
            <div className="tabular mt-1 font-semibold" style={{ fontSize: 48, lineHeight: 1.15 }}>
              ₩—
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              계산 API(POST /api/v1/simulator/revenue)가 연결되면 이 자리에 실제 추정 결과가
              표시됩니다.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm xl:grid-cols-4">
              {['예상 발전량', 'SMP 수익', 'REC 수익', '중개 수수료'].map((label) => (
                <div key={label}>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                  </div>
                  <div className="mt-0.5 font-semibold">—</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="card flex items-center justify-center p-12 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            조건을 입력하고 계산하기를 누르면 결과가 여기 표시됩니다.
          </div>
        )}

        <div className="card px-4 py-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          계산 가정: 발전량은 같은 지역 공공데이터 실적에 설비용량을 비례 배분한 추정값입니다. SMP
          단가는 사용자 입력값을 전 시간대에 동일 적용하며, REC 수익은 발전량 × 가중치 × 선택
          기준가로 계산합니다. 세금·계통 접속 비용·설비 감가는 포함하지 않습니다. 본 결과는
          법적·회계적 정산 근거로 사용할 수 없습니다.
        </div>
      </div>
    </div>
  );
}
