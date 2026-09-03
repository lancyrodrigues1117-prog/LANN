'use client';

import { OPTS, SHOT_SPEC, Shot } from '@/lib/prompt';

/* SHOT_SPEC drives the inputs, so the field key is only known as a string. */
const val = (sh: Shot, k: string) => (sh as unknown as Record<string, string | undefined>)[k] || '';

export default function ShotEditor({ shots, onChange }: {
  shots: Shot[];
  onChange: (next: Shot[]) => void;
}) {
  const set = (i: number, k: string, v: string) =>
    onChange(shots.map((s, n) => (n === i ? { ...s, [k]: v } : s)));

  const move = (i: number, by: number) => {
    const next = shots.slice();
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row);
    onChange(next);
  };

  if (!shots.length) return <p className="pd-empty">No shots yet. Add one, or load a template above.</p>;

  return (
    <>
      {shots.map((sh, i) => (
        <div className="pd-shot" key={sh.id}>
          <div className="pd-shot-hd">
            <span className="pd-shot-n">{i + 1}</span>
            <input value={sh.name || ''} placeholder="Shot name" onChange={e => set(i, 'name', e.target.value)} />
            <button className="pd-mv" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>&#9650;</button>
            <button className="pd-mv" title="Move down" disabled={i === shots.length - 1} onClick={() => move(i, 1)}>&#9660;</button>
            <button className="pd-mv del" title="Delete shot" onClick={() => onChange(shots.filter((_, n) => n !== i))}>&#10005;</button>
          </div>
          <div className="pd-fields">
            {SHOT_SPEC.map(f => (
              <label key={f.k} className={'pd-f' + (f.w === 2 ? ' w2' : '')}>
                <span className="lbl">{f.l}</span>
                <input
                  value={val(sh, f.k)}
                  list={f.o ? 'dl-' + f.k : undefined}
                  placeholder={f.ph || (OPTS[f.k] ? OPTS[f.k][0] : '')}
                  onChange={e => set(i, f.k, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
