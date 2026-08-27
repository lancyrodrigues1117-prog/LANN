'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Advisor from '@/components/Advisor';
import ProductPicker from '@/components/ProductPicker';
import { bookByKey, bookLabel } from '@/lib/catalogue';
import { blankLine, costSourceLabel, lineFromBook, lineFromName, newId } from '@/lib/lines';
import { readPdf } from '@/lib/pdf';
import { marginBand, money0, offRetailBand, pct, targetMargin, totals } from '@/lib/pricing';
import { parseQuoteLines, parseQuoteMeta } from '@/lib/quote-parse';
import { getStore } from '@/lib/store';
import type { BookItem, Quote, QuoteLine, TargetMode } from '@/lib/types';

export default function QuotePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState('');
  const [statusKind, setStatusKind] = useState<'' | 'err'>('');
  const [paste, setPaste] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const store = await getStore();
      const q = await store.get(id);
      if (!q) { setMissing(true); return; }
      setQuote(q);
    })();
  }, [id]);

  /* autosave, debounced so typing does not hammer the store */
  const edit = useCallback((fn: (q: Quote) => Quote) => {
    setQuote(prev => {
      if (!prev) return prev;
      const next = { ...fn(prev), updatedAt: new Date().toISOString() };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try { (await getStore()).save(next); } catch { /* keep editing */ }
      }, 400);
      return next;
    });
  }, []);

  const setLines = (fn: (lines: QuoteLine[]) => QuoteLine[]) => edit(q => ({ ...q, lines: fn(q.lines) }));
  const patchLine = (lineId: string, patch: Partial<QuoteLine>) =>
    setLines(ls => ls.map(l => (l.id === lineId ? { ...l, ...patch } : l)));

  const addBook = (item: BookItem) => {
    setLines(ls => [...ls, lineFromBook(item)]);
    setStatus(`Added ${bookLabel(item)}.`);
    setStatusKind('');
  };

  const importPdf = async (f: File | undefined) => {
    if (!f) return;
    setStatus(`Reading ${f.name}…`); setStatusKind('');
    try {
      const read = await readPdf(await f.arrayBuffer());
      const parsed = parseQuoteLines(read.lines);
      if (!parsed.length) {
        setStatusKind('err');
        if (read.encrypted && !read.chars) {
          setStatus('That PDF is encrypted, which some Zoho exports are. Open it, print it to PDF again, and drop that copy — or paste the lines below.');
        } else if (!read.textStreams || !read.chars) {
          setStatus(`No text inside that PDF — ${read.objects} objects, ${read.streams} streams, none of them text. It is a scan or an image export. Paste the lines below instead.`);
        } else {
          setStatus(`Read ${read.lines.length} lines of text, but none looked like an item line with a quantity and a price. The text is in the box below — fix it and press Read.`);
          setPaste(read.lines.join('\n'));
        }
        setPasteOpen(true);
        return;
      }
      const meta = parseQuoteMeta(read.lines);
      const lines = parsed.map(p => lineFromName(p.name, p.qty, p.price));
      edit(q => ({
        ...q,
        ref: q.ref || meta.ref,
        customer: q.customer || meta.customer,
        lines: [...q.lines, ...lines],
      }));
      const costed = lines.filter(l => l.cost > 0).length;
      const priced = lines.filter(l => l.retail > 0).length;
      setStatus(`Read ${lines.length} line(s) from ${f.name} · ${costed} costed · ${priced} matched to the price book`);
      setStatusKind('');
    } catch {
      setStatusKind('err');
      setStatus('That PDF could not be read in the browser. Paste the lines below instead.');
      setPasteOpen(true);
    }
  };

  const readPaste = () => {
    const parsed = parseQuoteLines(paste.split(/\r?\n/).map(l => l.replace(/\t/g, '  ')));
    if (!parsed.length) {
      setStatusKind('err');
      setStatus('No item lines in that text. Each line needs a name, a quantity and a price.');
      return;
    }
    setLines(ls => [...ls, ...parsed.map(p => lineFromName(p.name, p.qty, p.price))]);
    setStatus(`Added ${parsed.length} line(s) from the pasted text.`);
    setStatusKind('');
    setPaste('');
    setPasteOpen(false);
  };

  const duplicate = async () => {
    if (!quote) return;
    const copy: Quote = {
      ...quote,
      id: newId(),
      ref: quote.ref ? quote.ref + ' (copy)' : '',
      lines: quote.lines.map(l => ({ ...l, id: newId() })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (await getStore()).save(copy);
    router.push(`/quotes/${copy.id}`);
  };

  const exportCsv = () => {
    if (!quote) return;
    const t = totals(quote.lines);
    const esc = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows: (string | number)[][] = [[
      'Item', 'Price-book item', 'Cost source', 'Qty', 'Retail', 'Quoted',
      'Off retail %', 'Line total', 'Unit cost', 'Line cost', 'Gross profit', 'Margin %',
    ]];
    quote.lines.forEach(l => {
      const rev = l.qty * l.price, cost = l.qty * l.cost;
      rows.push([
        l.name, bookByKey(l.bookKey) ? bookLabel(bookByKey(l.bookKey)!) : '', costSourceLabel[l.costSource],
        l.qty, l.retail ? l.retail.toFixed(2) : '', l.price.toFixed(2),
        l.retail ? (((l.retail - l.price) / l.retail) * 100).toFixed(1) : '',
        rev.toFixed(2), l.cost.toFixed(2), cost.toFixed(2), (rev - cost).toFixed(2),
        rev > 0 ? (((rev - cost) / rev) * 100).toFixed(1) : '',
      ]);
    });
    rows.push([]);
    rows.push(['TOTAL', '', '', '', t.retail.toFixed(2), '', t.retail ? (t.offRetail * 100).toFixed(1) : '',
      t.revenue.toFixed(2), '', t.cost.toFixed(2), t.profit.toFixed(2), (t.margin * 100).toFixed(1)]);
    const csv = rows.map(r => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quote.ref || 'quote'}-margin.csv`.replace(/[^\w.\-]+/g, '-');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (missing) {
    return (
      <div className="card"><div className="empty">
        That quote is not here.<br /><Link href="/quotes">Back to quotes</Link>
      </div></div>
    );
  }
  if (!quote) return <div className="empty">Loading…</div>;

  const t = totals(quote.lines);
  const target = targetMargin(quote.target, quote.targetMode);
  const noCost = t.cost === 0 && t.uncosted > 0;
  const unsure = quote.lines.filter(l => l.note).length;

  return (
    <>
      <div className="card-hd" style={{ padding: '0 0 16px' }}>
        <h2 style={{ fontSize: 24 }}>{quote.customer || 'New quote'}</h2>
        <div className="row">
          <Link className="btn" href="/quotes">All quotes</Link>
          <button className="btn" onClick={duplicate}>Duplicate</button>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
          <button className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <div className="shell">
        <div className="col">
          <section className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
              <label className="field">
                <span className="lbl">Customer</span>
                <input value={quote.customer} onChange={e => edit(q => ({ ...q, customer: e.target.value }))} placeholder="Salon name" />
              </label>
              <label className="field">
                <span className="lbl">Quote ref</span>
                <input value={quote.ref} onChange={e => edit(q => ({ ...q, ref: e.target.value }))} placeholder="Q-0000" />
              </label>
              <label className="field">
                <span className="lbl">Salesperson</span>
                <input value={quote.salesperson} onChange={e => edit(q => ({ ...q, salesperson: e.target.value }))} placeholder="Name" />
              </label>
            </div>

            <ProductPicker onPick={addBook} />

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => file.current?.click()}>Import a Zoho PDF</button>
              <button className="btn" onClick={() => setPasteOpen(o => !o)}>Paste quote text</button>
              <button className="btn" onClick={() => setLines(ls => [...ls, blankLine()])}>Blank line</button>
              <input ref={file} type="file" accept="application/pdf,.pdf" hidden
                     onChange={e => { void importPdf(e.target.files?.[0]); e.target.value = ''; }} />
            </div>

            {pasteOpen && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  className="field"
                  style={{ width: '100%', minHeight: 130, background: 'var(--fill)', border: '1px solid var(--hair)', borderRadius: 14, padding: '12px 14px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}
                  value={paste}
                  onChange={e => setPaste(e.target.value)}
                  placeholder={'PR-Nelson-Stool-Iron   4   1,450.00   5,800.00\nACC-Buce-Headrest   6   140.00   840.00'}
                />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn primary" onClick={readPaste}>Read these lines</button>
                </div>
              </div>
            )}

            {status && <p style={{ marginTop: 12, fontSize: 13, color: statusKind === 'err' ? 'var(--red)' : 'var(--muted)' }}>{status}</p>}
          </section>

          <div className="stats">
            <div className="stat">
              <div className="k">Quoted to client</div>
              <div className="v tab">{money0(t.revenue)}</div>
              <div className="n">{quote.lines.length} line{quote.lines.length === 1 ? '' : 's'}</div>
            </div>
            <div className="stat">
              <div className="k">At price-book retail</div>
              <div className="v tab">{t.retail > 0 ? money0(t.retail) : '—'}</div>
              <div className="n">
                {t.retail > 0
                  ? `${t.offRetail > 0.0001 ? pct(t.offRetail) + ' below' : t.offRetail < -0.0001 ? pct(-t.offRetail) + ' above' : 'at'} retail`
                  : 'no book match yet'}
              </div>
            </div>
            <div className="stat">
              <div className="k">Our cost</div>
              <div className="v tab">{money0(t.cost)}</div>
              <div className="n">COGS list</div>
            </div>
            <div className="stat">
              <div className="k">Gross profit</div>
              <div className="v tab">{noCost ? '—' : money0(t.profit)}</div>
              <div className="n">{noCost ? 'no cost on any line' : `×${t.multiple.toFixed(2)} on cost`}</div>
            </div>
            <div className="stat hero">
              <div className="k">Gross margin</div>
              <div className={'v tab ' + (t.revenue > 0 && !noCost ? marginBand(t.margin, target) : '')}>
                {t.revenue > 0 && !noCost ? pct(t.margin) : '—'}
              </div>
              <div className="n">Target {quote.target}{quote.targetMode === 'multiple' ? '× cost' : quote.targetMode === 'markup' ? '% markup' : '% margin'}</div>
              <div className="meter"><i style={{ width: noCost ? 0 : Math.max(0, Math.min(100, t.margin * 100)) + '%', background: t.revenue > 0 && !noCost ? `var(--${{ good: 'green', warn: 'amber', bad: 'red' }[marginBand(t.margin, target)]})` : 'var(--sep)' }} /></div>
            </div>
          </div>

          <section className="card">
            <div className="card-hd">
              <h2>Line items</h2>
              <span className="lbl">{quote.lines.length} line{quote.lines.length === 1 ? '' : 's'}</span>
            </div>

            {(t.uncosted > 0 || unsure > 0) && (
              <p className="banner">
                {t.uncosted > 0 && (
                  <><b>{t.uncosted} line{t.uncosted === 1 ? ' has' : 's have'} no cost. </b>
                  They are left out of cost and profit, so the real margin is lower than shown. Type the cost in. </>
                )}
                {unsure > 0 && <><b>{unsure} price-book match to check. </b>The name only partly matched.</>}
              </p>
            )}

            <div className="scroller">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Item</th><th>Qty</th><th>Retail</th><th>Quoted</th><th>Off retail</th>
                    <th>Total</th><th>Cost</th><th>Profit</th><th>Margin</th><th />
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map(l => {
                    const rev = l.qty * l.price;
                    const profit = rev - l.qty * l.cost;
                    const m = rev > 0 ? profit / rev : 0;
                    const off = l.retail > 0 ? (l.retail - l.price) / l.retail : 0;
                    return (
                      <tr key={l.id}>
                        <td>
                          <input
                            className="cell name"
                            value={l.name}
                            placeholder="Item name"
                            onChange={e => patchLine(l.id, { name: e.target.value })}
                          />
                          <div className="imeta">
                            <span className={'tag ' + l.costSource}>{costSourceLabel[l.costSource]}</span>
                            {l.bookKey && <span className="sub" title={bookLabel(bookByKey(l.bookKey)!)}>{bookLabel(bookByKey(l.bookKey)!)}</span>}
                            {l.note && <span className="tag inventory">{l.note}</span>}
                          </div>
                        </td>
                        <td><input className="cell qty" type="number" min={0} step={1} value={l.qty}
                                   onChange={e => patchLine(l.id, { qty: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                        <td><input className="cell" type="number" min={0} step={0.01} value={l.retail || ''} placeholder="—"
                                   onChange={e => patchLine(l.id, { retail: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                        <td><input className="cell" type="number" min={0} step={0.01} value={l.price}
                                   onChange={e => patchLine(l.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })} /></td>
                        <td>{l.retail > 0
                          ? <span className={'pill ' + offRetailBand(off)}>{off > 0.0001 ? '−' + pct(off, 0) : off < -0.0001 ? '+' + pct(-off, 0) : 'at retail'}</span>
                          : '—'}</td>
                        <td className="tab" style={{ fontWeight: 600 }}>{money0(rev)}</td>
                        <td><input className="cell" type="number" min={0} step={0.01} value={l.cost || ''} placeholder="—"
                                   onChange={e => patchLine(l.id, { cost: Math.max(0, parseFloat(e.target.value) || 0), costSource: 'manual' })} /></td>
                        <td className="tab">{l.cost > 0 ? money0(profit) : '—'}</td>
                        <td>{l.cost > 0
                          ? (rev > 0
                            ? <span className={'pill ' + marginBand(m, target)}>{pct(m, 0)}</span>
                            : <span className="pill bad" title="Given away: cost with no revenue">free</span>)
                          : '—'}</td>
                        <td><button className="kill" title="Remove line" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
                {quote.lines.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>Total</td><td />
                      <td className="tab">{t.retail > 0 ? money0(t.retail) : '—'}</td>
                      <td />
                      <td>{t.retail > 0 ? <span className={'pill ' + offRetailBand(t.offRetail)}>{t.offRetail > 0.0001 ? '−' + pct(t.offRetail, 0) : 'at retail'}</span> : '—'}</td>
                      <td className="tab">{money0(t.revenue)}</td>
                      <td />
                      <td className="tab">{noCost ? '—' : money0(t.profit)}</td>
                      <td>{t.revenue > 0 && !noCost ? <span className={'pill ' + marginBand(t.margin, target)}>{pct(t.margin)}</span> : '—'}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {quote.lines.length === 0 && (
              <div className="empty">Search the price book above and add the first product.</div>
            )}
          </section>

          <label className="field">
            <span className="lbl">Notes</span>
            <textarea
              value={quote.notes}
              onChange={e => edit(q => ({ ...q, notes: e.target.value }))}
              placeholder="Delivery, payment terms, anything the quote needs to say"
              style={{ minHeight: 80, background: 'var(--fill)', border: '1px solid transparent', borderRadius: 11, padding: '9px 12px', fontSize: 14.5 }}
            />
          </label>
        </div>

        <Advisor quote={quote} onTarget={(target, mode) => edit(q => ({ ...q, target, targetMode: mode as TargetMode }))} />
      </div>
    </>
  );
}
