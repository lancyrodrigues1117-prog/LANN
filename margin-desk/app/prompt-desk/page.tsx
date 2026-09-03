'use client';

import { useEffect, useMemo, useState } from 'react';
import PromptFields, { Datalists } from '@/components/PromptFields';
import ShotEditor from '@/components/ShotEditor';
import Generator from '@/components/Generator';
import {
  AR, Fields, IMAGE_PRESETS, MODELS, NEG_GROUPS, OPTS, SHOT_TEMPLATES, Shot,
  VIDEO_PRESETS, View, build, clean, generationPrompt, negTerms, runtimeSeconds,
  seconds, specFor,
} from '@/lib/prompt';

const KEY = 'hbn-prompt-desk-1';
const VARY: Record<string, string[]> = {
  image: ['lighting', 'lens', 'mood', 'palette'],
  video: ['move', 'lighting', 'pacing', 'mood'],
};

const newShot = (): Shot => ({ id: Math.random().toString(36).slice(2), name: '', action: '', move: '', duration: '5 seconds' });
const presetsFor = (v: View) => (v === 'image' ? IMAGE_PRESETS : v === 'video' ? VIDEO_PRESETS : SHOT_TEMPLATES);

interface Saved { id: string; title: string; model: string; text: string; fav: boolean }

export default function PromptDesk() {
  const [view, setView] = useState<View>('image');
  const [model, setModel] = useState<Record<View, string>>({ image: 'mj', video: 'sora', shots: 'sora' });
  const [ar, setAr] = useState<Record<View, string>>({ image: '1:1', video: '16:9', shots: '16:9' });
  const [data, setData] = useState<Record<'image' | 'video', Fields>>({
    image: { ...IMAGE_PRESETS[0].d }, video: { ...VIDEO_PRESETS[0].d },
  });
  const [scene, setScene] = useState<Fields>({ ...SHOT_TEMPLATES[0].scene });
  const [shots, setShots] = useState<Shot[]>(SHOT_TEMPLATES[0].shots.map(s => ({ ...newShot(), ...s })));
  const [neg, setNeg] = useState<Record<string, boolean>>(
    Object.fromEntries(NEG_GROUPS.map(g => [g.k, !!g.on])));
  const [preset, setPreset] = useState<Record<View, number | null>>({ image: 0, video: 0, shots: 0 });
  const [saved, setSaved] = useState<Saved[]>([]);
  const [vars, setVars] = useState<{ label: string; text: string }[]>([]);
  const [genShot, setGenShot] = useState(0);
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);

  /* Restore before the first save runs, so an empty first render cannot wipe
     what is in storage. */
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d) {
        if (['image', 'video', 'shots'].includes(d.view)) setView(d.view);
        if (d.model) setModel(m => ({ ...m, ...d.model }));
        if (d.ar) setAr(a => ({ ...a, ...d.ar }));
        if (d.data) setData(x => ({ image: { ...x.image, ...d.data.image }, video: { ...x.video, ...d.data.video } }));
        if (d.scene) setScene(d.scene);
        if (Array.isArray(d.shots) && d.shots.length) setShots(d.shots.map((s: Shot) => ({ ...newShot(), ...s })));
        if (d.neg) setNeg(n => ({ ...n, ...d.neg }));
        if (d.preset) setPreset(p => ({ ...p, ...d.preset }));
        if (Array.isArray(d.saved)) setSaved(d.saved);
      }
    } catch { /* first visit, or storage is unavailable */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ view, model, ar, data, scene, shots, neg, preset, saved: saved.slice(0, 40) }));
    } catch { /* private window, or the quota is full */ }
  }, [ready, view, model, ar, data, scene, shots, neg, preset, saved]);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(h);
  }, [toast]);

  const fields = view === 'shots' ? scene : data[view];
  const terms = useMemo(() => negTerms(neg), [neg]);
  const input = { view, model: model[view], ar: ar[view], fields, shots, neg: terms };
  const built = useMemo(() => build(input), [view, model, ar, fields, shots, terms]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (k: string, v: string) => {
    if (view === 'shots') setScene(s => ({ ...s, [k]: v }));
    else setData(d => ({ ...d, [view]: { ...d[view], [k]: v } }));
    setPreset(p => ({ ...p, [view]: null }));
  };

  function applyPreset(i: number) {
    setPreset(p => ({ ...p, [view]: i }));
    if (view === 'shots') {
      const t = SHOT_TEMPLATES[i];
      setScene({ ...t.scene });
      setShots(t.shots.map(s => ({ ...newShot(), ...s })));
      setAr(a => ({ ...a, shots: t.ar }));
      setGenShot(0);
    } else {
      const p = presetsFor(view)[i] as { d: Fields; ar: string };
      setData(d => ({ ...d, [view]: { ...p.d } }));
      setAr(a => ({ ...a, [view]: p.ar }));
    }
  }

  function clearAll() {
    if (view === 'shots') { setScene({}); setShots([newShot()]); setGenShot(0); }
    else setData(d => ({ ...d, [view]: {} }));
    setPreset(p => ({ ...p, [view]: null }));
  }

  function shuffle() {
    if (view === 'shots') return;
    const keys = VARY[view];
    setVars(Array.from({ length: 4 }, () => {
      const alt: Fields = { ...fields };
      const changed: string[] = [];
      keys.forEach(k => {
        const pool = (OPTS[k] || []).filter(v => v !== clean(alt[k]));
        if (!pool.length) return;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        alt[k] = pick; changed.push(pick);
      });
      return { label: changed.slice(0, 2).join(' · '), text: build({ ...input, fields: alt }).text };
    }));
  }

  async function copy(text: string, msg: string) {
    if (!clean(text)) { setToast('Nothing to copy yet'); return; }
    try { await navigator.clipboard.writeText(text); setToast(msg); }
    catch { setToast('Copy blocked — select the text instead'); }
  }

  function savePrompt() {
    if (!clean(built.text)) { setToast('Nothing to save yet'); return; }
    const title = view === 'shots'
      ? (clean(scene.subject) || 'Shot list') + ' · ' + shots.length + ' shots'
      : (clean(fields.subject) || 'Untitled');
    const row: Saved = {
      id: 'h' + Date.now() + Math.floor(Math.random() * 1000),
      title: title.slice(0, 60),
      model: (MODELS[view].find(m => m.k === model[view]) || { l: '' }).l,
      text: built.text, fav: false,
    };
    setSaved(s => [row, ...s].sort((a, b) => Number(b.fav) - Number(a.fav)).filter((h, i) => h.fav || i < 30));
    setToast('Saved');
  }

  const genKind: 'image' | 'video' = view === 'image' ? 'image' : 'video';
  const genSeconds = view === 'video' ? seconds(fields.duration)
    : view === 'shots' ? seconds(shots[genShot]?.duration) : 0;
  const genPrompt = generationPrompt(input, genShot);
  const words = built.text ? built.text.trim().split(/\s+/).length : 0;

  return (
    <>
      <Datalists />
      <header className="pd-top">
        <div>
          <h1>Prompt Desk</h1>
          <p className="pd-sub">Structured prompts for image and video models, and a Generate button that runs them.</p>
        </div>
        <div className="tabs">
          {(['image', 'video', 'shots'] as View[]).map(v => (
            <a key={v} href="#" data-active={view === v}
              onClick={e => { e.preventDefault(); setView(v); setVars([]); }}>
              {v === 'shots' ? 'Shot list' : v === 'image' ? 'Image' : 'Video'}
            </a>
          ))}
        </div>
      </header>

      <div className="pd-shell">
        <div className="pd-col">
          <section className="card">
            <div className="card-hd">
              <h2>{view === 'shots' ? 'Templates' : 'Presets'}</h2>
              <button className="btn" onClick={clearAll}>Clear fields</button>
            </div>
            <div className="pd-bd">
              <div className="pd-chips">
                {presetsFor(view).map((p, i) => (
                  <button key={p.n} className="pd-chip" aria-pressed={preset[view] === i} onClick={() => applyPreset(i)}>{p.n}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-hd">
              <h2>{view === 'shots' ? 'Scene defaults' : 'The shot'}</h2>
              <span className="pd-count">
                {specFor(view).filter(f => clean(fields[f.k])).length} of {specFor(view).length} filled
              </span>
            </div>
            <div className="pd-bd">
              <PromptFields spec={specFor(view)} values={fields} onChange={setField} />
            </div>
          </section>

          {view === 'shots' && (
            <section className="card">
              <div className="card-hd">
                <h2>Shots</h2>
                <button className="btn primary" onClick={() => { setShots(s => [...s, newShot()]); setPreset(p => ({ ...p, shots: null })); }}>Add shot</button>
              </div>
              <div className="pd-bd">
                <ShotEditor shots={shots} onChange={next => { setShots(next); setPreset(p => ({ ...p, shots: null })); }} />
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-hd"><h2>Frame</h2></div>
            <div className="pd-bd">
              <div className="pd-ars">
                {AR.map(a => (
                  <button key={a.v} className="pd-ar" aria-pressed={ar[view] === a.v}
                    onClick={() => setAr(x => ({ ...x, [view]: a.v }))}>
                    <i style={{ width: a.w, height: a.h }} />
                    <span>{a.v}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-hd">
              <h2>Negative prompt</h2>
              <button className="btn" onClick={() => setNeg(Object.fromEntries(NEG_GROUPS.map(g => [g.k, !!g.on])))}>Sensible defaults</button>
            </div>
            <div className="pd-bd">
              <div className="pd-negs">
                {NEG_GROUPS.map(g => (
                  <div className="pd-neg-g" key={g.k}>
                    <span className="lbl">{g.l}</span>
                    <button className="pd-tog" aria-pressed={!!neg[g.k]} onClick={() => setNeg(n => ({ ...n, [g.k]: !n[g.k] }))}>
                      {g.terms.slice(0, 2).join(', ')}{g.terms.length > 2 ? ' +' + (g.terms.length - 2) : ''}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="pd-col right">
          <section className="card">
            <div className="card-hd">
              <h2>Prompt</h2>
              <div className="tabs sm">
                {MODELS[view].map(m => (
                  <a key={m.k} href="#" data-active={model[view] === m.k}
                    onClick={e => { e.preventDefault(); setModel(x => ({ ...x, [view]: m.k })); }}>{m.l}</a>
                ))}
              </div>
            </div>
            <div className="pd-bd">
              <pre className="pd-out">{built.text || 'Fill in a subject to start.'}</pre>
              {built.neg && (
                <div style={{ marginTop: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="lbl">Negative</span>
                    <button className="btn" onClick={() => copy(built.neg, 'Negative prompt copied')}>Copy</button>
                  </div>
                  <pre className="pd-out short">{built.neg}</pre>
                </div>
              )}
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <span className="pd-count">
                  {view === 'shots'
                    ? `${shots.length} shots · ${runtimeSeconds(shots)}s total · ${words} words`
                    : `${words} words · ${built.text.length} characters`}
                </span>
                <span className="row">
                  <button className="btn" onClick={savePrompt}>Save</button>
                  <button className="btn primary" onClick={() => copy(built.text, 'Prompt copied')}>Copy prompt</button>
                </span>
              </div>
            </div>
          </section>

          {view === 'shots' && shots.length > 0 && (
            <section className="card" style={{ marginTop: 20 }}>
              <div className="card-hd"><h2>Shot to generate</h2></div>
              <div className="pd-bd">
                <div className="pd-chips">
                  {shots.map((sh, i) => (
                    <button key={sh.id} className="pd-chip" aria-pressed={genShot === i} onClick={() => setGenShot(i)}>
                      {i + 1}. {clean(sh.name) || 'Shot ' + (i + 1)}
                    </button>
                  ))}
                </div>
                <p className="pd-note">A shot list renders as a numbered sequence for a human; generation runs one shot at a time.</p>
              </div>
            </section>
          )}

          <Generator prompt={genPrompt} negative={built.neg} aspect={ar[view]} seconds={genSeconds} kind={genKind} />

          {view !== 'shots' && (
            <section className="card" style={{ marginTop: 20 }}>
              <div className="card-hd"><h2>Variations</h2><button className="btn" onClick={shuffle}>Shuffle 4</button></div>
              {vars.length ? vars.map((v, i) => (
                <div className="pd-item" key={i}>
                  <div className="pd-txt"><b>{v.label}</b><br />{v.text}</div>
                  <button className="btn" onClick={() => copy(v.text, 'Variation copied')}>Copy</button>
                </div>
              )) : <p className="pd-empty pad">Four alternates of the same shot, with the light, lens and mood swapped.</p>}
            </section>
          )}

          <section className="card" style={{ marginTop: 20 }}>
            <div className="card-hd"><h2>Saved</h2>
              <button className="btn" onClick={() => setSaved(s => s.filter(h => h.fav))}>Clear</button>
            </div>
            {saved.length ? saved.map(h => (
              <div className="pd-item" key={h.id}>
                <button className="pd-star" aria-pressed={h.fav}
                  onClick={() => setSaved(s => s.map(x => (x.id === h.id ? { ...x, fav: !x.fav } : x))
                    .sort((a, b) => Number(b.fav) - Number(a.fav)))}>&#9733;</button>
                <div className="pd-txt"><b>{h.title}</b> · {h.model}<br />{h.text.slice(0, 190)}</div>
                <span className="row">
                  <button className="btn" onClick={() => copy(h.text, 'Copied')}>Copy</button>
                  <button className="btn danger" onClick={() => setSaved(s => s.filter(x => x.id !== h.id))}>&#10005;</button>
                </span>
              </div>
            )) : <p className="pd-empty pad">Saved prompts land here. Favourites stay at the top.</p>}
          </section>
        </div>
      </div>

      {toast && <div className="pd-toast">{toast}</div>}
    </>
  );
}
