import { redirect } from 'next/navigation';

/** 홈 → 첫 화면(전력수급 상황판)으로. walking-skeleton 검증은 /debug/me로 이동. */
export default function HomePage() {
  redirect('/supply');
}
