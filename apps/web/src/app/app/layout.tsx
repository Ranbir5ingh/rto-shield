import { Noto_Sans } from 'next/font/google';
import { Shell } from '@/components/Shell';

const hindi = Noto_Sans({ subsets: ['devanagari'], variable: '--font-hindi', weight: '400', display: 'swap' });

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={hindi.variable}>
      <Shell>{children}</Shell>
    </div>
  );
}
