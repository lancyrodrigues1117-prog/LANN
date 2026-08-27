'use client';

/* Reads the text out of a PDF in the browser. No libraries: the file is scanned
   for objects, the streams are inflated with DecompressionStream, the content
   streams are tokenised, and the text runs are grouped back into lines by their
   position on the page. Written against real Zoho exports. */

export interface PdfRead {
  lines: string[];
  encrypted: boolean;
  objects: number;
  streams: number;
  textStreams: number;
  chars: number;
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  return out;
}

function ascii85(bytes: Uint8Array): Uint8Array {
  let start = 0;
  if (bytes.length > 1 && bytes[0] === 60 && bytes[1] === 126) start = 2;
  const out: number[] = [];
  let tuple = 0, count = 0;
  for (let i = start; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 126) break;
    if (c === 122 && count === 0) { out.push(0, 0, 0, 0); continue; }
    if (c < 33 || c > 117) continue;
    tuple = tuple * 85 + (c - 33);
    if (++count === 5) {
      out.push(Math.floor(tuple / 16777216) % 256, Math.floor(tuple / 65536) % 256,
               Math.floor(tuple / 256) % 256, tuple % 256);
      tuple = 0; count = 0;
    }
  }
  if (count > 0) {
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84;
    const b = [Math.floor(tuple / 16777216) % 256, Math.floor(tuple / 65536) % 256,
               Math.floor(tuple / 256) % 256, tuple % 256];
    for (let i = 0; i < count - 1; i++) out.push(b[i]);
  }
  return new Uint8Array(out);
}

function asciiHex(bytes: Uint8Array): Uint8Array {
  let h = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = String.fromCharCode(bytes[i]);
    if (c === '>') break;
    if (/[0-9A-Fa-f]/.test(c)) h += c;
  }
  if (h.length % 2) h += '0';
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  // A stream one byte too long makes the decompressor reject the whole thing,
  // so shave the tail and try again before giving up.
  for (let cut = 0; cut <= 2; cut++) {
    const b = cut ? bytes.subarray(0, bytes.length - cut) : bytes;
    if (!b.length) break;
    for (const format of ['deflate', 'deflate-raw'] as const) {
      try {
        const ds = new DecompressionStream(format);
        const buf = await new Response(new Blob([b as BlobPart]).stream().pipeThrough(ds)).arrayBuffer();
        if (buf.byteLength) return new Uint8Array(buf);
      } catch { /* try the next shape */ }
    }
  }
  return null;
}

async function decodeStream(raw: Uint8Array, dict: string): Promise<Uint8Array | null> {
  const m = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict);
  const filters = m ? (m[1].match(/\/([A-Za-z0-9]+)/g) || []).map(x => x.slice(1)) : [];
  let data: Uint8Array | null = raw;
  for (const f of filters) {
    if (!data) return null;
    if (f === 'FlateDecode') data = await inflate(data);
    else if (f === 'ASCII85Decode') data = ascii85(data);
    else if (f === 'ASCIIHexDecode') data = asciiHex(data);
    else return null;   // an image, or a filter we do not handle
  }
  return data;
}

interface PdfObject { start: number; body: string }

function scanObjects(s: string): Record<number, PdfObject> {
  const objs: Record<number, PdfObject> = {};
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endobj', start);
    objs[Number(m[1])] = { start, body: s.slice(start, end < 0 ? s.length : end) };
  }
  return objs;
}

function streamOf(bytes: Uint8Array, s: string, obj: PdfObject | undefined): Uint8Array | null {
  if (!obj) return null;
  const i = obj.body.indexOf('stream');
  if (i < 0) return null;
  let p = obj.start + i + 6;
  if (s[p] === '\r') p++;
  if (s[p] === '\n') p++;
  // /Length is exact; the newline writers put before "endstream" is not data.
  const lm = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(obj.body);
  if (lm) {
    const end = p + Number(lm[1]);
    if (end <= bytes.length && /^\s*endstream/.test(s.slice(end, end + 12))) return bytes.subarray(p, end);
  }
  let e = s.indexOf('endstream', p);
  if (e < 0) return null;
  while (e > p && (s[e - 1] === '\n' || s[e - 1] === '\r')) e--;
  return bytes.subarray(p, e);
}

const hexToStr = (h: string) => {
  let out = '';
  for (let i = 0; i < h.length; i += 4) out += String.fromCharCode(parseInt(h.substr(i, 4).padEnd(4, '0'), 16));
  return out;
};

type CMap = Record<number, string>;

function parseCMap(txt: string): CMap {
  const map: CMap = {};
  let m: RegExpExecArray | null;
  let re = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = re.exec(txt))) {
    const pr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(m[1]))) map[parseInt(p[1], 16)] = hexToStr(p[2]);
  }
  re = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = re.exec(txt))) {
    const pr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(m[1]))) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
      if (p[3] !== undefined) {
        const base = parseInt(p[3], 16);
        for (let c = lo; c <= hi && c - lo < 4096; c++) map[c] = String.fromCharCode(base + (c - lo));
      } else {
        const list = (p[4].match(/<([0-9A-Fa-f]+)>/g) || []);
        list.forEach((it, idx) => { map[lo + idx] = hexToStr(it.replace(/[<>]/g, '')); });
      }
    }
  }
  return map;
}

interface Fonts { cmaps: Record<string, CMap>; wide: Record<string, boolean> }

async function buildFonts(bytes: Uint8Array, s: string, objs: Record<number, PdfObject>): Promise<Fonts> {
  const toUnicode: Record<number, number> = {};
  const resources: Record<string, number> = {};
  const cmaps: Record<string, CMap> = {};
  const wide: Record<string, boolean> = {};

  for (const num in objs) {
    const mm = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(objs[num].body);
    if (mm) toUnicode[Number(num)] = Number(mm[1]);
  }
  let m: RegExpExecArray | null;
  const re = /\/Font\s*<<([\s\S]*?)>>/g;
  while ((m = re.exec(s))) {
    const pr = /\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g;
    let p: RegExpExecArray | null;
    while ((p = pr.exec(m[1]))) resources[p[1]] = Number(p[2]);
  }
  for (const name in resources) {
    const fo = resources[name];
    const dict = objs[fo] ? objs[fo].body : '';
    wide[name] = /\/Type0|\/Identity-H|\/Identity-V/.test(dict);
    const uo = toUnicode[fo];
    if (uo == null) continue;
    const raw = streamOf(bytes, s, objs[uo]);
    if (!raw) continue;
    const inf = await decodeStream(raw, objs[uo].body);
    if (inf) cmaps[name] = parseCMap(latin1(inf));
  }
  return { cmaps, wide };
}

type Token =
  | { t: 'str'; v: string; hex: boolean }
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'op'; v: string };

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  const DELIM = /[\s/[\]<>()]/;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\u0000') { i++; continue; }
    if (c === '(') {
      let depth = 1, j = i + 1, buf = '';
      while (j < s.length && depth > 0) {
        const ch = s[j];
        if (ch === '\\') {
          const nx = s[j + 1];
          const esc: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
          if (nx in esc) { buf += esc[nx]; j += 2; continue; }
          if (nx >= '0' && nx <= '7') {
            let o = '', k = j + 1;
            while (k < s.length && s[k] >= '0' && s[k] <= '7' && o.length < 3) { o += s[k]; k++; }
            buf += String.fromCharCode(parseInt(o, 8)); j = k; continue;
          }
          j += 2; continue;
        }
        if (ch === '(') { depth++; buf += ch; j++; continue; }
        if (ch === ')') { depth--; j++; if (depth === 0) break; buf += ch; continue; }
        buf += ch; j++;
      }
      out.push({ t: 'str', v: buf, hex: false }); i = j; continue;
    }
    if (c === '<' && s[i + 1] === '<') { out.push({ t: 'op', v: '<<' }); i += 2; continue; }
    if (c === '>' && s[i + 1] === '>') { out.push({ t: 'op', v: '>>' }); i += 2; continue; }
    if (c === '<') {
      const e = s.indexOf('>', i);
      out.push({ t: 'str', v: s.slice(i + 1, e < 0 ? s.length : e).replace(/\s/g, ''), hex: true });
      i = e < 0 ? s.length : e + 1; continue;
    }
    if (c === '[' || c === ']') { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '/') {
      let j = i + 1;
      while (j < s.length && !DELIM.test(s[j])) j++;
      out.push({ t: 'name', v: s.slice(i + 1, j) }); i = j; continue;
    }
    if ((c >= '0' && c <= '9') || c === '-' || c === '+' || c === '.') {
      let j = i;
      while (j < s.length && /[-+.\d]/.test(s[j])) j++;
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) || 0 }); i = j; continue;
    }
    let j = i;
    while (j < s.length && !DELIM.test(s[j])) j++;
    if (j === i) j++;
    out.push({ t: 'op', v: s.slice(i, j) }); i = j;
  }
  return out;
}

/* Rough advance widths in em. Enough to tell a gap between words from the slack
   left inside one when a font draws a glyph at a time. */
const WIDTH: Record<string, number> = {};
((): void => {
  const set = (chars: string, v: number) => { for (const c of chars) WIDTH[c] = v; };
  set(' ', 0.26); set("ijlI.,:;'!|", 0.28); set('frt()[]{}/\\-', 0.34);
  set('0123456789$%', 0.56);
  set('abcdeghknopqsuvxyz', 0.55); set('mw', 0.85);
  set('ABCDEFGHJKLNOPQRSTUVXYZ&', 0.68); set('MW', 0.92);
})();

const runWidth = (txt: string, em: number) => {
  let t = 0;
  for (let i = 0; i < txt.length; i++) { const w = WIDTH[txt[i]]; t += w === undefined ? 0.55 : w; }
  return t * em;
};

interface Piece { x: number; y: number; t: string; w: number; em: number }

function runContent(tokens: Token[], fonts: Fonts): Piece[] {
  const out: Piece[] = [];
  let stack: Token[] = [];
  let tm: number[] | null = null, lm: number[] | null = null;
  let leading = 0, font: string | null = null, size = 10;

  const scale = () => (tm ? Math.hypot(tm[0], tm[1]) || 1 : 1);
  const decode = (tok: Token & { t: 'str' }): string => {
    const cm = font ? fonts.cmaps[font] : undefined;
    const wide = font ? !!fonts.wide[font] : false;
    if (tok.hex) {
      const h = tok.v;
      let a = '';
      if (cm || wide) {
        for (let i = 0; i < h.length; i += 4) {
          const c = parseInt(h.substr(i, 4).padEnd(4, '0'), 16);
          a += cm && cm[c] != null ? cm[c] : c > 31 ? String.fromCharCode(c) : '';
        }
        return a;
      }
      for (let i = 0; i < h.length; i += 2) a += String.fromCharCode(parseInt(h.substr(i, 2), 16));
      return a;
    }
    if (wide) {
      // two bytes per glyph, falling back to the code point where the map is short
      let a = '';
      for (let i = 0; i + 1 < tok.v.length; i += 2) {
        const code = (tok.v.charCodeAt(i) << 8) | tok.v.charCodeAt(i + 1);
        a += cm && cm[code] != null ? cm[code] : code > 31 ? String.fromCharCode(code) : '';
      }
      return a;
    }
    if (cm) {
      let a = '';
      for (let i = 0; i < tok.v.length; i++) { const c = tok.v.charCodeAt(i); a += cm[c] != null ? cm[c] : tok.v[i]; }
      return a;
    }
    return tok.v;
  };
  const show = (txt: string) => {
    if (!tm) tm = [1, 0, 0, 1, 0, 0];
    const em = size * scale();
    const w = runWidth(txt, em);
    if (txt) out.push({ x: tm[4], y: tm[5], t: txt, w, em });
    tm[4] += w;
  };

  for (const tok of tokens) {
    if (tok.t !== 'op') { stack.push(tok); continue; }
    const op = tok.v;
    if (op === '[') { stack = []; continue; }
    if (op === ']' || op === '<<' || op === '>>') continue;
    const nums = stack.filter(x => x.t === 'num').map(x => (x as { v: number }).v);
    const strs = stack.filter(x => x.t === 'str') as (Token & { t: 'str' })[];

    if (op === 'BT') { tm = [1, 0, 0, 1, 0, 0]; lm = tm.slice(); }
    else if (op === 'Tf') {
      const nm = stack.filter(x => x.t === 'name').pop() as { v: string } | undefined;
      font = nm ? nm.v : null;
      if (nums.length) size = Math.abs(nums[nums.length - 1]) || 10;
    }
    else if (op === 'TL') leading = nums[nums.length - 1] || 0;
    else if (op === 'Td' || op === 'TD') {
      const ty = nums.length ? nums[nums.length - 1] : 0;
      const tx = nums.length > 1 ? nums[nums.length - 2] : 0;
      if (op === 'TD') leading = -ty;
      lm = lm || [1, 0, 0, 1, 0, 0]; lm[4] += tx; lm[5] += ty; tm = lm.slice();
    }
    else if (op === 'Tm') { if (nums.length >= 6) { lm = nums.slice(-6); tm = lm.slice(); } }
    else if (op === 'T*') { lm = lm || [1, 0, 0, 1, 0, 0]; lm[5] -= leading; tm = lm.slice(); }
    else if (op === 'Tj') { const s0 = strs.pop(); if (s0) show(decode(s0)); }
    else if (op === "'" || op === '"') {
      lm = lm || [1, 0, 0, 1, 0, 0]; lm[5] -= leading; tm = lm.slice();
      const s0 = strs.pop(); if (s0) show(decode(s0));
    }
    else if (op === 'TJ') {
      // one item per element, with the kern moving the pen, so position decides
      // the spacing afterwards
      if (!tm) tm = [1, 0, 0, 1, 0, 0];
      for (const x of stack) {
        if (x.t === 'str') show(decode(x));
        else if (x.t === 'num') tm[4] -= (x.v / 1000) * size * scale();
      }
    }
    stack = [];
  }
  return out;
}

const CONTROL = /[\u0000-\u0008\u000e-\u001f]/g;

function groupLines(pieces: Piece[]): string[] {
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: { y: number; parts: Piece[] }[] = [];
  let cur: { y: number; parts: Piece[] } | null = null;
  for (const p of pieces) {
    if (!cur || Math.abs(cur.y - p.y) > 2.5) { cur = { y: p.y, parts: [] }; rows.push(cur); }
    cur.parts.push(p);
  }
  return rows.map(r => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = '', end: number | null = null;
    for (const p of r.parts) {
      if (end !== null && p.x - end > (p.em || 10) * 0.45) out += ' ';
      out += p.t;
      end = p.x + p.w;
    }
    return out.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

export async function readPdf(buf: ArrayBuffer): Promise<PdfRead> {
  const bytes = new Uint8Array(buf);
  const s = latin1(bytes);
  const objs = scanObjects(s);
  const result: PdfRead = {
    lines: [],
    encrypted: /\/Encrypt\s+\d+\s+\d+\s+R/.test(s),
    objects: Object.keys(objs).length,
    streams: 0, textStreams: 0, chars: 0,
  };
  const fonts = await buildFonts(bytes, s, objs);
  for (const num in objs) {
    const raw = streamOf(bytes, s, objs[num]);
    if (!raw) continue;
    result.streams++;
    const data = await decodeStream(raw, objs[num].body);
    if (!data) continue;
    const txt = latin1(data);
    if (!/\bBT\b/.test(txt) || !/(Tj|TJ)/.test(txt)) continue;
    result.textStreams++;
    // group per page: y positions repeat, so a document-wide grouping welds a row
    // from one page onto a paragraph from another
    try { result.lines = result.lines.concat(groupLines(runContent(tokenize(txt), fonts))); } catch { /* skip a bad page */ }
  }
  result.chars = result.lines.join('').length;
  return result;
}
