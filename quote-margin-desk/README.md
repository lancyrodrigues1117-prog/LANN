# Quote Margin Desk

A single self-contained HTML page for the sales team: drop a Zoho quote PDF,
every line is costed against the price list, and the margin is shown before
the quote goes out.

- `index.html` — the whole tool. No build step, no dependencies, no network
  calls. Open it directly or publish it anywhere static.
- `pricelist-25-08-2026.json` — the cost data embedded in `index.html`,
  extracted from `PRICE LIST - 25-08-2026.xlsx` (122 items that carry a unit
  cost in both the Inventory and the COGS price list).

## What it shows

- **Cost** — always the COGS column of the price list. The eight items costed only
  in the inventory list fall back to that and are tagged on the line.
- **List price** — the company selling price, loaded from a price PDF (or pasted).
  Stored in the browser, so it is loaded once and applies to every later quote.
- **Off list** — how far the quote sits below the company price, per line and in total.
- **Margin** — against a target the user sets, as margin or as markup on cost.

## How it works

1. The PDF is read in the browser — object scan, FlateDecode / ASCII85
   inflate, content-stream tokenizer, ToUnicode CMap mapping, then text runs
   are grouped back into rows by their y position.
2. Each row is parsed into item name / qty / unit price, and the name is
   matched to the price list (exact name first, then closest by token
   overlap). Unmatched lines are flagged and excluded from cost, so the
   margin is never flattered by a missing cost.
3. The advisor answers arithmetic questions from the loaded quote — target
   margin gaps, where to add price (starting with the lines that are below
   company list, since that raise is the easiest to defend), discount room,
   off-list position, per-item target price, markup/margin conversion, and
   plain sums. It is deterministic: every answer shows the formula it used.

## Updating the price list

Regenerate the JSON from the new workbook and replace the `const PRICE = [...]`
array at the top of the `<script>` block in `index.html`.
