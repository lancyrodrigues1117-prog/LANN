# HBN Margin Desk

The sales desk: look a price up, build the quote, see the margin before it goes out.
Plus a prompt desk for the marketing images and clips.

Three screens.

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

**Prompt desk** — structured prompts for image and video models, and a Generate button
that runs them through Replicate. Nobody writes a paragraph: you fill fields, and the
page assembles the prompt.

- **Image** — subject, action, setting, lighting, lens, composition, style, palette,
  mood and detail, rendered for Midjourney, Stable Diffusion, plain language or JSON
- **Video** — the same plus camera move, subject motion, pacing, duration, audio and a
  **first frame** and **last frame**. Most video prompts fail because they describe a
  picture instead of a change over time; those two fields fix that.
- **Shot list** — scene defaults every shot inherits, then a list of shots that each add
  what happens, a camera move and a duration. Renders as one numbered sequence with the
  total runtime, or as a storyboard. Generation runs one shot at a time.

Presets fill every field in a click, the negative prompt is assembled from grouped
failure modes, and a reference image can be uploaded for the models that take one.
Fields and saved prompts persist in the browser.

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

## Turning on generation

The prompt desk builds prompts with no setup. To make **Generate** work:

1. Get a token at [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens).
2. Put it in `.env.local`:

   ```
   REPLICATE_API_TOKEN=r8_...
   ```

3. Restart the dev server. On Vercel, add the same variable in project settings.

The token is read server-side in `app/api/generate/route.ts` and never reaches the
browser — the page talks to that route, and the route talks to Replicate. Without the
token the panel says so and the rest of the desk carries on working.

Runs cost money, per generation, on your Replicate account. Stills are cents; video is
appreciably more. Start on FLUX Schnell to check a prompt before spending on Pro.

**Generated files are deleted by Replicate an hour after the run.** Results are held in
the page for the session only — download anything worth keeping.

### Changing the models on offer

Every model is one row in `MODELS` in `lib/replicate.ts`, declaring which input key
takes the prompt, which takes a reference image, whether it accepts a negative prompt,
and which aspect ratios it allows. The route builds the request from that table and
omits whatever a model does not declare, so adding one is a row and no new code.

Replicate renames and retires models. If one starts failing with "model not found",
check the slug on replicate.com and edit its `id` — upstream errors are passed through
to the UI verbatim, so it will say exactly that.

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
