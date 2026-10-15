import type { Metadata } from 'next';
import { Fraunces, Outfit, Tiro_Devanagari_Hindi } from 'next/font/google';
import Script from 'next/script';
import { WakeGate } from '@/components/WakeGate';
import { landingWakeScript } from '@/lib/wake';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });
const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600'] });
const deva = Tiro_Devanagari_Hindi({ subsets: ['devanagari'], weight: '400', variable: '--font-deva' });

export const metadata: Metadata = {
  title: 'RTO Shield — stop paying for orders that come back',
  description:
    'Score cash-on-delivery orders before you ship them. Built for Meesho, Instagram, WhatsApp, and small Shopify sellers. ₹499/month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${deva.variable} font-sans text-ink antialiased`}>
        <Script id="wake-backends" strategy="beforeInteractive">
          {landingWakeScript()}
        </Script>
        <WakeGate>{children}</WakeGate>
      </body>
    </html>
  );
}
