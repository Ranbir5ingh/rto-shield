import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import Script from 'next/script';
import { WakeGate } from '@/components/WakeGate';
import { landingWakeScript } from '@/lib/wake';
import './globals.css';

export const metadata: Metadata = {
  title: 'RTO Shield — stop paying for orders that come back',
  description:
    'Score cash-on-delivery orders before you ship them. Built for Meesho, Instagram, WhatsApp, and small Shopify sellers. ₹499/month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} bg-canvas font-sans text-ink antialiased`}>
        <Script id="wake-backends" strategy="beforeInteractive">
          {landingWakeScript()}
        </Script>
        <div className="grain" aria-hidden="true" />
        <WakeGate>{children}</WakeGate>
      </body>
    </html>
  );
}
