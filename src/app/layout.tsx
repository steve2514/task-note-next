import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '과제노트 | 나의 과제 관리',
  description: '과제를 기록하고 마감일과 완료 상태를 관리하는 Next.js 풀스택 웹 서비스',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
