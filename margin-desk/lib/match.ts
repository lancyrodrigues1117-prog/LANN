import { BOOK, COGS, bookKey, bookLabel, cogsByName, norm, toks } from './catalogue';
import type { BookItem, CogsItem } from './types';

/* Words that describe a kind of thing rather than name a product. A match can
   never rest on one of these alone, or a chair base spare gets priced as a chair. */
const GENERIC = new Set((
  'chair chairs styling stool stools trolley table tables mirror mirrors bed beds wash washunit ' +
  'washunits base bases top black white chrome steel stainless gold seat unit units barber make ' +
  'massage pedicure manicure treatment reclining reception sink tools lamp footrest cleaning mixer ' +
  'steamer holder holders salon round square disc star lift pump metal wood double single arch kit ' +
  'set part parts lower upper new spa'
).split(' '));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(t => { if (b.has(t)) inter++; });
  return inter / (a.size + b.size - inter);
}

/** One typo apart, but only for a long word and never across a different first letter
    (so Rondolore never becomes Tondolore). */
function near(catalogueWord: string, quoteWord: string): boolean {
  if (catalogueWord === quoteWord) return true;
  if (catalogueWord.length < 6) return false;
  if (catalogueWord[0] !== quoteWord[0]) return false;
  if (Math.abs(catalogueWord.length - quoteWord.length) > 1) return false;
  if (catalogueWord.length === quoteWord.length) {
    let d = 0;
    for (let i = 0; i < catalogueWord.length; i++) if (catalogueWord[i] !== quoteWord[i]) d++;
    return d === 1;
  }
  const short = quoteWord.length < catalogueWord.length ? quoteWord : catalogueWord;
  const long = quoteWord.length < catalogueWord.length ? catalogueWord : quoteWord;
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  return false;
}

interface BookEntry {
  item: BookItem;
  brand: Set<string>;
  nameWords: string[];
  all: Set<string>;
  kind: Set<string>;
}

const ENTRIES: BookEntry[] = BOOK.map(item => ({
  item,
  brand: new Set(toks(item.b)),
  nameWords: toks(item.n).filter(t => !GENERIC.has(t) && t.length >= 3),
  all: new Set(toks([item.b, item.n, item.v, item.seg, item.cat].join(' '))),
  kind: new Set(toks([item.seg, item.cat].join(' '))),
}));

export interface BookMatch {
  item: BookItem;
  key: string;
  label: string;
  score: number;
  confident: boolean;
}

/** Deliberately strict. Brand and a distinctive product word must both agree, and
    spare parts are never priced from a book that lists finished goods. */
export function matchBook(name: string): BookMatch | null {
  if (/^\s*sp\s*[-–]/i.test(name)) return null;
  const words = toks(name);
  const set = new Set(words);
  if (!set.size) return null;

  const found: { score: number; entry: BookEntry }[] = [];
  for (const e of ENTRIES) {
    if (!e.brand.size || !e.nameWords.length) continue;
    let brandHit = false;
    e.brand.forEach(b => { if (set.has(b)) brandHit = true; });
    if (!brandHit) continue;
    if (!e.nameWords.some(t => words.some(w => near(t, w)))) continue;
    // the Zoho name carries the product type, which separates a chair from the
    // wash unit of the same family
    let kindBonus = 0;
    e.kind.forEach(t => { if (set.has(t)) kindBonus = 0.1; });
    found.push({ score: jaccard(set, e.all) + kindBonus, entry: e });
  }
  if (!found.length) return null;
  found.sort((a, b) => b.score - a.score);
  const top = found[0];
  if (top.score < 0.2) return null;
  return {
    item: top.entry.item,
    key: bookKey(top.entry.item),
    label: bookLabel(top.entry.item),
    score: top.score,
    confident: top.score >= 0.35,
  };
}

export interface CogsMatch { item: CogsItem; exact: boolean }

export function matchCogs(name: string): CogsMatch | null {
  const direct = cogsByName(name);
  if (direct) return { item: direct, exact: true };
  const set = new Set(toks(name));
  let best: CogsItem | null = null, bestScore = 0;
  for (const c of COGS) {
    const s = jaccard(set, new Set(toks(c.n)));
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return best && bestScore >= 0.45 ? { item: best, exact: false } : null;
}
