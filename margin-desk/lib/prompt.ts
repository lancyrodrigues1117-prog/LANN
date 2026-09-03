/* Vocabulary, presets and prompt builders for the Prompt Desk.
 *
 * Pure data and pure functions — no React, no DOM, no network. The standalone
 * page at ../../image-prompt-desk/index.html carries its own copy of the same
 * vocabulary so it can stay a single file with no build step; this module is
 * the source of truth for the app, and the two are kept in step by hand.
 */

export type View = 'image' | 'video' | 'shots';

export interface FieldSpec {
  k: string;
  l: string;
  w?: number;      // 2 = full width
  o?: number;      // 1 = has a suggestion list
  ph?: string;
}

export interface Fields { [k: string]: string | undefined }

export interface Shot {
  id: string;
  name?: string;
  action?: string;
  move?: string;
  duration?: string;
}

export interface NegGroup { k: string; l: string; terms: string[]; on?: number }
export interface Preset { n: string; d: Fields; ar: string }
export interface TemplateShot { name: string; action: string; move: string; duration: string }
export interface ShotTemplate { n: string; scene: Fields; ar: string; shots: TemplateShot[] }

/* ---------------------------------------------------------------- vocabulary
   Every list below feeds a datalist, the preset packs and the shuffler. Typing
   a value that is not on a list is always allowed — these are suggestions, not
   an enum. */
export const OPTS: Record<string, string[]> = {
  setting: ['a rain-slicked Tokyo alley at night','a sunlit Mediterranean terrace','an abandoned industrial warehouse','a dense misty pine forest','a minimalist white studio backdrop','a cluttered artist workshop','a desert salt flat at dawn','a coastal cliff in a storm','a 1970s wood-panelled office','a neon-lit arcade','a snowbound mountain pass','a marble museum hall','a roadside diner at 2am','a greenhouse full of overgrown plants'],
  lighting: ['golden hour backlight','soft overcast daylight','hard midday sun','blue hour dusk','candlelight','neon rim light','studio three-point lighting','a single softbox key','Rembrandt lighting','volumetric god rays','moonlight through a window','firelight','bounced window light','harsh direct flash','split lighting','silhouetted against a bright sky','warm practical lamps','chiaroscuro'],
  lens: ['85mm f/1.4, shallow depth of field','35mm f/2 reportage','24mm wide angle','14mm ultra-wide','200mm telephoto compression','100mm macro','tilt-shift miniature effect','fisheye','anamorphic with horizontal flares','drone aerial','worm eye view','top-down flat lay'],
  composition: ['rule of thirds','centred symmetry','extreme close-up','medium shot','full body','wide establishing shot','over the shoulder','dutch angle','strong leading lines','negative space on the left','frame within a frame','low angle hero shot'],
  style: ['photorealistic','cinematic film still','35mm Kodak Portra 400','editorial fashion photography','oil painting, visible impasto','loose watercolour wash','ink line art','Ghibli-style anime','90s anime cel','comic book halftone','3D render, Octane','claymation','isometric low poly','pixel art','blueprint technical drawing','art deco poster','Bauhaus poster','brutalist concrete','vaporwave','charcoal sketch','stained glass'],
  palette: ['warm amber and teal','muted earth tones','monochrome black and white','pastel candy colours','high contrast red and black','desaturated cold blues','sepia','neon magenta and cyan','forest green and cream','sun-bleached beige'],
  mood: ['serene','tense','melancholy','triumphant','eerie','playful','intimate','epic','nostalgic','clinical','dreamlike','oppressive'],
  detail: ['highly detailed, intricate texture','soft and minimal','clean flat vector','gritty film grain','razor sharp, fine detail','painterly, loose brushwork'],
  move: ['slow dolly in','dolly out to reveal','lateral tracking shot','180 degree orbit','crane up','crane down','handheld follow','static lock-off','whip pan','slow push in on the eyes','drone pull-back','rack focus from foreground to background','gimbal glide through a doorway'],
  motion: ['turns slowly toward camera','walks steadily forward','hair and fabric drift in the wind','steam rises and curls','water ripples outward','leaves fall through frame','the crowd moves while the subject stays still','hands keep working without pause','sits perfectly still as the world moves around them'],
  pacing: ['slow and contemplative','steady, real time','brisk and energetic','slow motion, 120fps','time-lapse','staccato quick cuts'],
  audio: ['room tone and distant traffic','rain on glass','wind through trees','a crackling fire','a low ambient drone','ocean waves','café chatter','mechanical hum','no audio'],
  duration: ['3 seconds','5 seconds','8 seconds','10 seconds','15 seconds']
};

export const IMAGE_SPEC: FieldSpec[] = [
  {k:'subject',     l:'Subject',      w:2, ph:'a weathered fisherman mending a net'},
  {k:'action',      l:'Action',       w:2, ph:'leaning over the gunwale, hands mid-knot'},
  {k:'setting',     l:'Setting',      o:1},
  {k:'lighting',    l:'Lighting',     o:1},
  {k:'lens',        l:'Lens / camera',o:1},
  {k:'composition', l:'Composition',  o:1},
  {k:'style',       l:'Style / medium',o:1},
  {k:'palette',     l:'Colour palette',o:1},
  {k:'mood',        l:'Mood',         o:1},
  {k:'detail',      l:'Detail level', o:1}
];

export const VIDEO_SPEC: FieldSpec[] = [
  {k:'subject',  l:'Subject',       w:2, ph:'a barista in a steam-filled café'},
  {k:'action',   l:'Action',        w:2, ph:'pulling a shot of espresso'},
  {k:'start',    l:'First frame',   w:2, ph:'close on the portafilter locking into the group head'},
  {k:'end',      l:'Last frame',    w:2, ph:'wide on the finished cup sliding across the counter'},
  {k:'move',     l:'Camera move',   o:1},
  {k:'motion',   l:'Subject motion',o:1},
  {k:'duration', l:'Duration',      o:1},
  {k:'pacing',   l:'Pacing',        o:1},
  {k:'setting',  l:'Setting',       o:1},
  {k:'lighting', l:'Lighting',      o:1},
  {k:'lens',     l:'Lens / camera', o:1},
  {k:'style',    l:'Style / medium',o:1},
  {k:'palette',  l:'Colour palette',o:1},
  {k:'mood',     l:'Mood',          o:1},
  {k:'audio',    l:'Audio',         w:2, o:1}
];

/* Scene defaults for the shot list: everything a sequence should hold constant
   so six shots read as one film rather than six unrelated clips. */
export const SCENE_SPEC: FieldSpec[] = [
  {k:'subject',  l:'Subject / product', w:2, ph:'the Aurora desk lamp'},
  {k:'setting',  l:'Setting',  o:1},
  {k:'lighting', l:'Lighting', o:1},
  {k:'style',    l:'Style / medium', o:1},
  {k:'palette',  l:'Colour palette', o:1},
  {k:'mood',     l:'Mood',     o:1},
  {k:'lens',     l:'Lens / camera', o:1},
  {k:'audio',    l:'Audio',    o:1}
];

export const SHOT_SPEC: FieldSpec[] = [
  {k:'action',   l:'What happens', w:2, ph:'the lamp arm unfolds in one smooth motion'},
  {k:'move',     l:'Camera move',  o:1},
  {k:'duration', l:'Duration',     o:1}
];

/* Drawn to scale so the picker reads as a shape, not a dropdown. */
export const AR: { v: string; w: number; h: number }[] = [
  {v:'1:1',  w:44, h:44}, {v:'4:5',  w:38, h:47}, {v:'2:3', w:33, h:49},
  {v:'3:2',  w:54, h:36}, {v:'16:9', w:62, h:35}, {v:'9:16',w:28, h:50},
  {v:'21:9', w:68, h:29}
];

export const NEG_GROUPS: NegGroup[] = [
  {k:'anatomy', l:'Anatomy',  terms:['extra fingers','extra limbs','deformed hands','mutated face','asymmetric eyes'], on:1},
  {k:'text',    l:'Text',     terms:['text','watermark','signature','logo','caption'], on:1},
  {k:'quality', l:'Quality',  terms:['blurry','lowres','jpeg artifacts','oversaturated','overexposed','noise'], on:1},
  {k:'framing', l:'Framing',  terms:['cropped head','cut off limbs','duplicate subject','tiling']},
  {k:'style',   l:'Style leaks', terms:['cartoon','plastic skin','uncanny','3d render','airbrushed']}
];

export const IMAGE_PRESETS: Preset[] = [
  {n:'Cinematic product shot', d:{subject:'a matte black wireless speaker',action:'standing on a wet slate slab',setting:'a minimalist white studio backdrop',lighting:'a single softbox key',lens:'100mm macro',composition:'centred symmetry',style:'photorealistic',palette:'desaturated cold blues',mood:'clinical',detail:'razor sharp, fine detail'}, ar:'1:1'},
  {n:'Anime key visual', d:{subject:'a teenage girl in a school uniform',action:'running as the wind lifts her hair',setting:'a snowbound mountain pass',lighting:'golden hour backlight',lens:'35mm f/2 reportage',composition:'rule of thirds',style:'Ghibli-style anime',palette:'pastel candy colours',mood:'nostalgic',detail:'painterly, loose brushwork'}, ar:'16:9'},
  {n:'Architectural render', d:{subject:'a concrete and glass pavilion',action:'reflected in a still shallow pool',setting:'a coastal cliff in a storm',lighting:'blue hour dusk',lens:'24mm wide angle',composition:'strong leading lines',style:'3D render, Octane',palette:'monochrome black and white',mood:'serene',detail:'razor sharp, fine detail'}, ar:'3:2'},
  {n:'Food photography', d:{subject:'a bowl of ramen with a soft-boiled egg',action:'steam curling off the broth',setting:'a roadside diner at 2am',lighting:'bounced window light',lens:'100mm macro',composition:'top-down flat lay',style:'editorial fashion photography',palette:'warm amber and teal',mood:'intimate',detail:'highly detailed, intricate texture'}, ar:'4:5'},
  {n:'Corporate headshot', d:{subject:'a woman in her forties in a charcoal blazer',action:'arms folded, a slight smile',setting:'a minimalist white studio backdrop',lighting:'Rembrandt lighting',lens:'85mm f/1.4, shallow depth of field',composition:'medium shot',style:'photorealistic',palette:'muted earth tones',mood:'serene',detail:'razor sharp, fine detail'}, ar:'4:5'},
  {n:'Retro film still', d:{subject:'two strangers sharing a bench',action:'neither of them speaking',setting:'a 1970s wood-panelled office',lighting:'warm practical lamps',lens:'35mm f/2 reportage',composition:'frame within a frame',style:'35mm Kodak Portra 400',palette:'sepia',mood:'melancholy',detail:'gritty film grain'}, ar:'3:2'},
  {n:'Isometric 3D icon', d:{subject:'a tiny bank building with a coin slot',action:'coins stacked beside the door',setting:'a plain soft gradient background',lighting:'studio three-point lighting',lens:'tilt-shift miniature effect',composition:'centred symmetry',style:'isometric low poly',palette:'pastel candy colours',mood:'playful',detail:'clean flat vector'}, ar:'1:1'}
];

export const VIDEO_PRESETS: Preset[] = [
  {n:'Product hero reveal', d:{subject:'a matte black wireless speaker',action:'rotating slowly on a plinth',start:'extreme close on the speaker grille, out of focus',end:'the full product centred and sharp',move:'slow dolly in',motion:'turns slowly toward camera',duration:'8 seconds',pacing:'slow and contemplative',setting:'a minimalist white studio backdrop',lighting:'a single softbox key',lens:'85mm f/1.4, shallow depth of field',style:'photorealistic',palette:'desaturated cold blues',mood:'clinical',audio:'a low ambient drone'}, ar:'16:9'},
  {n:'Documentary interview', d:{subject:'an elderly boat builder',action:'talking to someone just off camera',start:'his hands resting on an unfinished hull',end:'his face, mid-sentence, catching the light',move:'slow push in on the eyes',motion:'hands keep working without pause',duration:'10 seconds',pacing:'steady, real time',setting:'a cluttered artist workshop',lighting:'bounced window light',lens:'35mm f/2 reportage',style:'cinematic film still',palette:'muted earth tones',mood:'intimate',audio:'room tone and distant traffic'}, ar:'16:9'},
  {n:'Drone landscape', d:{subject:'a lone road cutting through the desert',action:'a single car tracking along it',start:'tight on the road surface rushing past',end:'a vast wide of the salt flat and the horizon',move:'drone pull-back',motion:'the crowd moves while the subject stays still',duration:'15 seconds',pacing:'slow and contemplative',setting:'a desert salt flat at dawn',lighting:'golden hour backlight',lens:'drone aerial',style:'cinematic film still',palette:'sun-bleached beige',mood:'epic',audio:'a low ambient drone'}, ar:'21:9'},
  {n:'Slow-motion detail', d:{subject:'a drop of ink entering clear water',action:'blooming into a slow spiral',start:'the undisturbed surface, perfectly still',end:'the frame filled with tendrils of colour',move:'static lock-off',motion:'water ripples outward',duration:'5 seconds',pacing:'slow motion, 120fps',setting:'a minimalist white studio backdrop',lighting:'harsh direct flash',lens:'100mm macro',style:'photorealistic',palette:'neon magenta and cyan',mood:'dreamlike',audio:'no audio'}, ar:'9:16'},
  {n:'Character walk-and-talk', d:{subject:'two colleagues in a hurry',action:'crossing a busy office floor mid-argument',start:'behind them as they push through a door',end:'a two-shot as they stop at a window',move:'handheld follow',motion:'walks steadily forward',duration:'10 seconds',pacing:'brisk and energetic',setting:'a 1970s wood-panelled office',lighting:'warm practical lamps',lens:'35mm f/2 reportage',style:'cinematic film still',palette:'warm amber and teal',mood:'tense',audio:'café chatter'}, ar:'16:9'}
];

export const SHOT_TEMPLATES: ShotTemplate[] = [
  {n:'Product launch, 30s',
   scene:{subject:'the Aurora desk lamp',setting:'a minimalist white studio backdrop',lighting:'a single softbox key',style:'photorealistic',palette:'desaturated cold blues',mood:'clinical',lens:'85mm f/1.4, shallow depth of field',audio:'a low ambient drone'},
   ar:'16:9',
   shots:[
     {name:'Tease',   action:'the silhouette of the lamp against a dark ground, barely readable', move:'slow dolly in', duration:'3 seconds'},
     {name:'Reveal',  action:'light comes up and the full form resolves',                          move:'crane up',     duration:'5 seconds'},
     {name:'Detail',  action:'the machined hinge turns through its full travel',                   move:'100mm macro slide', duration:'3 seconds'},
     {name:'In use',  action:'a hand adjusts the arm over an open notebook',                       move:'handheld follow', duration:'5 seconds'},
     {name:'Range',   action:'three colourways line up in a row',                                  move:'lateral tracking shot', duration:'4 seconds'},
     {name:'End card',action:'the lamp alone, centred, logo fading in below',                      move:'static lock-off', duration:'3 seconds'}
   ]},
  {n:'Brand story, 45s',
   scene:{subject:'a small family bakery',setting:'a cluttered artist workshop',lighting:'bounced window light',style:'cinematic film still',palette:'warm amber and teal',mood:'nostalgic',lens:'35mm f/2 reportage',audio:'room tone and distant traffic'},
   ar:'16:9',
   shots:[
     {name:'Cold open',   action:'an empty shop before dawn, chairs still stacked', move:'static lock-off', duration:'5 seconds'},
     {name:'The work',    action:'flour-dusted hands folding dough',                move:'slow push in on the eyes', duration:'5 seconds'},
     {name:'The people',  action:'two bakers laugh over a tray of proving buns',    move:'handheld follow', duration:'8 seconds'},
     {name:'The customer',action:'a regular is handed a warm paper bag',            move:'over the shoulder track', duration:'8 seconds'},
     {name:'The street',  action:'the shop front alive at mid-morning',             move:'drone pull-back', duration:'8 seconds'}
   ]},
  {n:'Explainer, 60s',
   scene:{subject:'a fintech dashboard',setting:'a plain soft gradient background',lighting:'studio three-point lighting',style:'isometric low poly',palette:'pastel candy colours',mood:'playful',lens:'tilt-shift miniature effect',audio:'mechanical hum'},
   ar:'16:9',
   shots:[
     {name:'The problem',  action:'paper invoices pile up and topple over',            move:'static lock-off', duration:'8 seconds'},
     {name:'The turn',     action:'the pile dissolves into a clean grid of cards',     move:'crane down', duration:'8 seconds'},
     {name:'Feature one',  action:'a card flips to show a live balance',               move:'slow dolly in', duration:'10 seconds'},
     {name:'Feature two',  action:'two accounts connect with an animated line',        move:'lateral tracking shot', duration:'10 seconds'},
     {name:'Payoff',       action:'the whole dashboard assembles in one motion',       move:'180 degree orbit', duration:'12 seconds'},
     {name:'Call to action',action:'the logo and a single line of copy settle in',     move:'static lock-off', duration:'6 seconds'}
   ]}
];

export const MODELS: Record<View, { k: string; l: string }[]> = {
  image: [{k:'mj',l:'Midjourney'},{k:'sd',l:'Stable Diffusion'},{k:'nat',l:'Natural'},{k:'json',l:'JSON'}],
  video: [{k:'sora',l:'Sora / Veo'},{k:'runway',l:'Runway'},{k:'nat',l:'Natural'},{k:'json',l:'JSON'}],
  shots: [{k:'sora',l:'Sora / Veo'},{k:'runway',l:'Runway'},{k:'board',l:'Storyboard'},{k:'json',l:'JSON'}]
};

/* ------------------------------------------------------------------ helpers */
export const clean = (s: unknown): string => String(s == null ? '' : s).trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const bits = (a: unknown[]) => a.map(clean).filter(Boolean).join(', ');
/* One sentence from optional fragments — empty fragments drop out, and the
   sentence itself disappears if nothing survives. */
const sent = (a: (string | false | undefined)[]) => {
  const s = a.filter(Boolean).join('').trim();
  return s ? cap(s).replace(/\.?$/, '.') : '';
};
const para = (a: string[]) => a.filter(Boolean).join(' ');
/* "8 seconds" reads as an adjective in prose: "an 8-second shot". */
const durAdj = (s: unknown) => clean(s).replace(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s)\b/i, '$1-second');
/* a / an, including the numbers that sound like vowels. */
function art(s: unknown): string {
  const t = clean(s);
  if (!t) return 'a';
  const m = /^(\d+)/.exec(t);
  if (m) return (m[1][0] === '8' || m[1] === '11' || m[1] === '18') ? 'an' : 'a';
  return /^[aeiou]/i.test(t) ? 'an' : 'a';
}
export function seconds(s: unknown): number {
  const m = /(\d+(?:\.\d+)?)/.exec(clean(s));
  return m ? +m[1] : 0;
}
export const specFor = (v: View): FieldSpec[] =>
  v === 'image' ? IMAGE_SPEC : v === 'video' ? VIDEO_SPEC : SCENE_SPEC;
export const negTerms = (on: Record<string, boolean>): string[] =>
  NEG_GROUPS.filter(g => on[g.k]).flatMap(g => g.terms);

/* Shot rows set this so the sora renderer states the subject once as a label
   instead of gluing it onto the front of the action clause. */
interface ShotFields extends Fields { shotMode?: string }

/* ------------------------------------------------------------ image prompts */
export function mjPrompt(d: Fields, ar: string, neg: string[]): string {
  let s = bits([
    bits([d.subject, d.action]),
    d.setting && 'in ' + clean(d.setting),
    d.lighting, d.lens, d.composition, d.style,
    d.palette && clean(d.palette) + ' palette',
    d.mood && clean(d.mood) + ' mood',
    d.detail,
  ]);
  if (!s) return '';
  s += ' --ar ' + ar;
  if (/photo|film|35mm|editorial|realistic/i.test(clean(d.style))) s += ' --style raw';
  s += ' --stylize 250';
  if (neg.length) s += ' --no ' + neg.join(', ');
  return s;
}

export function sdPrompt(d: Fields): string {
  return bits([
    d.subject && '(' + clean(d.subject) + ':1.3)',
    d.action,
    d.setting && 'in ' + clean(d.setting),
    d.lighting, d.lens, d.composition,
    d.style && '(' + clean(d.style) + ':1.2)',
    d.palette, d.mood, d.detail,
    'best quality', 'highly detailed',
  ]);
}

export function natImage(d: Fields, ar: string): string {
  return para([
    sent([d.style ? 'a ' + clean(d.style) + ' image of ' : 'an image of ',
      clean(d.subject) || 'the subject',
      d.action ? ', ' + clean(d.action) : '',
      d.setting ? ', in ' + clean(d.setting) : '']),
    sent([d.lighting && 'the scene is lit by ' + clean(d.lighting)]),
    sent([d.lens && 'shot on ' + clean(d.lens)]),
    sent([d.composition && 'the composition is ' + clean(d.composition)]),
    sent([d.palette && 'the palette is ' + clean(d.palette)]),
    sent([d.mood && 'the mood is ' + clean(d.mood)]),
    sent([d.detail]),
    sent(['aspect ratio ' + ar]),
  ]);
}

/* ------------------------------------------------------------ video prompts */
export function soraPrompt(d: ShotFields, ar: string): string {
  const opener = d.shotMode
    ? para([sent([d.subject && 'subject: ' + clean(d.subject)]),
      sent([clean(d.action), d.setting ? ', in ' + clean(d.setting) : ''])])
    : sent([clean(d.subject) || 'the subject',
      d.action ? ' ' + clean(d.action) : '',
      d.setting ? ', in ' + clean(d.setting) : '']);
  return para([
    opener,
    sent([d.start && 'the shot opens on ' + clean(d.start)]),
    sent([d.motion && 'subject motion: ' + clean(d.motion)]),
    sent([d.end && 'it ends on ' + clean(d.end)]),
    sent([d.move && 'camera: ' + clean(d.move)]),
    sent([d.lens && 'shot on ' + clean(d.lens)]),
    sent([d.lighting && 'lit by ' + clean(d.lighting)]),
    (d.style || d.palette) ? sent(['look: ' + bits([d.style, d.palette])]) : '',
    sent([d.mood && 'mood: ' + clean(d.mood)]),
    (d.duration || d.pacing) ? sent([bits([d.duration, d.pacing])]) : '',
    sent([d.audio && 'audio: ' + clean(d.audio)]),
    sent(['aspect ratio ' + ar]),
  ]);
}

export function runwayPrompt(d: Fields, ar: string): string {
  return ([
    ['Subject', d.subject], ['Action', d.action], ['Setting', d.setting],
    ['Camera', d.move], ['Subject motion', d.motion],
    ['First frame', d.start], ['Last frame', d.end],
    ['Lighting', d.lighting], ['Lens', d.lens],
    ['Style', d.style], ['Palette', d.palette], ['Mood', d.mood],
    ['Audio', d.audio], ['Duration', d.duration], ['Aspect ratio', ar],
  ] as [string, string | undefined][])
    .filter(r => clean(r[1]))
    .map(r => r[0] + ': ' + clean(r[1]))
    .join('\n');
}

export function natVideo(d: Fields, ar: string): string {
  return para([
    sent([d.duration ? art(d.duration) + ' ' + durAdj(d.duration) + ' shot' : 'a shot',
      d.pacing ? ', ' + clean(d.pacing) : '',
      ', of ' + (clean(d.subject) || 'the subject'),
      d.action ? ' ' + clean(d.action) : '',
      d.setting ? ', in ' + clean(d.setting) : '']),
    sent([d.move && 'the camera holds a ' + clean(d.move)]),
    d.start && d.end
      ? sent(['it opens on ' + clean(d.start) + ', and ends on ' + clean(d.end)])
      : sent([d.start ? 'it opens on ' + clean(d.start) : d.end ? 'it ends on ' + clean(d.end) : '']),
    sent([d.motion && 'throughout, the subject ' + clean(d.motion)]),
    sent([d.lighting && 'the scene is lit by ' + clean(d.lighting),
      d.lens ? ' and shot on ' + clean(d.lens) : '']),
    sent([d.style && 'the look is ' + clean(d.style),
      d.palette ? (d.style ? ' with a ' : 'the palette is ') + clean(d.palette) + (d.style ? ' palette' : '') : '']),
    sent([d.mood && 'the mood is ' + clean(d.mood),
      d.audio ? ', over ' + clean(d.audio) : '']),
    sent(['aspect ratio ' + ar]),
  ]);
}

/* -------------------------------------------------------------- shot lists */
export const shotFields = (scene: Fields, sh: Shot): ShotFields =>
  ({ ...scene, action: sh.action, move: sh.move, duration: sh.duration, shotMode: '1' });

export const runtimeSeconds = (shots: Shot[]): number =>
  shots.reduce((n, sh) => n + seconds(sh.duration), 0);

export function shotListPrompt(kind: string, scene: Fields, shots: Shot[], ar: string): string {
  const live = shots.filter(sh => clean(sh.action) || clean(sh.name));
  if (!live.length) return '';
  return live.map((sh, i) => {
    const head = (i + 1) + '. ' + (clean(sh.name) || 'Shot ' + (i + 1)) +
      (clean(sh.duration) ? '  ·  ' + clean(sh.duration) : '');
    if (kind === 'board') return head + '\n   ' + bits([sh.move, sh.action]);
    if (kind === 'runway') {
      return head + '\n' + runwayPrompt(shotFields(scene, sh), ar).split('\n').map(l => '   ' + l).join('\n');
    }
    return head + '\n   ' + soraPrompt(shotFields(scene, sh), ar);
  }).join('\n\n');
}

/* --------------------------------------------------------------- assembling */
function stripEmpty(o: Fields): Fields {
  const out: Fields = {};
  Object.keys(o).forEach(k => { if (k !== 'shotMode' && clean(o[k])) out[k] = clean(o[k]); });
  return out;
}

export interface Built { text: string; neg: string }

export interface BuildInput {
  view: View;
  model: string;
  ar: string;
  fields: Fields;      // image/video fields, or the scene defaults in shots view
  shots: Shot[];
  neg: string[];
}

/* `neg` on the result is only ever set where the target takes a separate
   negative field. Midjourney folds it into --no instead. */
export function build(i: BuildInput): Built {
  const { fields: d, ar, neg } = i;
  if (i.view === 'image') {
    if (i.model === 'mj') return { text: mjPrompt(d, ar, neg), neg: '' };
    if (i.model === 'sd') return { text: sdPrompt(d), neg: neg.join(', ') };
    if (i.model === 'nat') return { text: natImage(d, ar), neg: neg.join(', ') };
    return { text: JSON.stringify({ type: 'image', ...stripEmpty(d), aspect_ratio: ar, negative: neg }, null, 2), neg: '' };
  }
  if (i.view === 'video') {
    if (i.model === 'sora') return { text: soraPrompt(d, ar), neg: neg.join(', ') };
    if (i.model === 'runway') return { text: runwayPrompt(d, ar), neg: neg.join(', ') };
    if (i.model === 'nat') return { text: natVideo(d, ar), neg: neg.join(', ') };
    return { text: JSON.stringify({ type: 'video', ...stripEmpty(d), aspect_ratio: ar, negative: neg }, null, 2), neg: '' };
  }
  if (i.model === 'json') {
    const doc = {
      type: 'shot_list',
      scene: stripEmpty(d),
      aspect_ratio: ar,
      runtime_seconds: runtimeSeconds(i.shots),
      negative: neg,
      shots: i.shots.map((sh, n) => ({ index: n + 1, name: clean(sh.name), ...stripEmpty({ action: sh.action, move: sh.move, duration: sh.duration }) })),
    };
    return { text: JSON.stringify(doc, null, 2), neg: '' };
  }
  return { text: shotListPrompt(i.model, d, i.shots, ar), neg: neg.join(', ') };
}

/* The prompt a generation model should receive: the shot-list views render a
   numbered sequence for a human, so generation uses the plain single-shot
   prose for whichever shot is selected instead. */
export function generationPrompt(i: BuildInput, shotIndex: number): string {
  if (i.view === 'image') return natImage(i.fields, i.ar) || mjPrompt(i.fields, i.ar, []);
  if (i.view === 'video') return soraPrompt(i.fields, i.ar);
  const sh = i.shots[shotIndex];
  return sh ? soraPrompt(shotFields(i.fields, sh), i.ar) : '';
}
