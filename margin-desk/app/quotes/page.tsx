'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStore } from '@/lib/store';
import { newQuote } from '@/lib/lines';
import { money0, pct, marginBand, targetMargin } from '@/lib/pricing';
import type { QuoteSummary } from '@/lib/types';

export default function QuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<QuoteSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const store = await getStore();
      setRows(await store.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the quotes.');
      setRows([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    const q = newQuote();
    const store = await getStore();
    await store.save(q);
    router.push(`/quotes/${q.id}`);
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Delete ${label || 'this quote'}? This cannot be undone.`)) return;
    const store = await getStore();
    await store.remove(id);
    void load();
  };

  return (
    <>
      <div className="card-hd" style={{ padding: '0 0 16px' }}>
        <h2 style={{ fontSize: 24 }}>Quotes</h2>
        <button className="btn primary" onClick={create}>New quote</button>
      </div>

      {error && <p className="banner err" style={{ borderRadius: 14, marginBottom: 16 }}>{error}</p>}

      {rows === null && <div className="empty">Loading…</div>}

      {rows !== null && rows.length === 0 && (
        <div className="card">
          <div className="empty">
            No quotes yet.<br />
            Start one, add products from the price book, and the margin appears as you go.
            <div style={{ marginTop: 16 }}>
              <button className="btn primary" onClick={create}>New quote</button>
            </div>
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="qlist">
          {rows.map(r => {
            const band = marginBand(r.margin, targetMargin(70, 'margin'));
            return (
              <div className="qrow" key={r.id}>
                <div className="who">
                  <b>{r.customer || 'Untitled quote'}</b>
                  <span>
                    {r.ref ? r.ref + ' · ' : ''}
                    {r.lineCount} line{r.lineCount === 1 ? '' : 's'} · updated {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="num tab">AED {money0(r.total)}</div>
                <span className={'pill ' + (r.lineCount ? band : 'flat')}>
                  {r.lineCount ? pct(r.margin) : 'empty'}
                </span>
                <Link className="btn" href={`/quotes/${r.id}`}>Open</Link>
                <button className="btn danger" onClick={() => remove(r.id, r.customer || r.ref)}>Delete</button>
              </div>
            );
          })}
        </div>
      )}

      <p className="notes">
        <b>Cost</b> comes from the COGS list of 25 Aug 2026, and <b>retail</b> from the HBN price book of June 2026,
        where retail is ×3.5 on purchase price — a 71.4% gross margin, which is what the 70% target reflects.
        A line with no cost is left out of the totals, so a margin is never flattered by a cost that is missing.
      </p>
    </>
  );
}
