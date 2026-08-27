import bookData from '@/data/price-book.json';
import cogsData from '@/data/cogs.json';
import type { BookItem, CogsItem, CostSource } from './types';

export const BOOK = bookData as BookItem[];
export const COGS = cogsData as CogsItem[];

export const bookKey = (b: BookItem) => `${b.b}|${b.n}|${b.v}`;
export const bookLabel = (b: BookItem) => `${b.b} ${b.n}${b.v ? ' · ' + b.v : ''}`;

const BOOK_BY_KEY = new Map<string, BookItem>();
BOOK.forEach(b => BOOK_BY_KEY.set(bookKey(b), b));
export const bookByKey = (k: string | null) => (k ? BOOK_BY_KEY.get(k) ?? null : null);

export const CATEGORIES = Array.from(new Set(BOOK.map(b => b.cat)));
export const BRANDS = Array.from(new Set(BOOK.map(b => b.b).filter(Boolean))).sort();

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const STOP = new Set(['pr', 'acc', 'sp', 'the', 'and', 'for', 'with', 'without', 'w', 'o', 'c']);
export const toks = (s: string) => norm(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));

const COGS_BY_NAME = new Map<string, CogsItem>();
COGS.forEach(c => COGS_BY_NAME.set(norm(c.n), c));
export const cogsByName = (n: string | null) => (n ? COGS_BY_NAME.get(norm(n)) ?? null : null);

export function cogsUnitCost(item: CogsItem | null): { cost: number; source: CostSource } {
  if (!item) return { cost: 0, source: 'none' };
  if (item.c !== null && item.c !== undefined) return { cost: item.c, source: 'cogs' };
  if (item.i !== null && item.i !== undefined) return { cost: item.i, source: 'inventory' };
  return { cost: 0, source: 'none' };
}

/** Free-text search over the price book, for the product picker and the book page.
    A hit in the product name outranks one in the description, so searching
    "headrest" offers the headrest before a chair that merely mentions one. */
export function searchBook(q: string, cat = '', brand = ''): BookItem[] {
  const parts = norm(q).split(' ').filter(Boolean);
  const pool = BOOK.filter(b => (!cat || b.cat === cat) && (!brand || b.b === brand));
  if (!parts.length) return pool;

  const scored: { item: BookItem; score: number }[] = [];
  for (const b of pool) {
    const name = norm([b.n, b.v].join(' '));
    const label = norm([b.b, b.seg, b.cat].join(' '));
    const desc = norm(b.d);
    let score = 0, all = true;
    for (const p of parts) {
      if (name.includes(p)) score += name.startsWith(p) ? 120 : 100;
      else if (label.includes(p)) score += 40;
      else if (desc.includes(p)) score += 8;
      else { all = false; break; }
    }
    if (all) scored.push({ item: b, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.n.localeCompare(b.item.n));
  return scored.map(s => s.item);
}
