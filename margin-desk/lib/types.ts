export interface BookItem {
  cat: string;            // sheet it came from — CHAIRS, WASHUNITS, …
  n: string;              // product name
  v: string;              // variant, e.g. "Chrome Base"
  seg: string;            // segment, e.g. "STYLING CHAIR"
  b: string;              // brand
  d: string;              // description
  p: number | null;       // purchase price
  r: number | null;       // retail price
  f: number | null;       // Valencia fabric upcharge
}

export interface CogsItem {
  n: string;              // Zoho item name
  i: number | null;       // inventory unit cost
  c: number | null;       // COGS unit cost
  s: string;              // status from the comparison sheet
}

export type CostSource = 'cogs' | 'inventory' | 'book' | 'manual' | 'none';

export interface QuoteLine {
  id: string;
  name: string;           // what the customer sees
  bookKey: string | null; // index into the price book
  cogsName: string | null;
  qty: number;
  price: number;          // what we are quoting
  cost: number;           // our cost per unit
  retail: number;         // price-book retail per unit, 0 when unknown
  costSource: CostSource;
  note: string;
}

export type TargetMode = 'margin' | 'markup' | 'multiple';

export interface Quote {
  id: string;
  ref: string;
  customer: string;
  salesperson: string;
  notes: string;
  target: number;
  targetMode: TargetMode;
  lines: QuoteLine[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteSummary {
  id: string;
  ref: string;
  customer: string;
  updatedAt: string;
  total: number;
  margin: number;
  lineCount: number;
}
