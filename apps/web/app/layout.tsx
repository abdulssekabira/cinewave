import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import '@fontsource/bebas-neue/400.css';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GLE Movies', template: '%s · GLE Movies' },
  description: 'Stream films in Uganda and beyond. Watch free with ads, or subscribe with mobile money or card.',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} GLE Movies · by Gamers Loft Entertainment</span>
          <Link href="/plans">Plans</Link>
          <Link href="/app">Get the Android app</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/copyright">Copyright &amp; takedown</Link>
          <Link href="/contact">Contact &amp; help</Link>
        </footer>
      </body>
    </html>
  );
}
