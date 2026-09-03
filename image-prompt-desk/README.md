# Prompt Desk

One self-contained HTML page for building image and video prompts. No build
step, no dependencies, no network calls — open `index.html` or publish it
anywhere static. Everything you type stays in the browser.

The idea is that nobody writes a paragraph. You fill structured fields, and the
page assembles a model-ready prompt plus a matching negative prompt.

## Three views

- **Image** — subject, action, setting, lighting, lens, composition, style,
  palette, mood and detail, rendered for Midjourney, Stable Diffusion, plain
  natural language, or JSON.
- **Video** — the same, plus camera move, subject motion, pacing, duration,
  audio and, most importantly, a **first frame** and a **last frame**. Most
  video prompts fail because they describe a picture instead of a change over
  time; those two fields are what force a shot to have a beginning and an end.
- **Shot list** — scene defaults that every shot inherits (subject, setting,
  lighting, style, palette, mood, lens, audio) and a list of shots that each
  add what happens, a camera move and a duration. Output is one numbered
  sequence, either as full per-shot prompts or as a readable storyboard, with
  the total runtime in the footer.

## What each output tab does

| Tab | Shape |
| --- | --- |
| Midjourney | Comma-separated clause, `--ar`, `--stylize`, `--style raw` when the style reads photographic, and the negatives folded into `--no`. |
| Stable Diffusion | Weighted syntax — the subject at `1.3`, the style at `1.2` — with the negative prompt in its own box. |
| Sora / Veo | Prose, ordered the way a video model reads it: subject and setting, opening frame, motion, closing frame, then camera, light, look, mood, timing and audio. |
| Runway | The same fields as labelled `Key: value` lines. |
| Natural | One flowing paragraph with no syntax at all, for DALL·E-style and chat-based models. |
| Storyboard | Shot number, name, duration, camera move and action — for a human, not a model. |
| JSON | The structured record, for anything that calls an API. |

## The other pieces

- **Presets** — seven image packs, five video packs, three shot-list templates.
  Loading one fills every field, so the first useful prompt is one click away.
  Editing any field releases the preset highlight.
- **Negative autopilot** — five groups (anatomy, text, quality, framing, style
  leaks). Anatomy, text and quality are on by default; *Sensible defaults*
  returns to that.
- **Frame** — aspect ratios drawn to scale, so the picker reads as a shape.
- **Variations** — four alternates of the current shot with the light, lens,
  mood and palette swapped, for batch-testing a subject.
- **Saved** — favourites first, thirty recent behind them, in `localStorage`
  along with the current fields, so the page reopens where you left it.
  *Clear* keeps the favourites.

## Extending the vocabulary

Every suggestion list lives in the `OPTS` object at the top of the first
`<script>` block, one key per field. Adding an entry there puts it in that
field's dropdown and in the shuffler's pool. The fields themselves are declared
in `IMAGE_SPEC`, `VIDEO_SPEC`, `SCENE_SPEC` and `SHOT_SPEC`; presets are plain
objects keyed by those same field names. Nothing is an enum — a value typed by
hand that is not on a list is always kept.

Adding an output format means one function that takes the field object and the
aspect ratio, one entry in `MODELS`, and one branch in `build()`.
