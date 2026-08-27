'use client';

import type { Quote, QuoteSummary } from './types';
import { totals } from './pricing';

export interface QuoteStore {
  readonly kind: 'local' | 'supabase';
  list(): Promise<QuoteSummary[]>;
  get(id: string): Promise<Quote | null>;
  save(q: Quote): Promise<void>;
  remove(id: string): Promise<void>;
}

export const summarise = (q: Quote): QuoteSummary => {
  const t = totals(q.lines);
  return {
    id: q.id, ref: q.ref, customer: q.customer, updatedAt: q.updatedAt,
    total: t.revenue, margin: t.margin, lineCount: q.lines.length,
  };
};

const KEY = 'hbn-margin-desk-quotes';

class LocalStore implements QuoteStore {
  readonly kind = 'local' as const;

  private read(): Quote[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Quote[]; }
    catch { return []; }
  }
  private write(all: Quote[]) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
  }
  async list() {
    return this.read()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarise);
  }
  async get(id: string) { return this.read().find(q => q.id === id) ?? null; }
  async save(q: Quote) {
    const all = this.read();
    const i = all.findIndex(x => x.id === q.id);
    if (i >= 0) all[i] = q; else all.push(q);
    this.write(all);
  }
  async remove(id: string) { this.write(this.read().filter(q => q.id !== id)); }
}

const ROW_TO_QUOTE = (r: Record<string, unknown>): Quote => ({
  id: String(r.id),
  ref: String(r.ref ?? ''),
  customer: String(r.customer ?? ''),
  salesperson: String(r.salesperson ?? ''),
  notes: String(r.notes ?? ''),
  target: Number(r.target ?? 70),
  targetMode: (r.target_mode as Quote['targetMode']) ?? 'margin',
  lines: (r.lines as Quote['lines']) ?? [],
  createdAt: String(r.created_at ?? new Date().toISOString()),
  updatedAt: String(r.updated_at ?? new Date().toISOString()),
});

const QUOTE_TO_ROW = (q: Quote) => ({
  id: q.id, ref: q.ref, customer: q.customer, salesperson: q.salesperson,
  notes: q.notes, target: q.target, target_mode: q.targetMode,
  lines: q.lines, created_at: q.createdAt, updated_at: q.updatedAt,
});

class SupabaseStore implements QuoteStore {
  readonly kind = 'supabase' as const;
  constructor(private client: import('@supabase/supabase-js').SupabaseClient) {}

  async list() {
    const { data, error } = await this.client.from('quotes').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => summarise(ROW_TO_QUOTE(r)));
  }
  async get(id: string) {
    const { data, error } = await this.client.from('quotes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? ROW_TO_QUOTE(data) : null;
  }
  async save(q: Quote) {
    const { error } = await this.client.from('quotes').upsert(QUOTE_TO_ROW(q));
    if (error) throw error;
  }
  async remove(id: string) {
    const { error } = await this.client.from('quotes').delete().eq('id', id);
    if (error) throw error;
  }
}

let cached: QuoteStore | null = null;

/** Supabase when its two environment variables are set, the browser otherwise.
    Nothing above this line knows or cares which one it got. */
export async function getStore(): Promise<QuoteStore> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      cached = new SupabaseStore(createClient(url, key));
      return cached;
    } catch {
      // fall through to local rather than leaving the app with nowhere to write
    }
  }
  cached = new LocalStore();
  return cached;
}

export const storeKind = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'supabase' : 'local';
