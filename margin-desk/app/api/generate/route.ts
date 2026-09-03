import { NextRequest, NextResponse } from 'next/server';
import {
  MODELS, modelById, nearestAspect, nearestDuration,
  createPrediction, getPrediction, outputUrls,
} from '@/lib/replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROMPT = 4000;
const MAX_REFERENCE = 6_000_000;   // ~6MB of data URI; the client downscales first

interface Body {
  model?: unknown;
  prompt?: unknown;
  negative?: unknown;
  aspect?: unknown;
  seconds?: unknown;
  reference?: unknown;
}

const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code });

/* GET /api/generate                → the model catalogue, and whether a token is set
   GET /api/generate?id=<pred id>   → poll one prediction */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({
      configured: !!process.env.REPLICATE_API_TOKEN,
      models: MODELS.map(m => ({
        id: m.id, label: m.label, kind: m.kind, note: m.note,
        takesReference: !!m.referenceKey,
        needsReference: !!m.referenceRequired,
        takesNegative: !!m.negativeKey,
      })),
    });
  }
  /* The id goes into the request path, so it is checked rather than trusted. */
  if (!/^[a-z0-9]{1,64}$/i.test(id)) return bad('Not a prediction id.');
  try {
    const p = await getPrediction(id);
    return NextResponse.json({ id: p.id, status: p.status, error: p.error ?? null, urls: outputUrls(p.output) });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return bad('Expected a JSON body.'); }

  /* Only models in the catalogue — the id becomes part of the upstream URL. */
  const model = typeof body.model === 'string' ? modelById(body.model) : undefined;
  if (!model) return bad('Unknown model.');

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return bad('The prompt is empty — fill in a subject first.');
  if (prompt.length > MAX_PROMPT) return bad('That prompt is too long.');

  const reference = typeof body.reference === 'string' ? body.reference : '';
  if (reference) {
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(reference)) return bad('The reference must be a PNG, JPEG or WebP image.');
    if (reference.length > MAX_REFERENCE) return bad('That reference image is too large.');
    if (!model.referenceKey) return bad(model.label + ' does not take a reference image.');
  } else if (model.referenceRequired) {
    return bad(model.label + ' needs a reference image to work from.');
  }

  const input: Record<string, unknown> = { ...(model.extra || {}), [model.promptKey]: prompt };

  const negative = typeof body.negative === 'string' ? body.negative.trim() : '';
  if (negative && model.negativeKey) input[model.negativeKey] = negative.slice(0, MAX_PROMPT);

  const aspect = typeof body.aspect === 'string' ? body.aspect : '';
  if (aspect && model.aspectKey && model.aspects) {
    input[model.aspectKey] = nearestAspect(aspect, model.aspects);
  }

  const secs = Number(body.seconds);
  if (secs > 0 && model.durationKey && model.durations) {
    input[model.durationKey] = nearestDuration(secs, model.durations);
  }

  if (reference && model.referenceKey) input[model.referenceKey] = reference;

  try {
    const p = await createPrediction(model.id, input);
    return NextResponse.json({ id: p.id, status: p.status, error: p.error ?? null, urls: outputUrls(p.output) });
  } catch (e) {
    const msg = (e as Error).message;
    /* A missing token is the setup step, not an upstream failure. */
    return bad(msg, /REPLICATE_API_TOKEN/.test(msg) ? 503 : 502);
  }
}
