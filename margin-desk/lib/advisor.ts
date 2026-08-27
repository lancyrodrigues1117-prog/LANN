import { BOOK, bookLabel, toks } from './catalogue';
import { matchBook } from './match';
import {
  HOUSE_MARGIN, HOUSE_MULTIPLE, money, money0, pct,
  priceForMargin, requiredRevenue, targetLabel, targetMargin, totals,
} from './pricing';
import type { Quote, QuoteLine } from './types';

export type Block =
  | { kind: 'lead'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'formula'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] };

const lead = (text: string): Block => ({ kind: 'lead', text });
const text = (t: string): Block => ({ kind: 'text', text: t });
const formula = (t: string): Block => ({ kind: 'formula', text: t });

/* ---------- arithmetic ---------- */

export function evaluate(src: string): { value: number; expr: string } | null {
  const s = src.toLowerCase()
    .replace(/\b(aed|dhs|dirhams?)\b/g, '')
    .replace(/(\d[\d,]*\.?\d*)\s*%\s*of\s*/g, '($1/100)*')
    .replace(/,/g, '')
    .replace(/(\d+\.?\d*)\s*%/g, '($1/100)')
    .replace(/[x×]/g, '*').replace(/÷/g, '/')
    .replace(/[^0-9+\-*/().\s]/g, '');
  if (!/\d/.test(s) || !/[+\-*/]/.test(s)) return null;
  let i = 0;
  const ws = () => { while (s[i] === ' ') i++; };
  const prim = (): number => {
    ws();
    if (s[i] === '(') { i++; const v = expr(); ws(); if (s[i] === ')') i++; return v; }
    let j = i;
    while (j < s.length && /[\d.]/.test(s[j])) j++;
    if (j === i) { i++; return NaN; }
    const v = parseFloat(s.slice(i, j)); i = j; return v;
  };
  const unary = (): number => { ws(); if (s[i] === '-') { i++; return -unary(); } if (s[i] === '+') { i++; return unary(); } return prim(); };
  const term = (): number => {
    let v = unary();
    for (;;) { ws(); if (s[i] === '*') { i++; v *= unary(); } else if (s[i] === '/') { i++; const d = unary(); v = d === 0 ? NaN : v / d; } else return v; }
  };
  const expr = (): number => {
    let v = term();
    for (;;) { ws(); if (s[i] === '+') { i++; v += term(); } else if (s[i] === '-') { i++; v -= term(); } else return v; }
  };
  const value = expr();
  return isFinite(value) ? { value, expr: s.replace(/\s+/g, ' ').trim() } : null;
}

const askedPercent = (q: string): number | null => {
  let m = /(\d+(?:\.\d+)?)\s*(?:%|percent|per cent|pc\b)/.exec(q);
  if (m) return parseFloat(m[1]);
  m = /\b(?:at|hit|reach|make|charge|want|need)\s+(\d{1,2}(?:\.\d+)?)\b(?!\s*(?:aed|dhs|k\b))/.exec(q);
  return m ? parseFloat(m[1]) : null;
};
const askedAmount = (q: string): number | null => {
  const m = /(?:aed|dhs)?\s*([\d,]+(?:\.\d+)?)\s*(?:aed|dhs|off|discount)/.exec(q);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
};
const marginFrom = (v: number, mode: 'margin' | 'markup') => {
  const t = v / 100;
  return mode === 'margin' ? t : t / (1 + t);
};

/* ---------- plans ---------- */

interface Move { line: QuoteLine; now: number; next: number }

function planToRetail(lines: QuoteLine[], need: number) {
  const rows: Move[] = lines.map(l => ({ line: l, now: l.qty * l.price, next: l.qty * l.price }));
  const caps = new Map(rows.map(r => [r.line.id, r.line.retail > 0 ? r.line.qty * r.line.retail : r.now]));
  let remain = need - rows.reduce((s, r) => s + r.now, 0);
  [...rows].sort((a, b) => (caps.get(b.line.id)! - b.now) - (caps.get(a.line.id)! - a.now)).forEach(r => {
    if (remain <= 0.01) return;
    const take = Math.min(Math.max(0, caps.get(r.line.id)! - r.now), remain);
    r.next = r.now + take; remain -= take;
  });
  return { rows, short: Math.max(0, remain) };
}

function planWeakestFirst(lines: QuoteLine[], need: number, m: number) {
  const rows = lines.map(l => ({
    line: l, now: l.qty * l.price, next: l.qty * l.price,
    cap: l.cost > 0 ? priceForMargin(l.cost, m) * l.qty : l.qty * l.price,
    margin: l.price > 0 ? (l.price - l.cost) / l.price : 0,
  }));
  rows.sort((a, b) => a.margin - b.margin);
  let remain = need - rows.reduce((s, r) => s + r.now, 0);
  rows.forEach(r => {
    if (remain <= 0.01) return;
    const take = Math.min(Math.max(0, r.cap - r.now), remain);
    r.next = r.now + take; remain -= take;
  });
  return { rows: rows as Move[], short: Math.max(0, remain) };
}

function moveTable(rows: Move[], limit = 6): { block: Block | null; more: number } {
  const moved = rows.filter(r => r.next - r.now > 0.5).sort((a, b) => (b.next - b.now) - (a.next - a.now));
  const shown = moved.slice(0, limit);
  if (!shown.length) return { block: null, more: 0 };
  return {
    block: {
      kind: 'table',
      head: ['Line', 'Now', 'New', 'Move'],
      rows: shown.map(r => [r.line.name, money0(r.now), money0(r.next), '+' + pct((r.next - r.now) / r.now, 0)]),
    },
    more: moved.length - shown.length,
  };
}

/* ---------- the desk ---------- */

export const SUGGESTIONS = [
  'if I charge the client 70%, where should I add more?',
  'what margin am I at?',
  'how far below retail am I?',
  'what if I give 8% discount?',
  'which lines are below target?',
  'what is the retail of the Belluna wash?',
];

function bookLookup(q: string): Block[] | null {
  const words = toks(q).filter(w => w.length > 2);
  if (!words.length) return null;
  const hit = matchBook('BRAND ' + q) ?? null;
  // matchBook needs a brand in the string; fall back to a direct name search
  const direct = BOOK.filter(b => {
    const name = toks(b.n);
    return name.length && name.every(t => words.includes(t));
  });
  const family = direct.length ? direct : (hit ? BOOK.filter(b => b.n === hit.item.n && b.b === hit.item.b) : []);
  if (!family.length) return null;
  const first = family[0];
  return [
    lead(`${first.b} ${first.n}${family.length > 1 ? ` — ${family.length} variants` : ''}`),
    {
      kind: 'table',
      head: ['Variant', 'Purchase', 'Retail', 'Margin'],
      rows: family.map(f => [
        f.v || f.seg || 'standard',
        f.p ? money0(f.p) : '—',
        f.r ? money0(f.r) : 'on request',
        f.p && f.r ? pct((f.r - f.p) / f.r, 0) : '—',
      ]),
    },
    ...(first.d ? [text(first.d)] : []),
    ...(first.f ? [text(`Valencia fabric adds AED ${money0(first.f)} to the purchase price.`)] : []),
    formula(`house rule: retail = purchase × ${HOUSE_MULTIPLE} → margin ${pct(HOUSE_MARGIN)}`),
  ];
}

export function ask(question: string, quote: Quote): Block[] {
  const q = question.toLowerCase().replace(/\s+/g, ' ').trim();
  const t = totals(quote.lines);
  const loaded = quote.lines.length > 0 && t.revenue > 0;

  if (/^[\d\s.,+\-*/()%x×÷]+$/.test(q) || /^(what(?:'s| is)|calculate|compute|=)\s*[\d(]/.test(q)) {
    const r = evaluate(q);
    if (r) return [lead(money(r.value)), formula(`${r.expr} = ${money(r.value)}`)];
  }

  if (/retail|price book|book price|list price|how much|purchase price/.test(q)) {
    const blocks = bookLookup(q);
    if (blocks && !loaded) return blocks;
    if (blocks && !/quote|this|my|we/.test(q)) return blocks;
  }

  if (!loaded) {
    return [
      lead('Nothing on this quote yet.'),
      text('Add a product, or import a Zoho PDF, and I will cost every line. I can look anything up in the price book meanwhile, and plain arithmetic works too.'),
    ];
  }

  const pct0 = askedPercent(q);
  const mode: 'margin' | 'markup' = /mark ?up/.test(q) ? 'markup' : 'margin';
  const m = pct0 !== null ? marginFrom(pct0, mode) : targetMargin(quote.target, quote.targetMode);
  const label = pct0 !== null ? `${pct0}% ${mode}` : targetLabel(quote.target, quote.targetMode);
  const need = requiredRevenue(t.cost, m);
  const gap = need - t.revenue;
  const ambiguity: Block[] = (pct0 !== null && mode === 'margin' && !/margin/.test(q))
    ? [text(`Read as gross margin, which is how the price book works — retail is ×${HOUSE_MULTIPLE} on cost, a ${pct(HOUSE_MARGIN)} margin. If you meant ${pct0}% markup on cost, that is ${pct(marginFrom(pct0, 'markup'))} margin; say "markup" and I will redo it.`)]
    : [];
  const uncosted: Block[] = t.uncosted > 0
    ? [text(`${t.uncosted} line(s) still have no cost, so these figures flatter the quote until you fill them in.`)]
    : [];

  /* off retail */
  if (/retail|book/.test(q) && !/where|add more/.test(q)) {
    if (t.retail <= 0) {
      return [lead('None of these lines has a price-book retail.'), text('Open the price book and add the products from there, or set the retail on the line.')];
    }
    const below = quote.lines.filter(l => l.retail > 0 && l.price < l.retail - 0.01)
      .map(l => ({ l, off: (l.retail - l.price) / l.retail }))
      .sort((a, b) => b.off - a.off);
    const atRetail = quote.lines.reduce((s, l) => s + l.qty * (l.retail > 0 ? l.retail : l.price), 0);
    const atRetailMargin = atRetail > 0 ? (atRetail - t.cost) / atRetail : 0;
    return [
      lead(t.offRetail > 0.0001 ? `${pct(t.offRetail)} below price-book retail.` : t.offRetail < -0.0001 ? `${pct(-t.offRetail)} above retail.` : 'Quoted exactly at retail.'),
      text(`At book retail the matched lines come to AED ${money0(t.retail)}, and you are quoting AED ${money0(t.retailQuoted)} for them — AED ${money0(t.retail - t.retailQuoted)} of difference. Priced at retail throughout, the whole quote would run ${pct(atRetailMargin)} against ${pct(t.margin)} now.`),
      ...(below.length ? [{
        kind: 'table' as const,
        head: ['Line', 'Retail', 'Quoted', 'Off'],
        rows: below.slice(0, 7).map(r => [r.l.name, money0(r.l.retail), money0(r.l.price), '−' + pct(r.off, 0)]),
      }] : [text('No line is below its retail price.')]),
      formula(`off retail = (retail − quoted) ÷ retail = (${money0(t.retail)} − ${money0(t.retailQuoted)}) ÷ ${money0(t.retail)} = ${pct(t.offRetail)}`),
    ];
  }

  /* where to add */
  if (/where|which line|which item|add more|add on|increase|bump|push|top up|make up|adjust/.test(q)
      && !/below|weak|worst|thin|losing|loss\b/.test(q)
      && (pct0 !== null || /target/.test(q))) {
    if (gap <= 0.5) {
      return [
        lead(`Nothing to add — you are already at ${pct(t.margin)}.`),
        text(`At ${label} the quote only needs AED ${money0(need)} and you are quoting AED ${money0(t.revenue)}, so there is AED ${money0(-gap)} of room (${pct(-gap / t.revenue)}) before you drop below target.`),
        ...ambiguity,
      ];
    }
    const blocks: Block[] = [lead(`Short by AED ${money0(gap)} to reach ${label}.`)];
    const retailRoom = Math.max(0, t.retail - t.retailQuoted);
    if (retailRoom > 1) {
      const plan = planToRetail(quote.lines, need);
      const tbl = moveTable(plan.rows);
      blocks.push(text(`Start with the price book — this is company price, so it needs no argument. Bringing these lines back to book retail adds AED ${money0(Math.min(retailRoom, gap))}${retailRoom >= gap ? ', which covers the whole gap.' : '.'}`));
      if (tbl.block) blocks.push(tbl.block);
      if (tbl.more > 0) blocks.push(text(`…and ${tbl.more} more line(s) in the same plan.`));
      if (plan.short > 1) blocks.push(text(`Even at full book retail you would still be AED ${money0(plan.short)} short. The rest has to come from pricing above book, or from lines with no book price.`));
    } else {
      const plan = planWeakestFirst(quote.lines, need, m);
      const tbl = moveTable(plan.rows);
      blocks.push(text(`Every matched line is already at or above book retail, so the gap has to come from the thin lines — raising these to ${pct(m)} each covers it.`));
      if (tbl.block) blocks.push(tbl.block); else blocks.push(text('No line has room to move at that target.'));
      if (plan.short > 1) blocks.push(text(`AED ${money0(plan.short)} of the gap cannot be placed — those lines have no cost on file.`));
    }
    blocks.push(text(`The even alternative: multiply every line by ${(need / t.revenue).toFixed(4)} (+${pct(need / t.revenue - 1)} across the board).`));
    blocks.push(formula(`need = cost ÷ (1 − margin) = ${money0(t.cost)} ÷ ${(1 - m).toFixed(4)} = ${money0(need)}\ngap  = need − quoted = ${money0(need)} − ${money0(t.revenue)} = ${money0(gap)}`));
    return [...blocks, ...ambiguity, ...uncosted];
  }

  /* discount */
  if (/discount|reduce|drop|lower|cut|off\b|nego/.test(q)) {
    const pctIsTarget = pct0 !== null && /(stay|keep|hold|maintain|remain)\b|margin|mark ?up|target/.test(q);
    const tgt = pctIsTarget ? m : targetMargin(quote.target, quote.targetMode);
    const floor = requiredRevenue(t.cost, tgt);
    const floorLabel = pctIsTarget ? label : targetLabel(quote.target, quote.targetMode);
    const room = t.revenue - floor;
    const amount = askedAmount(q);
    const dp = pct0 !== null && !pctIsTarget ? pct0 / 100 : null;
    if (dp !== null || amount !== null) {
      const rev = dp !== null ? t.revenue * (1 - dp) : t.revenue - (amount as number);
      const nm = rev > 0 ? (rev - t.cost) / rev : 0;
      return [
        lead(`${dp !== null ? pct(dp, 0) + ' off' : 'AED ' + money0(amount as number) + ' off'} → margin ${pct(nm)}, from ${pct(t.margin)}.`),
        text(`The quote drops to AED ${money0(rev)} against AED ${money0(t.cost)} of cost, so gross profit is AED ${money0(rev - t.cost)}.`),
        text(room > 0
          ? `Your floor at ${floorLabel} is AED ${money0(floor)}, so the most you can give away is AED ${money0(room)} (${pct(room / t.revenue)}).`
          : `You are already AED ${money0(-room)} below the ${floorLabel} floor of AED ${money0(floor)}, so any discount takes it further under target.`),
        formula(`margin = (quote − cost) ÷ quote = (${money0(rev)} − ${money0(t.cost)}) ÷ ${money0(rev)} = ${pct(nm)}`),
      ];
    }
    return [
      lead(room > 0 ? `You can give up to AED ${money0(room)} — ${pct(room / t.revenue)}.` : `No discount room: the quote is already under ${floorLabel}.`),
      text(room > 0
        ? `That holds ${floorLabel} exactly: floor AED ${money0(floor)} against AED ${money0(t.cost)} of cost.`
        : `To sit at ${floorLabel} the quote would have to be AED ${money0(floor)} and you are quoting AED ${money0(t.revenue)}. Raise it by AED ${money0(-room)} before you talk about discount.`),
      formula(`floor = cost ÷ (1 − margin) = ${money0(t.cost)} ÷ ${(1 - tgt).toFixed(4)} = ${money0(floor)}\nroom  = quoted − floor = ${money0(t.revenue)} − ${money0(floor)} = ${money0(room)}`),
      ...ambiguity,
    ];
  }

  /* one line */
  const words = toks(q);
  let bestIdx = -1, bestScore = 0;
  quote.lines.forEach((l, i) => {
    const lt = toks(l.name);
    let hit = 0;
    lt.forEach(x => { if (words.includes(x)) hit++; });
    const s = lt.length ? hit / lt.length : 0;
    if (hit >= 1 && s > bestScore) { bestScore = s; bestIdx = i; }
  });
  const line: QuoteLine | null = bestScore >= 0.34 && bestIdx >= 0 ? quote.lines[bestIdx] : null;
  if (line && (pct0 !== null || /price|charge|sell|quote/.test(q))) {
    if (line.cost <= 0) {
      return [lead('No cost on that line yet.'), text(`Set the cost on “${line.name}” and ask me again.`)];
    }
    const want = priceForMargin(line.cost, m);
    return [
      lead(`AED ${money(want)} a unit for ${pct(m)}.`),
      text(`${line.name} costs AED ${money(line.cost)} and you are quoting AED ${money(line.price)}, which is ${pct((line.price - line.cost) / line.price)}. At ${pct(m)} the line goes from AED ${money0(line.qty * line.price)} to AED ${money0(line.qty * want)} for ${line.qty} unit(s).`),
      ...(line.retail > 0 ? [text(want > line.retail
        ? `Book retail is AED ${money(line.retail)}, so that is AED ${money(want - line.retail)} above book — it needs approval.`
        : `Book retail is AED ${money(line.retail)}, so you are still inside book price.`)] : []),
      formula(`price = cost ÷ (1 − margin) = ${money(line.cost)} ÷ ${(1 - m).toFixed(4)} = ${money(want)}`),
      ...ambiguity,
    ];
  }

  /* weak lines */
  if (/below|weak|worst|thin|losing|loss|red|risk/.test(q)) {
    const rows = quote.lines.filter(l => l.cost > 0)
      .map(l => ({ l, margin: (l.price - l.cost) / l.price, want: priceForMargin(l.cost, m) }))
      .filter(r => r.margin < m - 0.0001)
      .sort((a, b) => a.margin - b.margin);
    if (!rows.length) return [lead(`Every costed line is at or above ${pct(m)}.`), ...uncosted];
    return [
      lead(`${rows.length} line(s) sit below ${pct(m)}.`),
      { kind: 'table', head: ['Line', 'Margin', 'Now', 'At target'], rows: rows.slice(0, 7).map(r => [r.l.name, pct(r.margin, 0), money0(r.l.price), money0(r.want)]) },
      ...(rows.length > 7 ? [text(`…and ${rows.length - 7} more.`)] : []),
      ...uncosted,
    ];
  }

  /* markup vs margin */
  if (/mark ?up/.test(q) && /margin/.test(q)) {
    return [
      lead('Markup and margin are not the same number.'),
      text(`This quote runs ${pct(t.markup)} markup on cost — ×${t.multiple.toFixed(2)} — which is ${pct(t.margin)} margin. The house ×${HOUSE_MULTIPLE} is ${pct(HOUSE_MULTIPLE - 1, 0)} markup and ${pct(HOUSE_MARGIN)} margin.`),
      { kind: 'table', head: ['× cost', 'Markup', 'Margin'], rows: [1.5, 2, 2.5, 3, 3.5, 4].map(x => ['×' + x.toFixed(1), pct(x - 1, 0), pct((x - 1) / x)]) },
      formula('margin = markup ÷ (1 + markup)   ·   markup = margin ÷ (1 − margin)   ·   ×N → margin = (N−1) ÷ N'),
    ];
  }

  /* status */
  if (/margin|status|how (am|are)|where (am|do)|summary|total|profit|gp\b|stand/.test(q) || pct0 !== null) {
    const atRetail = quote.lines.reduce((s, l) => s + l.qty * (l.retail > 0 ? l.retail : l.price), 0);
    const atRetailMargin = atRetail > 0 ? (atRetail - t.cost) / atRetail : 0;
    return [
      lead(`Margin ${pct(t.margin)} — AED ${money0(t.profit)} gross profit.`),
      text(`Quoted AED ${money0(t.revenue)} against AED ${money0(t.cost)} of cost across ${quote.lines.length} line(s) — ×${t.multiple.toFixed(2)} on cost.`),
      ...(t.retail > 0 ? [text(`The matched lines are worth AED ${money0(t.retail)} at book retail and you are quoting AED ${money0(t.retailQuoted)}, ${pct(t.offRetail)} below book. At retail throughout the quote would run ${pct(atRetailMargin)}.`)] : []),
      text(gap > 0.5
        ? `To reach ${label} the quote needs AED ${money0(need)} — short by AED ${money0(gap)}, or +${pct(gap / t.revenue)}.`
        : `That clears ${label} by AED ${money0(-gap)}.`),
      formula(`margin = (quote − cost) ÷ quote = (${money0(t.revenue)} − ${money0(t.cost)}) ÷ ${money0(t.revenue)} = ${pct(t.margin)}`),
      ...ambiguity, ...uncosted,
    ];
  }

  return [
    lead('Ask me in numbers and I will answer in numbers.'),
    text(`From this quote: ${SUGGESTIONS.slice(0, 5).map(s => `“${s}”`).join(', ')}. I can also look any product up in the price book, and do plain arithmetic.`),
  ];
}
