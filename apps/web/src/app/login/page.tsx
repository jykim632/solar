import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/server-session';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect('/');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Solar Market Intelligence</h1>
        <p style={{ color: '#4b5563' }}>초대 기반 비공개 데모 — seed 계정으로 로그인하세요.</p>
        <LoginForm />
      </section>
    </main>
  );
}
