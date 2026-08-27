# HBN Margin Desk

The sales desk: look a price up, build the quote, see the margin before it goes out.

Two screens.

**Price book** — the whole June 2026 price book, 228 lines, searchable and filterable
by category and brand. Purchase price, retail price, margin, multiple on cost, and the
Valencia fabric upcharge. Every row has a **Quote this** button that starts a quote from it.

**Quotes** — a list of quotes, and a builder for each one:

- search the price book and add a product; retail comes in as the quoted price and the
  cost comes with it, so a fresh quote starts at the house margin
- or import a Zoho quote PDF and every line is read, costed and matched
- edit quantity, price and cost inline; the margin moves as you type
- **Off retail** shows how far each line sits below company price
- the **margin advisor** answers questions in numbers: where to add price to reach a
  target, how much discount is left, which lines are thin, what a product costs, and
  plain arithmetic. Every answer prints the formula it used.

Quotes save as you type.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

## Deploying to Vercel

1. Push this folder to GitHub.
2. In Vercel, **New Project → Import** the repository. Set the **Root Directory** to
   `margin-desk`. Everything else is detected.
3. Deploy. That is the whole thing — it runs with no database.

Without Supabase, **each person's quotes live in their own browser**. Good for one
person on one machine; not good for a team. The badge in the top right says which mode
you are in.

## Connecting Supabase

1. Create a Supabase project.
2. Open the SQL editor and run [`lib/supabase/schema.sql`](lib/supabase/schema.sql).
3. In Vercel → Settings → Environment Variables, add the two values from
   Supabase → Project Settings → API:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

4. Redeploy. The app now reads and writes quotes in Supabase and the whole team sees
   the same list. Nothing else changes — the store swap happens behind one interface
   in `lib/store.ts`.

**Read the warning in `schema.sql` before you put real quotes in it.** The starter
policies let anyone with the anon key read and write every quote, and the anon key ships
to the browser. That is fine behind a private preview URL. Before the sales team uses it
in earnest, add Supabase Auth and scope the policies to `auth.uid()`.

## The data

| File | What it is |
| --- | --- |
| `data/price-book.json` | 228 priced lines from `HBN Pricelist 2026 JUNE.xlsx`, one row per variant. Retail. |
| `data/cogs.json` | 122 items carrying a unit cost from `PRICE LIST - 25-08-2026.xlsx`. Cost. |

The house rule is **retail = purchase × 3.5**, a 71.4% gross margin, and it holds on 225
of the 228 lines. The three BUCE wash units (S270F, S370F, S274F) sit about AED 8,000
above their ×3.5 figure in the source sheet; they are carried through exactly as the
sheet has them and flagged in the price book's *× cost* column.

To update either list, regenerate the JSON from the new workbook and replace the file.
Nothing else needs to change.

## How the matching works

Cost matches the COGS list on the Zoho item name — exact first, then closest.

Retail matches the price book only when the **brand and a distinctive product word both
agree**, with the Zoho product type (Washunit, Stool, Trolley) breaking ties between a
chair and the wash unit of the same family. Lines prefixed `SP-` are never priced from
the book, because the book lists finished goods and those are spare parts.

This strictness is deliberate. Loose matching put a AED 12,065 chair price on a chair-base
spare, and a wrong retail silently corrupts every off-retail figure and every piece of
advice built on top of it. A weak match is flagged for a human instead of shown as fact,
and an unmatched line simply shows no retail.

## Reading Zoho PDFs

`lib/pdf.ts` reads the text in the browser with no libraries: objects are scanned, streams
inflated with `DecompressionStream`, content streams tokenised, and text runs grouped back
into lines by position. It was written against real Zoho exports and handles the things
they actually do — a newline before `endstream`, two-byte Identity-H fonts, a Tax column
between rate and amount, and free-of-charge lines that carry cost but no price.

When it cannot read a file it says which stage failed — encrypted, scanned, or read but
unparseable — and hands back whatever text it did get so it can be pasted in instead.
