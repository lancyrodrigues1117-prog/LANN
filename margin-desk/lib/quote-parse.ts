/* Turns the text of a quote or invoice into line items. Written against real
   Zoho exports, which carry a Tax column and sometimes a zero-priced line. */

export interface ParsedLine { name: string; qty: number; price: number }

const SKIP = new RegExp(
  '^(sub\\s?total|subtotal|total|grand total|vat|tax|discount|balance|amount in words|terms|notes?|' +
  'thank|authori[sz]ed|signature|quote|quotation|estimate|proforma|invoice|date|expiry|valid|customer|' +
  'bill to|ship to|place of supply|trn|page \\d|item ?& ?description|s\\.?no|qty|rate|amount|currency|' +
  'sales ?person|reference|price list|effective|standard rate|zero rate|rounding|round off|payment made|' +
  'balance due|deposit|advance|shipping charge|delivery charge|delivery time|delivery|payment terms|' +
  'payment method|account name|bank|branch|iban|swift|tax summary|tax details|p\\.?o\\.?)',
  'i'
);

export function parseQuoteLines(rawLines: string[]): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of rawLines) {
    const line = raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    if (line.length < 4 || SKIP.test(line) || !/[A-Za-z]{3}/.test(line)) continue;

    const numbers: { v: number; at: number }[] = [];
    const re = /-?\d[\d,]*(?:\.\d+)?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) numbers.push({ v: parseFloat(m[0].replace(/,/g, '')), at: m.index });
    if (numbers.length < 2) continue;

    const lastLetter = line.search(/[A-Za-z](?![\s\S]*[A-Za-z])/);
    const tail = numbers.filter(n => n.at > lastLetter);
    if (tail.length < 2) continue;

    // Do not assume which column is which. The amount is last; find the pair
    // before it that multiplies out to it, whatever sits in between.
    const amount = tail[tail.length - 1].v;
    let qty: number | null = null, price: number | null = null;
    for (let i = 0; i < tail.length - 1 && qty === null; i++) {
      for (let j = i + 1; j < tail.length - 1; j++) {
        const a = tail[i].v, r = tail[j].v;
        if (!(a > 0) || r < 0 || a > 9999) continue;   // r may be 0: free of charge
        if (Math.abs(a * r - amount) <= Math.max(0.05, Math.abs(amount) * 0.005)) { qty = a; price = r; break; }
      }
    }
    if (qty === null) {
      if (tail.length >= 3) { qty = tail[tail.length - 3].v; price = tail[tail.length - 2].v; }
      else { price = tail[0].v; qty = price > 0 ? Math.round(amount / price) : 0; }
    }
    if (price === null || price < 0 || !(qty > 0) || qty > 9999) continue;
    if (price === 0 && (qty % 1 !== 0 || qty > 999)) continue;

    const name = line.slice(0, tail[0].at)
      .replace(/^\d+[.)]?\s+/, '')
      .replace(/[|:;,\-\s]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.replace(/[^A-Za-z]/g, '').length < 3) continue;
    if (name.length > 90) continue;                    // a paragraph, not an item

    out.push({ name, qty, price });
  }
  return out;
}

/** Pull the quote or invoice reference and the customer out of the page text. */
export function parseQuoteMeta(lines: string[]): { ref: string; customer: string } {
  let ref = '', customer = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!ref) {
      const m = /(?:quotation|quote|invoice|estimate)\s*#\s*([A-Za-z0-9\-\/]+)/i.exec(l);
      if (m) ref = m[1];
    }
    if (!customer && /^bill to$/i.test(l.trim())) {
      // the customer is the next line that is not another field label
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const c = lines[j].trim();
        if (c && !/#|date|terms|trn/i.test(c)) { customer = c; break; }
      }
    }
  }
  return { ref, customer };
}
