'use client';

import { useEffect, useRef, useState } from 'react';
import { ask, SUGGESTIONS, type Block } from '@/lib/advisor';
import { money0, pct, requiredRevenue, targetLabel, targetMargin, totals } from '@/lib/pricing';
import type { Quote, TargetMode } from '@/lib/types';

interface Turn { me: string | null; blocks: Block[] }

const MODES: { mode: TargetMode; label: string }[] = [
  { mode: 'margin', label: 'Margin %' },
  { mode: 'markup', label: 'Markup %' },
  { mode: 'multiple', label: '× cost' },
];

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="msg">
      {blocks.map((b, i) => {
        if (b.kind === 'lead') return <p className="lead" key={i}>{b.text}</p>;
        if (b.kind === 'text') return <p className="body" key={i}>{b.text}</p>;
        if (b.kind === 'formula') return <div className="formula" key={i}>{b.text}</div>;
        return (
          <table className="mini" key={i}>
            <thead><tr>{b.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
          </table>
        );
      })}
    </div>
  );
}

export default function Advisor({
  quote, onTarget,
}: {
  quote: Quote;
  onTarget: (target: number, mode: TargetMode) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([{
    me: null,
    blocks: [
      { kind: 'lead', text: 'Margin desk ready.' },
      { kind: 'text', text: 'Add products and ask me anything with a number in it — target margins, discounts, where to move price, a price-book lookup, or plain arithmetic.' },
    ],
  }]);
  const [input, setInput] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = log.current, last = lastTurn.current;
    if (!el || !last) return;
    // an answer is read from its first line, so park the top of it at the top
    if (last.getBoundingClientRect().height > el.clientHeight - 40) {
      el.scrollTop += last.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setTurns(t => [...t, { me: q, blocks: ask(q, quote) }]);
    setInput('');
  };

  const t = totals(quote.lines);
  const m = targetMargin(quote.target, quote.targetMode);
  const need = requiredRevenue(t.cost, m);
  const gap = need - t.revenue;
  const noCost = t.cost === 0 && t.uncosted > 0;
  const step = quote.targetMode === 'multiple' ? 0.1 : 1;

  const setMode = (mode: TargetMode) => {
    if (mode === quote.targetMode) return;
    const keep = m;
    let v: number;
    if (keep > 0 && keep < 1) {
      v = mode === 'margin' ? keep * 100 : mode === 'markup' ? (keep / (1 - keep)) * 100 : 1 / (1 - keep);
    } else {
      v = mode === 'margin' ? 70 : mode === 'markup' ? 250 : 3.5;
    }
    onTarget(Math.round(v * 100) / 100, mode);
  };

  return (
    <aside className="card desk">
      <div className="desk-hd">
        <h2>Margin advisor</h2>
        <p>Ask anything with a number in it. Every answer shows its working.</p>
      </div>

      <div className="tgt">
        <div className="tgt-row">
          <span className="lbl">Target</span>
          <div className="stepper">
            <button type="button" aria-label="Lower target" onClick={() => onTarget(Math.max(0, Math.round((quote.target - step) * 100) / 100), quote.targetMode)}>−</button>
            <input
              className="tab"
              value={quote.target}
              inputMode="decimal"
              aria-label="Target"
              onChange={e => {
                const v = parseFloat(e.target.value);
                onTarget(isFinite(v) ? v : 0, quote.targetMode);
              }}
            />
            <button type="button" aria-label="Raise target" onClick={() => onTarget(Math.round((quote.target + step) * 100) / 100, quote.targetMode)}>+</button>
          </div>
          <div className="seg">
            {MODES.map(x => (
              <button key={x.mode} type="button" data-on={quote.targetMode === x.mode} onClick={() => setMode(x.mode)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <p className="gap-read">
          {!quote.lines.length || t.revenue <= 0 ? (
            <span className="note">Add a product to see the gap to target.</span>
          ) : noCost ? (
            <>
              <span className="big">No cost yet</span>
              <span className="note">Nothing here is matched to a cost, so there is no margin to measure.</span>
            </>
          ) : gap > 0.5 ? (
            <>
              <span className="big up">Short AED {money0(gap)}</span>
              <span className="note">
                The quote needs to be AED {money0(need)} for {targetLabel(quote.target, quote.targetMode)}.
                You are at AED {money0(t.revenue)} — that is +{pct(gap / t.revenue)} across the quote.
              </span>
            </>
          ) : (
            <>
              <span className="big ok">Clear by AED {money0(-gap)}</span>
              <span className="note">
                {targetLabel(quote.target, quote.targetMode)} needs AED {money0(need)} and you are quoting AED {money0(t.revenue)}.
                Room to discount {pct(-gap / t.revenue)}.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="log" ref={log}>
        {turns.map((turn, i) => (
          <div key={i} ref={i === turns.length - 1 ? lastTurn : undefined}>
            {turn.me && <div className="msg me" style={{ marginBottom: 14 }}>{turn.me}</div>}
            <Blocks blocks={turn.blocks} />
          </div>
        ))}
      </div>

      <form className="ask" onSubmit={e => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="If I charge 70%, where do I add?" />
        <button type="submit">Ask</button>
      </form>

      <div className="chips">
        {SUGGESTIONS.map(s => (
          <button key={s} type="button" onClick={() => send(s)}>{s}</button>
        ))}
      </div>
    </aside>
  );
}
