import { MeProbe } from './me-probe';

/** 인증 walking skeleton 검증 화면 (solar-8wv.12) — 개발용. */
export default function DebugMePage() {
  return (
    <>
      <h1 className="text-lg font-semibold">인증 확인 (/api/v1/me)</h1>
      <MeProbe />
    </>
  );
}
