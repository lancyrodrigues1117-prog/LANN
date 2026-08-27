# Quote Margin Desk

One self-contained HTML page for the sales team. No build step, no
dependencies, no network calls — open `index.html` or publish it anywhere
static.

Two views:

- **Quote check** — drop a Zoho quote PDF, and every line is costed against
  the COGS list and compared with the company retail price. Shows gross
  profit and margin per line and for the whole quote, plus how far each line
  sits below book retail. A margin advisor answers arithmetic questions about
  the loaded quote.
- **Price book** — the whole June 2026 price book, searchable and filterable
  by category and brand: purchase price, retail price, margin, multiple on
  cost, and the Valencia fabric upcharge.

## Data

| File | What it is |
| --- | --- |
| `cogs-2026-08-25.json` | 122 items with a unit cost, from `PRICE LIST - 25-08-2026.xlsx`. Cost basis. |
| `price-book-2026-june.json` | 228 lines from `HBN Pricelist 2026 JUNE.xlsx` — 7 category sheets, one row per priced variant. Retail basis. |

Both are embedded in `index.html`; the JSON files are kept beside it so the
page can be regenerated when either sheet changes.

The house rule is **retail = purchase × 3.5**, a 71.4% gross margin. It holds
on 225 of 228 lines. The three BUCE wash units (S270F, S370F, S274F) sit about
AED 8,000 above their ×3.5 figure in the source sheet; they are carried through
exactly as the sheet has them and flagged in the price book's × cost column.

## How it works

1. The PDF is read in the browser — object scan, Flate/ASCII85 inflate,
   content-stream tokenizer, ToUnicode CMap mapping, then text runs are
   grouped back into rows by their y position.
2. Each row is parsed into item name / qty / unit price.
3. **Cost** matches the COGS list on the Zoho item name, exact then closest.
4. **Retail** matches the price book only when the brand *and* a distinctive
   product word both agree, with the Zoho product type (Washunit, Stool,
   Trolley…) breaking ties between a chair and the wash unit of the same
   family. Lines prefixed `SP-` are never priced — the book lists finished
   goods, not spare parts. A weak match is shown with a `?` for a human to
   confirm; an unmatched line simply shows no retail. This strictness is
   deliberate: a wrong retail price silently corrupts every off-list figure
   and every piece of advice built on it.
5. The advisor is deterministic — target-margin gaps, where to add price
   (leading with bringing lines back to book retail), discount room, off-book
   position, per-item target price, price-book lookups, markup/margin/multiple
   conversion, and plain arithmetic. Every answer prints its formula.

## Updating a price list

Regenerate the JSON from the new workbook and replace the corresponding
`const COGS = [...]` or `const BOOK = [...]` array at the top of the
`<script>` block in `index.html`.
