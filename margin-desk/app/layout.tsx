import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'HBN Margin Desk',
  description: 'Price book, quotes and margin for the HBN sales team.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}
