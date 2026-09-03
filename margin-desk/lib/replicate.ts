/* Replicate calls. Server-side only — the API token never reaches the browser.
 *
 * Everything a model needs is declared in MODELS below: which input key takes
 * the prompt, which takes a reference image, whether it accepts a negative
 * prompt, and which aspect ratios it allows. The route builds the request from
 * that table and omits anything a model does not declare, so adding a model is
 * one row and no new code.
 *
 * Replicate renames and retires models. If one starts returning "model not
 * found", check the slug on replicate.com and edit the `id` here — the error
 * is passed through to the UI verbatim so it says exactly that.
 */

/* Overridable so the route can be pointed at a mock in tests or at a proxy on a
   locked-down network. Unset in normal use. */
const API = process.env.REPLICATE_API_BASE || 'https://api.replicate.com/v1';

export interface GenModel {
  id: string;                    // owner/name on Replicate
  label: string;
  kind: 'image' | 'video';
  promptKey: string;
  negativeKey?: string;
  referenceKey?: string;         // input that takes a reference image
  referenceRequired?: boolean;   // image-to-video models that cannot run without one
  aspectKey?: string;
  aspects?: string[];            // what the model actually accepts
  durationKey?: string;
  durations?: number[];
  extra?: Record<string, unknown>;
  note: string;
}

export const MODELS: GenModel[] = [
  {
    id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro', kind: 'image',
    promptKey: 'prompt', aspectKey: 'aspect_ratio',
    aspects: ['1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '9:16', '21:9'],
    extra: { output_format: 'jpg', safety_tolerance: 2 },
    note: 'Best quality for stills. No negative prompt — FLUX ignores one, so put exclusions in the prompt itself.',
  },
  {
    id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell', kind: 'image',
    promptKey: 'prompt', aspectKey: 'aspect_ratio',
    aspects: ['1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '9:16', '21:9'],
    extra: { output_format: 'jpg', num_outputs: 1 },
    note: 'A few cents and a few seconds. Use it to check a prompt before spending on Pro.',
  },
  {
    id: 'black-forest-labs/flux-kontext-pro', label: 'FLUX Kontext (reference)', kind: 'image',
    promptKey: 'prompt', referenceKey: 'input_image', referenceRequired: true,
    aspectKey: 'aspect_ratio',
    aspects: ['match_input_image', '1:1', '16:9', '3:2', '2:3', '4:5', '9:16', '21:9'],
    extra: { output_format: 'jpg' },
    note: 'Edits or restyles the reference image you upload. Needs a reference.',
  },
  {
    id: 'google/imagen-4', label: 'Imagen 4', kind: 'image',
    promptKey: 'prompt', aspectKey: 'aspect_ratio',
    aspects: ['1:1', '9:16', '16:9', '3:4', '4:3'],
    note: 'Strong on text inside the image. Fewer aspect ratios — the closest one is used.',
  },
  {
    id: 'kwaivgi/kling-v1.6-standard', label: 'Kling 1.6', kind: 'video',
    promptKey: 'prompt', negativeKey: 'negative_prompt', referenceKey: 'start_image',
    aspectKey: 'aspect_ratio', aspects: ['16:9', '9:16', '1:1'],
    durationKey: 'duration', durations: [5, 10],
    note: 'Takes a negative prompt and an optional first frame. 5 or 10 seconds.',
  },
  {
    id: 'minimax/video-01', label: 'MiniMax Video-01', kind: 'video',
    promptKey: 'prompt', referenceKey: 'first_frame_image',
    note: 'Good motion. Fixed length and framing — aspect ratio and duration are ignored.',
  },
  {
    id: 'google/veo-3', label: 'Veo 3', kind: 'video',
    promptKey: 'prompt', negativeKey: 'negative_prompt',
    aspectKey: 'aspect_ratio', aspects: ['16:9', '9:16'],
    note: 'Highest quality and the most expensive. Generates audio from the prompt too.',
  },
];

export const modelById = (id: string) => MODELS.find(m => m.id === id);

/* Aspect ratios the desk offers are not all offered by every model. Pick the
   closest one the model accepts rather than failing or silently squaring it. */
export function nearestAspect(want: string, allowed: string[]): string {
  if (allowed.includes(want)) return want;
  const ratio = (s: string) => {
    const [a, b] = s.split(':').map(Number);
    return b ? a / b : 1;
  };
  const target = ratio(want);
  return allowed
    .filter(a => a.includes(':'))
    .reduce((best, a) => (Math.abs(ratio(a) - target) < Math.abs(ratio(best) - target) ? a : best), allowed[0]);
}

export function nearestDuration(want: number, allowed: number[]): number {
  return allowed.reduce((best, d) => (Math.abs(d - want) < Math.abs(best - want) ? d : best), allowed[0]);
}

export interface Prediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string | null;
}

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) throw new Error('REPLICATE_API_TOKEN is not set. Add it to .env.local and restart the dev server.');
  return t;
}

async function call(path: string, init?: RequestInit): Promise<Prediction> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token(),
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(body); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const detail = (json.detail || json.title || body || res.statusText) as string;
    throw new Error('Replicate ' + res.status + ': ' + String(detail).slice(0, 400));
  }
  return json as unknown as Prediction;
}

/* `Prefer: wait` holds the connection open for up to 60s, so a fast image model
   often comes back finished on the first call. It can still return `starting`
   with no output, so the caller polls either way. */
export const createPrediction = (model: string, input: Record<string, unknown>) =>
  call(`/models/${model}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=55' },
    body: JSON.stringify({ input }),
  });

export const getPrediction = (id: string) => call('/predictions/' + id);

/* Replicate returns a URL, or an array of them, depending on the model. */
export function outputUrls(output: unknown): string[] {
  if (typeof output === 'string') return [output];
  if (Array.isArray(output)) return output.filter((o): o is string => typeof o === 'string');
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    for (const k of ['video', 'image', 'url', 'output']) {
      if (typeof o[k] === 'string') return [o[k] as string];
    }
  }
  return [];
}
