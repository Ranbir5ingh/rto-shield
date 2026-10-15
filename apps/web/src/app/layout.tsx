import type { Metadata } from 'next';
import { Manrope, Noto_Sans } from 'next/font/google';
import Script from 'next/script';
import { Cursor } from '@/components/Cursor';
import { WakeGate } from '@/components/WakeGate';
import { landingWakeScript } from '@/lib/wake';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });
const hindi = Noto_Sans({ subsets: ['devanagari'], variable: '--font-hindi', weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'RTO Shield — stop paying for orders that come back',
  description:
    'Score cash-on-delivery orders before you ship them. Built for Meesho, Instagram, WhatsApp, and small Shopify sellers. ₹499/month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${hindi.variable} bg-paper font-sans text-ink antialiased`}>
        <Script id="wake-backends" strategy="beforeInteractive">
          {landingWakeScript()}
        </Script>
        <div className="grain" aria-hidden="true" />
        <Cursor />
        <WakeGate>{children}</WakeGate>
      </body>
    </html>
  );
}
