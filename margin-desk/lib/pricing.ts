import type { Quote, QuoteLine, TargetMode } from './types';

export const money = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = (n: number) =>
  Math.round(isFinite(n) ? n : 0).toLocaleString('en-US');
export const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : '0.0') + '%';

export interface Totals {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  markup: number;
  multiple: number;
  retail: number;         // book retail of the lines that have one
  retailQuoted: number;   // what we quote for those same lines
  offRetail: number;
  uncosted: number;
}

export function totals(lines: QuoteLine[]): Totals {
  let revenue = 0, cost = 0, retail = 0, retailQuoted = 0, uncosted = 0;
  for (const l of lines) {
    revenue += l.qty * l.price;
    if (l.cost > 0) cost += l.qty * l.cost; else uncosted++;
    if (l.retail > 0) { retail += l.qty * l.retail; retailQuoted += l.qty * l.price; }
  }
  const profit = revenue - cost;
  return {
    revenue, cost, profit,
    margin: revenue > 0 ? profit / revenue : 0,
    markup: cost > 0 ? profit / cost : 0,
    multiple: cost > 0 ? revenue / cost : 0,
    retail, retailQuoted,
    offRetail: retail > 0 ? (retail - retailQuoted) / retail : 0,
    uncosted,
  };
}

/** The target expressed as a plain gross margin, whichever way it was typed. */
export function targetMargin(target: number, mode: TargetMode): number {
  if (mode === 'margin') return target / 100;
  if (mode === 'markup') { const t = target / 100; return t / (1 + t); }
  return target > 0 ? (target - 1) / target : 0;
}

export function targetLabel(target: number, mode: TargetMode): string {
  if (mode === 'margin') return `${target}% margin`;
  if (mode === 'markup') return `${target}% markup`;
  return `×${target} on cost`;
}

/** Revenue this quote needs to hit the target, given its cost. */
export function requiredRevenue(cost: number, m: number): number {
  return m >= 1 ? Infinity : cost / (1 - m);
}

/** Unit price that puts one line on the target margin. */
export function priceForMargin(cost: number, m: number): number {
  return m >= 1 ? Infinity : cost / (1 - m);
}

export type Band = 'good' | 'warn' | 'bad';

export function marginBand(margin: number, target: number): Band {
  if (margin >= target - 0.0001) return 'good';
  if (margin >= target - 0.1) return 'warn';
  return 'bad';
}

export function offRetailBand(off: number): Band {
  if (off <= 0.0001) return 'good';
  if (off <= 0.1) return 'warn';
  return 'bad';
}

export function lineMargin(l: QuoteLine): number {
  const rev = l.qty * l.price;
  return rev > 0 ? (rev - l.qty * l.cost) / rev : 0;
}

export function quoteTotals(q: Quote) {
  return totals(q.lines);
}

/** The house rule: retail is 3.5 x purchase, which is a 71.4% gross margin. */
export const HOUSE_MULTIPLE = 3.5;
export const HOUSE_MARGIN = (HOUSE_MULTIPLE - 1) / HOUSE_MULTIPLE;
