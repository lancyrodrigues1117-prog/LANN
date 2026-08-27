'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { storeKind } from '@/lib/store';

const LINKS = [
  { href: '/quotes', label: 'Quotes' },
  { href: '/price-book', label: 'Price book' },
];

export default function Nav() {
  const path = usePathname() || '';
  const kind = storeKind();
  return (
    <nav className="nav">
      <div className="brand">HBN <span>Margin Desk</span></div>
      <div className="tabs">
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} data-active={path.startsWith(l.href)}>{l.label}</Link>
        ))}
      </div>
      <div className="badge" title={kind === 'supabase'
        ? 'Quotes are stored in Supabase and shared by everyone on this deployment.'
        : 'Quotes are stored in this browser only. Set the Supabase variables to share them.'}>
        <span className={'dot' + (kind === 'local' ? ' local' : '')} />
        {kind === 'supabase' ? 'Supabase' : 'This browser'}
      </div>
    </nav>
  );
}
