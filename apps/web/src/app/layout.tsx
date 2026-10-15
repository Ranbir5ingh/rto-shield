import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });
const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'RTO Shield — stop paying for orders that come back',
  description:
    'Score cash-on-delivery orders before you ship them. Built for Meesho, Instagram, WhatsApp, and small Shopify sellers. ₹499/month.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans text-ink antialiased`}>{children}</body>
    </html>
  );
}
