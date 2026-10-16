import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono, Noto_Sans } from 'next/font/google';
import Script from 'next/script';
import { WakeGate } from '@/components/WakeGate';
import { landingWakeScript } from '@/lib/wake';
import './globals.css';

const tight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-tight',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const noto = Noto_Sans({
  subsets: ['devanagari', 'latin'],
  variable: '--font-dev',
  weight: ['400', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RTO Shield — The complete COD Risk Score',
  description:
    'RTO Shield scores every cash-on-delivery order 0–100 before it ships. Confirm the risky ones on WhatsApp and stop paying for returns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${tight.variable} ${mono.variable} ${noto.variable}`}>
      <body className="bg-void font-sans text-ink antialiased">
        <Script id="landing-wake" strategy="afterInteractive">
          {landingWakeScript()}
        </Script>
        <WakeGate>{children}</WakeGate>
      </body>
    </html>
  );
}
