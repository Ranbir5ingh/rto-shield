import type { Metadata } from 'next';
import { Syne, Instrument_Serif, Space_Grotesk, JetBrains_Mono, Noto_Sans } from 'next/font/google';
import Script from 'next/script';
import { WakeGate } from '@/components/WakeGate';
import { landingWakeScript } from '@/lib/wake';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['700', '800'],
  display: 'swap',
});

const instr = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instr',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jbmono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const hindi = Noto_Sans({
  subsets: ['devanagari', 'latin'],
  variable: '--font-hindi',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RTO Shield — stop paying for orders that come back',
  description:
    'Score cash-on-delivery orders before you ship them. Built for Meesho, Instagram, WhatsApp, and small Shopify sellers. ₹499/month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${instr.variable} ${grotesk.variable} ${jbmono.variable} ${hindi.variable} bg-void font-sans text-ink antialiased`}>
        <Script id="wake-backends" strategy="beforeInteractive">
          {landingWakeScript()}
        </Script>
        <div className="grain" aria-hidden="true" />
        <WakeGate>{children}</WakeGate>
      </body>
    </html>
  );
}
