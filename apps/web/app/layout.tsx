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
          <span>Terms</span>
          <span>Privacy</span>
          <span>Copyright &amp; takedown</span>
          <span>Help</span>
        </footer>
      </body>
    </html>
  );
}
