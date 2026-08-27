import { bookKey, bookLabel, cogsByName, cogsUnitCost } from './catalogue';
import { matchBook, matchCogs } from './match';
import type { BookItem, Quote, QuoteLine } from './types';

export const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/** A line added from the price book: retail and cost both come from the book,
    with the COGS list preferred for cost where it knows the item. */
export function lineFromBook(item: BookItem, qty = 1): QuoteLine {
  const cogs = matchCogs(bookLabel(item));
  const fromCogs = cogs ? cogsUnitCost(cogs.item) : { cost: 0, source: 'none' as const };
  const cost = fromCogs.cost > 0 ? fromCogs.cost : (item.p ?? 0);
  return {
    id: newId(),
    name: bookLabel(item),
    bookKey: bookKey(item),
    cogsName: fromCogs.cost > 0 && cogs ? cogs.item.n : null,
    qty,
    price: item.r ?? 0,
    cost,
    retail: item.r ?? 0,
    costSource: fromCogs.cost > 0 ? fromCogs.source : (item.p ? 'book' : 'none'),
    note: '',
  };
}

/** A line read out of a quote PDF, or typed in: match by name in both directions. */
export function lineFromName(name: string, qty: number, price: number): QuoteLine {
  const cogs = matchCogs(name);
  const fromCogs = cogs ? cogsUnitCost(cogs.item) : { cost: 0, source: 'none' as const };
  const book = matchBook(name);
  let cost = fromCogs.cost;
  let source = fromCogs.cost > 0 ? fromCogs.source : ('none' as const);
  if (!(cost > 0) && book?.item.p) { cost = book.item.p; source = 'book'; }
  return {
    id: newId(),
    name,
    bookKey: book ? book.key : null,
    cogsName: cogs ? cogs.item.n : null,
    qty,
    price,
    cost,
    retail: book?.item.r ?? 0,
    costSource: source,
    note: book && !book.confident ? 'check the price-book match' : '',
  };
}

export function blankLine(): QuoteLine {
  return {
    id: newId(), name: '', bookKey: null, cogsName: null,
    qty: 1, price: 0, cost: 0, retail: 0, costSource: 'none', note: '',
  };
}

export function newQuote(): Quote {
  const now = new Date().toISOString();
  return {
    id: newId(), ref: '', customer: '', salesperson: '', notes: '',
    target: 70, targetMode: 'margin', lines: [], createdAt: now, updatedAt: now,
  };
}

export const costSourceLabel: Record<QuoteLine['costSource'], string> = {
  cogs: 'COGS list',
  inventory: 'Inventory list',
  book: 'Price book',
  manual: 'Typed in',
  none: 'No cost',
};

export const hasCogs = (name: string | null) => !!cogsByName(name);
