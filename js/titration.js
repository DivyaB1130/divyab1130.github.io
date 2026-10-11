// Titration toy (lazy-loaded): 25 mL of 0.010 M HCl titrated with 0.010 M NaOH.
// The beaker takes the real universal-indicator colour for its pH, and the
// curve is drawn as you go. pH comes from the charge balance, so it is exact
// near the equivalence point too.

import { indicatorHex } from './ph.js';

const CA = 0.010, VA = 25, CB = 0.010, KW = 1e-14, MAX = 50;

function pH(vb) {
  const v = VA + vb;
  const d = (CA * VA - CB * vb) / v;                   // [H+] − [OH−]
  const h = (d + Math.sqrt(d * d + 4 * KW)) / 2;
  return -Math.log10(h);
}

// Plot geometry (SVG units).
const PX = 44, PY = 12, PW = 300, PH = 170;
const sx = (v) => PX + (v / MAX) * PW;
const sy = (p) => PY + PH - (p / 14) * PH;

export default function init(el) {
  el.querySelector('.curio__note')?.remove();
  el.insertAdjacentHTML('beforeend', `
    <p class="demo__hint">25 mL of dilute hydrochloric acid with a few drops of universal indicator. Add sodium hydroxide and watch the colour climb the scale.</p>
    <div class="titration">
      <svg viewBox="0 0 120 170" aria-hidden="true">
        <defs><clipPath id="beaker-clip"><path d="M18 20 V150 a10 10 0 0 0 10 10 H92 a10 10 0 0 0 10 -10 V20Z"/></clipPath></defs>
        <rect class="beaker__liquid" data-liquid x="0" width="120" y="100" height="70" clip-path="url(#beaker-clip)"/>
        <path class="beaker__glass" d="M10 16 H18 V150 a10 10 0 0 0 10 10 H92 a10 10 0 0 0 10 -10 V16 H110"/>
        <path d="M102 60h-8M102 90h-8M102 120h-8" stroke="var(--ink)" stroke-width="1.5"/>
      </svg>
      <svg viewBox="0 0 360 210" role="img" aria-label="Titration curve: pH against millilitres of base added">
        ${[0, 7, 14].map((p) => `<line class="plot__grid" x1="${PX}" x2="${PX + PW}" y1="${sy(p)}" y2="${sy(p)}"/><text class="plot__label" x="${PX - 8}" y="${sy(p) + 4}" text-anchor="end">${p}</text>`).join('')}
        ${[0, 25, 50].map((v) => `<text class="plot__label" x="${sx(v)}" y="${PY + PH + 18}" text-anchor="middle">${v} mL</text>`).join('')}
        <line class="plot__axis" x1="${PX}" x2="${PX}" y1="${PY}" y2="${PY + PH}"/>
        <line class="plot__axis" x1="${PX}" x2="${PX + PW}" y1="${PY + PH}" y2="${PY + PH}"/>
        <text class="plot__label" x="${sx(25) + 6}" y="${sy(7) - 8}">equivalence</text>
        <path class="plot__curve" data-curve/>
        <circle class="plot__dot" r="6" data-dot/>
      </svg>
    </div>
    <label for="titr-vol">NaOH added: <output id="titr-out">0.0</output> mL · pH <output id="titr-ph">2.00</output></label>
    <input id="titr-vol" type="range" min="0" max="${MAX}" step="0.5" value="0">
    <div class="demo__actions">
      <button type="button" class="btn" data-drop>Add a drop</button>
      <button type="button" class="btn btn--ghost" data-reset>Reset</button>
    </div>
    <p class="demo__fine">Seawater doesn't jump like this. Bicarbonate buffers it, which is why ocean alkalinity enhancement shifts pH only gently, and why measuring the change is so hard.</p>`);

  const q = (s) => el.querySelector(s);
  const range = q('#titr-vol');
  let max = 0; // furthest point reached, so the curve keeps its history

  function render() {
    const v = +range.value;
    max = Math.max(max, v);
    const p = pH(v);
    q('#titr-out').textContent = v.toFixed(1);
    q('#titr-ph').textContent = p.toFixed(2);
    const color = indicatorHex(p);
    const liquid = q('[data-liquid]');
    const top = 150 - ((VA + v) / (VA + MAX)) * 120;
    liquid.setAttribute('y', top.toFixed(1));
    liquid.setAttribute('height', (170 - top).toFixed(1));
    liquid.setAttribute('fill', color);
    let d = '';
    for (let x = 0; x <= max + 1e-9; x += 0.25) d += `${d ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(pH(x)).toFixed(1)}`;
    q('[data-curve]').setAttribute('d', d);
    const dot = q('[data-dot]');
    dot.setAttribute('cx', sx(v)); dot.setAttribute('cy', sy(p)); dot.setAttribute('fill', color);
  }
  range.addEventListener('input', render);
  q('[data-drop]').addEventListener('click', () => { range.value = Math.min(MAX, +range.value + 0.5); render(); });
  q('[data-reset]').addEventListener('click', () => { range.value = 0; max = 0; render(); });
  render();
}
