'use client';

import { FieldSpec, Fields, OPTS } from '@/lib/prompt';

/* One datalist per vocabulary key, rendered once for the whole page. Typing a
   value that is not on the list is always kept — these are suggestions. */
export function Datalists() {
  return (
    <>
      {Object.keys(OPTS).map(k => (
        <datalist key={k} id={'dl-' + k}>
          {OPTS[k].map(v => <option key={v} value={v} />)}
        </datalist>
      ))}
    </>
  );
}

export default function PromptFields({ spec, values, onChange }: {
  spec: FieldSpec[];
  values: Fields;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <div className="pd-fields">
      {spec.map(f => (
        <label key={f.k} className={'pd-f' + (f.w === 2 ? ' w2' : '')}>
          <span className="lbl">{f.l}</span>
          <input
            value={values[f.k] || ''}
            list={f.o ? 'dl-' + f.k : undefined}
            placeholder={f.ph || (OPTS[f.k] ? OPTS[f.k][0] : '')}
            onChange={e => onChange(f.k, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
