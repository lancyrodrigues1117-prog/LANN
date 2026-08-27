'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BOOK, BRANDS, CATEGORIES, bookLabel, searchBook } from '@/lib/catalogue';
import { lineFromBook, newQuote } from '@/lib/lines';
import { HOUSE_MULTIPLE, money0, pct } from '@/lib/pricing';
import { getStore } from '@/lib/store';
import type { BookItem } from '@/lib/types';

export default function PriceBookPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [brand, setBrand] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => searchBook(q, cat, brand), [q, cat, brand]);

  /* Start a quote straight from the book, which is how most of them begin. */
  const quoteThis = async (item: BookItem) => {
    if (busy) return;
    setBusy(true);
    const quote = newQuote();
    quote.lines = [lineFromBook(item)];
    (await getStore()).save(quote);
    router.push(`/quotes/${quote.id}`);
  };

  return (
    <>
      <div className="card-hd" style={{ padding: '0 0 16px' }}>
        <h2 style={{ fontSize: 24 }}>Price book</h2>
        <span className="lbl">{rows.length} of {BOOK.length} lines · June 2026</span>
      </div>

      <section className="card">
        <div className="finder">
          <label className="search">
            <span className="lbl">Find</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Product, brand or segment — try “belluna” or “barber”" autoComplete="off" />
          </label>
        </div>

        <div className="chipbar">
          <button data-on={cat === ''} onClick={() => setCat('')}>All categories</button>
          {CATEGORIES.map(c => (
            <button key={c} data-on={cat === c} onClick={() => setCat(cat === c ? '' : c)}>{c}</button>
          ))}
        </div>
        <div className="chipbar">
          <button data-on={brand === ''} onClick={() => setBrand('')}>All brands</button>
          {BRANDS.map(b => (
            <button key={b} data-on={brand === b} onClick={() => setBrand(brand === b ? '' : b)}>{b}</button>
          ))}
        </div>

        <div className="scroller">
          <table className="grid">
            <thead>
              <tr>
                <th>Product</th><th>Purchase</th><th>Retail</th><th>Margin</th><th>× cost</th><th>Fabric</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => {
                const multiple = b.p && b.r ? b.r / b.p : 0;
                const odd = multiple > 0 && Math.abs(multiple - HOUSE_MULTIPLE) > 0.02;
                return (
                  <tr key={bookLabel(b) + i}>
                    <td>
                      <div className="bk-name"><span className="brandtag">{b.b || '—'}</span>{b.n}{b.v ? ' · ' + b.v : ''}</div>
                      <div className="bk-sub">{[b.seg, b.cat].filter(Boolean).join(' · ')}</div>
                      {b.d && <div className="bk-desc">{b.d}</div>}
                    </td>
                    <td className="tab">{b.p ? money0(b.p) : '—'}</td>
                    <td className="tab" style={{ fontWeight: 600 }}>{b.r ? money0(b.r) : 'on request'}</td>
                    <td>{b.p && b.r ? <span className={'pill ' + (odd ? 'warn' : 'good')}>{pct((b.r - b.p) / b.r, 0)}</span> : '—'}</td>
                    <td className="tab" style={odd ? { color: 'var(--amber)' } : undefined}
                        title={odd ? 'Off the house ×3.5 — shown exactly as the source sheet has it' : undefined}>
                      {multiple ? '×' + multiple.toFixed(2) : '—'}
                    </td>
                    <td className="tab">{b.f ? '+' + money0(b.f) : '—'}</td>
                    <td><button className="btn" onClick={() => quoteThis(b)}>Quote this</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && <div className="empty">Nothing matches that search.</div>}
      </section>

      <p className="notes">
        <b>{BOOK.length} lines from the June 2026 price book</b>, across chairs, wash units, pedicure and manicure,
        beds, mirrors, and tools and accessories. A product sold in variants — chrome or black base, with or without
        legrest — is listed once per variant at that variant&rsquo;s own price.
        <b> Retail is ×3.5 on purchase</b> on every line but three: the BUCE S270F, S370F and S274F wash units each sit
        about AED 8,000 above their ×3.5 figure in the source sheet. They are shown exactly as the sheet has them and
        flagged in the × cost column, which is worth checking.
        <b> Fabric</b> is the Valencia upholstery upcharge where the sheet lists one.
      </p>
    </>
  );
}
