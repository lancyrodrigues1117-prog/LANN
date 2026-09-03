'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CatalogueModel {
  id: string;
  label: string;
  kind: 'image' | 'video';
  note: string;
  takesReference: boolean;
  needsReference: boolean;
  takesNegative: boolean;
}

export interface Result {
  key: string;
  url: string;
  kind: 'image' | 'video';
  model: string;
  prompt: string;
}

/* Replicate deletes generated files an hour after the run, so results are held
   in memory for the session and never written to localStorage — a saved URL
   would come back dead. Download anything worth keeping. */
const REFERENCE_MAX_EDGE = 1536;
const POLL_MS = 2000;
const POLL_LIMIT = 300;            // ~10 minutes, enough for the slowest video model

/* Big camera-roll photos are pointless to upload and blow the body limit, so
   they are drawn down to a sane edge before becoming a data URI. */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image this browser can open.'));
      img.onload = () => {
        const scale = Math.min(1, REFERENCE_MAX_EDGE / Math.max(img.width, img.height));
        if (scale === 1 && String(reader.result).length < 4_000_000) return resolve(String(reader.result));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function Generator({ prompt, negative, aspect, seconds, kind }: {
  prompt: string;
  negative: string;
  aspect: string;
  seconds: number;
  kind: 'image' | 'video';
}) {
  const [models, setModels] = useState<CatalogueModel[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [modelId, setModelId] = useState('');
  const [reference, setReference] = useState('');
  const [refName, setRefName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const cancelled = useRef(false);
  const runNo = useRef(0);

  useEffect(() => () => { cancelled.current = true; }, []);

  useEffect(() => {
    fetch('/api/generate')
      .then(r => r.json())
      .then(d => { setModels(d.models || []); setConfigured(!!d.configured); })
      .catch(() => setConfigured(false));
  }, []);

  const forKind = models.filter(m => m.kind === kind);
  const model = forKind.find(m => m.id === modelId) || forKind[0];

  /* Keep the selection on a model that can actually run this view. */
  useEffect(() => {
    if (forKind.length && !forKind.some(m => m.id === modelId)) setModelId(forKind[0].id);
  }, [kind, models, modelId, forKind]);

  const pick = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setReference(await downscale(file));
      setRefName(file.name);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  async function run() {
    if (!model) return;
    setError(''); setBusy(true); setStatus('Sending…');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.id, prompt, negative, aspect, seconds,
          reference: model.takesReference ? reference : '',
        }),
      });
      let d = await res.json();
      if (!res.ok) throw new Error(d.error || 'The request failed.');

      for (let n = 0; n < POLL_LIMIT && d.status !== 'succeeded' && d.status !== 'failed' && d.status !== 'canceled'; n++) {
        setStatus(d.status === 'starting' ? 'Starting the model…' : 'Generating…');
        await new Promise(r => setTimeout(r, POLL_MS));
        if (cancelled.current) return;
        const poll = await fetch('/api/generate?id=' + encodeURIComponent(d.id));
        d = await poll.json();
        if (!poll.ok) throw new Error(d.error || 'Lost track of that run.');
      }

      if (d.status === 'failed') throw new Error(d.error || 'The model failed on this prompt.');
      if (d.status !== 'succeeded') throw new Error('Still running after ten minutes — check it on replicate.com.');
      if (!d.urls?.length) throw new Error('The model returned nothing.');

      const run = ++runNo.current;
      setResults(prev => [
        ...d.urls.map((url: string, i: number) => ({
          key: run + '-' + d.id + '-' + i, url, kind: model.kind, model: model.label, prompt,
        })),
        ...prev,
      ].slice(0, 24));
      setStatus('');
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="card-hd"><h2>Generate</h2>
        {configured === false && <span className="pill warn">No API token</span>}
      </div>

      {configured === false && (
        <p className="banner">
          <b>Set REPLICATE_API_TOKEN</b> in <code>.env.local</code> and restart the dev server.
          Everything else on this page works without it — this panel is the only part that calls out.
        </p>
      )}

      <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <span className="lbl">Model</span>
          <select value={model?.id || ''} onChange={e => setModelId(e.target.value)} className="pd-select"
            disabled={!forKind.length}>
            {forKind.length
              ? forKind.map(m => <option key={m.id} value={m.id}>{m.label}</option>)
              : <option value="">{configured === null ? 'Loading models…' : 'No models available'}</option>}
          </select>
          {model && <p className="pd-note">{model.note}</p>}
        </div>

        {model?.takesReference && (
          <div className="field">
            <span className="lbl">Reference image {model.needsReference ? '(required)' : '(optional)'}</span>
            <div className="row">
              <label className="btn" style={{ cursor: 'pointer' }}>
                {reference ? 'Replace' : 'Choose image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                  onChange={e => pick(e.target.files?.[0])} />
              </label>
              {reference && <button className="btn danger" onClick={() => { setReference(''); setRefName(''); }}>Remove</button>}
              {refName && <span className="pd-note" style={{ margin: 0 }}>{refName}</span>}
            </div>
            {reference && <img src={reference} alt="Reference" className="pd-ref" />}
          </div>
        )}

        {error && <p className="banner err" style={{ borderRadius: 12, border: 0 }}>{error}</p>}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="pd-note" style={{ margin: 0 }}>
            {status || (model?.kind === 'video' ? 'Video takes a few minutes.' : 'Stills take a few seconds.')}
          </span>
          <button className="btn primary" onClick={run}
            disabled={busy || !model || !prompt.trim() || (model.needsReference && !reference)}>
            {busy ? 'Working…' : 'Generate'}
          </button>
        </div>

        {results.length > 0 && (
          <>
            <span className="lbl">Results — these links expire an hour after the run, so download what you want to keep</span>
            <div className="pd-gallery">
              {results.map(r => (
                <figure key={r.key}>
                  {r.kind === 'video'
                    ? <video src={r.url} controls playsInline preload="metadata" />
                    /* eslint-disable-next-line @next/next/no-img-element */
                    : <img src={r.url} alt={r.prompt.slice(0, 120)} />}
                  <figcaption>
                    <span>{r.model}</span>
                    <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
