import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CineWave', template: '%s · CineWave' },
  description: 'Stream films from independent studios and partners. Free with ads, or subscribe.',
};

export const viewport: Viewport = {
  themeColor: '#0a0b0f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} CineWave</span>
          <Link href="/plans">Plans</Link>
          <span>Terms</span>
          <span>Privacy</span>
          <span>Copyright &amp; takedown</span>
        </footer>
      </body>
    </html>
  );
}
