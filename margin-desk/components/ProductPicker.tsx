'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { searchBook, bookLabel } from '@/lib/catalogue';
import { money0 } from '@/lib/pricing';
import type { BookItem } from '@/lib/types';

export default function ProductPicker({ onPick }: { onPick: (item: BookItem) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const results = useMemo(() => (q.trim() ? searchBook(q).slice(0, 40) : []), [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const choose = (item: BookItem) => {
    onPick(item);
    setQ('');
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="picker" ref={box}>
      <input
        value={q}
        placeholder="Add a product — type a name, brand or segment (try “belluna” or “barber”)"
        onChange={e => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!results.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <div className="results">
          {results.map((item, i) => (
            <button
              key={bookLabel(item) + i}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
              type="button"
            >
              <span className="r-price tab">{item.r ? 'AED ' + money0(item.r) : 'on request'}</span>
              <div className="r-name">{bookLabel(item)}</div>
              <div className="r-sub">
                {[item.seg, item.cat].filter(Boolean).join(' · ')}
                {item.p ? ` · cost ${money0(item.p)}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="results"><div style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 14 }}>
          Nothing in the price book matches that.
        </div></div>
      )}
    </div>
  );
}
