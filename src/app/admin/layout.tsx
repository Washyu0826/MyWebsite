import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Resume Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-TW" suppressHydrationWarning>
    <body>
      {children}
    </body>
  </html>;
}
