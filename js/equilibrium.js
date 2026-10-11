// Interactive model for the OAE notebook entry (lazy-loaded).
// A simplified seawater carbonate system: add alkalinity at fixed dissolved
// inorganic carbon (DIC) and watch the pH rise and CO₂(aq) fall; then let the
// air "catch up": CO₂ dissolves until CO₂(aq) returns to its starting value,
// and the extra DIC is the carbon stored. Carbonate + water only; constants
// are approximate seawater values at 25 °C, S = 35.

import { indicatorHex } from './ph.js';
import { reducedMotion } from './util.js';

const K1 = 10 ** -5.86, K2 = 10 ** -8.92, KW = 10 ** -13.2;
const DIC0 = 2000e-6, PH0 = 8.1;

const alphas = (h) => { const d = h * h + K1 * h + K1 * K2; return [h * h / d, K1 * h / d, K1 * K2 / d]; };
const ta = (h, dic) => { const [, a1, a2] = alphas(h); return dic * (a1 + 2 * a2) + KW / h - h; };
function bisect(f, lo, hi) { // f increasing in x
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
const TA0 = ta(10 ** -PH0, DIC0);
const CO2_0 = DIC0 * alphas(10 ** -PH0)[0];

// State right after mixing (DIC unchanged).
function mixed(dTA) {
  const pH = bisect((p) => ta(10 ** -p, DIC0) - (TA0 + dTA), 4, 12);
  return { pH, dic: DIC0 };
}
// State after air–sea re-equilibration (CO₂(aq) back to baseline).
function equilibrated(dTA) {
  const pH = bisect((p) => { const h = 10 ** -p; return ta(h, CO2_0 / alphas(h)[0]) - (TA0 + dTA); }, 4, 12);
  return { pH, dic: CO2_0 / alphas(10 ** -pH)[0] };
}

const um = (x) => (x * 1e6).toFixed(0);

export default function init(el) {
  el.innerHTML = `
    <div class="demo__grid">
      <div>
        <h4 class="demo__title">Try the chemistry</h4>
        <p class="demo__hint">Add alkalinity to a kilogram of seawater, then let the atmosphere respond.</p>
        <label for="oae-ta">Alkalinity added: <output id="oae-ta-out">0</output> µmol/kg</label>
        <input id="oae-ta" type="range" min="0" max="400" step="10" value="0">
        <div class="readouts" aria-live="polite">
          <div class="readout"><b data-o="ph">8.10</b><span>pH</span></div>
          <div class="readout"><b data-o="co2">0</b><span>CO₂(aq) µmol/kg</span></div>
          <div class="readout"><b data-o="up">0</b><span>CO₂ taken from air µmol/kg</span></div>
        </div>
        <div class="species" aria-hidden="true">
          ${['CO₂ ×40', 'HCO₃⁻', 'CO₃²⁻'].map((n, i) => `<div class="species__row"><span>${n}</span><span class="species__bar"><i data-bar="${i}"></i></span><span data-val="${i}"></span></div>`).join('')}
        </div>
        <svg class="sea" viewBox="0 0 400 120" aria-hidden="true" style="width:100%;height:auto;display:block">
          <rect width="400" height="46" fill="var(--bg)"/>
          <text x="12" y="28" class="plot__label">atmosphere</text>
          <path d="M0 52 Q50 40 100 52 T200 52 T300 52 T400 52 V120 H0Z" data-sea fill="#0AB8B6" opacity=".55"/>
          <text x="12" y="108" class="plot__label">surface ocean</text>
          <g class="air-arrow" data-arrow opacity="0">
            <path d="M200 6 V62" stroke="var(--ink)" stroke-width="3" data-shaft/>
            <path d="M190 52 L200 66 L210 52" fill="none" stroke="var(--ink)" stroke-width="3"/>
            <text x="214" y="30" class="plot__label">CO₂</text>
          </g>
        </svg>
        <div class="demo__actions">
          <button type="button" class="btn" data-eq aria-pressed="false">Let the air catch up</button>
          <button type="button" class="btn btn--ghost" data-reset>Reset</button>
        </div>
        <p class="demo__fine" data-summary></p>
        <p class="demo__fine">Simplified model: carbonate system and water only, fixed temperature and salinity. Real seawater adds borate and other buffers, so it illustrates the synthesis but doesn't replace it.</p>
      </div>
      <figure style="margin:0">
        <svg class="molecule" viewBox="-100 -100 200 200" tabindex="0" role="img"
             aria-label="Carbonate ion, CO₃²⁻: one carbon bonded to three oxygens in a flat triangle. Drag, or use the arrow keys, to rotate."></svg>
        <figcaption class="molecule__caption mono">Carbonate ion, CO₃²⁻. Drag to rotate.</figcaption>
      </figure>
    </div>`;

  const q = (s) => el.querySelector(s);
  const slider = q('#oae-ta'), out = q('#oae-ta-out'), eqBtn = q('[data-eq]');
  let settled = false;

  function render() {
    const dTA = +slider.value * 1e-6;
    out.textContent = slider.value;
    const s = settled ? equilibrated(dTA) : mixed(dTA);
    const sp = alphas(10 ** -s.pH).map((a) => a * s.dic);
    const uptake = s.dic - DIC0;
    q('[data-o="ph"]').textContent = s.pH.toFixed(2);
    q('[data-o="co2"]').textContent = (sp[0] * 1e6).toFixed(1);
    q('[data-o="up"]').textContent = um(uptake);
    sp.forEach((v, i) => {
      q(`[data-bar="${i}"]`).style.width = `${Math.min(100, (v / 2600e-6) * 100 * (i === 0 ? 40 : 1))}%`;
      q(`[data-val="${i}"]`).textContent = i === 0 ? (v * 1e6).toFixed(1) : um(v);
    });
    q('[data-sea]').setAttribute('fill', indicatorHex(s.pH));
    const arrow = q('[data-arrow]');
    arrow.setAttribute('opacity', settled && uptake > 1e-6 ? '1' : (!settled && dTA > 0 ? '.35' : '0'));
    q('[data-shaft]').setAttribute('stroke-width', String(2 + Math.min(10, uptake * 1e6 / 30)));
    eqBtn.setAttribute('aria-pressed', String(settled));
    eqBtn.textContent = settled ? 'Show just after mixing' : 'Let the air catch up';
    q('[data-summary]').textContent = dTA === 0
      ? 'Move the slider to add alkalinity.'
      : settled
        ? `After re-equilibration the water holds ${um(uptake)} µmol/kg more carbon, about ${(uptake / dTA).toFixed(2)} mol of CO₂ per mol of alkalinity added, stored mostly as bicarbonate.`
        : `Just after mixing, pH rises and CO₂(aq) drops below what's in balance with the air, so the ocean is now undersaturated and ready to absorb CO₂.`;
  }
  slider.addEventListener('input', () => { settled = false; render(); });
  eqBtn.addEventListener('click', () => { settled = !settled; render(); });
  q('[data-reset]').addEventListener('click', () => { slider.value = 0; settled = false; render(); });
  render();

  initMolecule(q('.molecule'));
}

/* ---- rotatable carbonate ion (orthographic projection in SVG) ---- */
function initMolecule(svg) {
  const R = 62;
  const atoms = [{ el: 'C', p: [0, 0, 0], r: 22 }]
    .concat([0, 1, 2].map((i) => ({ el: 'O', p: [Math.cos(i * 2.094) * R, Math.sin(i * 2.094) * R, 0], r: 26 })));
  let yaw = 0.6, pitch = 0.9, drag = null, auto = !reducedMotion();

  const rot = ([x, y, z]) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  function draw() {
    const P = atoms.map((a) => ({ ...a, q: rot(a.p) }));
    const c = P[0].q;
    let html = '';
    for (const o of P.slice(1)) {
      // Delocalised bonds: one solid line plus a dashed partner (1⅓ bond order).
      const dx = o.q[0] - c[0], dy = o.q[1] - c[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len * 5, ny = dx / len * 5;
      html += `<line x1="${c[0]}" y1="${c[1]}" x2="${o.q[0]}" y2="${o.q[1]}" stroke="var(--ink)" stroke-width="3"/>`;
      html += `<line x1="${c[0] + nx}" y1="${c[1] + ny}" x2="${o.q[0] + nx}" y2="${o.q[1] + ny}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    }
    for (const a of P.sort((m, n) => m.q[2] - n.q[2])) {
      const s = 1 + a.q[2] / 400;
      const fill = a.el === 'O' ? 'var(--c-chem)' : 'var(--ink)';
      html += `<circle cx="${a.q[0]}" cy="${a.q[1]}" r="${a.r * s}" fill="${fill}" stroke="var(--surface)" stroke-width="2"/>`;
      html += `<text x="${a.q[0]}" y="${a.q[1]}" dy="0.35em" text-anchor="middle" fill="var(--surface)">${a.el}</text>`;
    }
    html += `<text x="78" y="-78" fill="var(--ink)" style="font:500 16px var(--mono)">2−</text>`;
    svg.innerHTML = html;
  }
  svg.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; auto = false; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    yaw += (e.clientX - drag[0]) * 0.01; pitch += (e.clientY - drag[1]) * 0.01;
    drag = [e.clientX, e.clientY]; draw();
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
    if (!k) return;
    e.preventDefault(); auto = false; yaw += k[0]; pitch += k[1]; draw();
  });
  // Slow idle spin until the reader takes over (only while visible).
  let raf = 0, visible = false;
  const spin = () => { if (auto && visible) { yaw += 0.006; draw(); raf = requestAnimationFrame(spin); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) spin(); }).observe(svg);
  draw();
}
