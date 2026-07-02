import { MeProbe } from './me-probe';

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 880 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Solar Market Intelligence</h1>
        <p style={{ marginTop: 8, color: '#4b5563' }}>
          공공데이터 기반 태양광 O&amp;M 분석 대시보드 (MVP) — 인증 walking skeleton.
        </p>
      </header>
      <MeProbe />
    </main>
  );
}
