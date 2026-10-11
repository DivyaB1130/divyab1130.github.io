// pH colour engine.
// Maps scroll position → pH → universal-indicator colour, then derives every
// page colour from it. Text/graphic colours are pushed toward the ink colour
// until they meet WCAG AA against the current background, so contrast holds
// at every point of the gradient by construction.

// Universal indicator reference colours, pH 0–14.
const INDICATOR = [
  '#D7191C', '#E52421', '#EE3B23', '#F26724', '#F7941D', '#F8C611', '#D8DC2A',
  '#4DB74A', '#22B46B', '#0AA9A6', '#3D8CCB', '#3853A4', '#5A51A2', '#63459D', '#462C83',
].map(hexToRgb);

const LIGHT = { paper: hexToRgb('#FAF7F0'), ink: hexToRgb('#17150F'), tint: 0.15 };
const DARK = { paper: hexToRgb('#111014'), ink: hexToRgb('#F3EFE7'), tint: 0.17 };

// Fixed pH positions for domain and element-group colours.
const DOMAIN_PH = { chem: 1, bio: 5.5, eng: 9.5, comm: 12.6 };
const GROUP_PH = { program: 3, publication: 10, recognition: 13 };

/* ---------- colour math ---------- */
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

function lum(c) {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
// Move fg toward `toward` until it reaches `ratio` against every background.
function ensure(fg, bgs, ratio, toward) {
  let c = fg;
  for (let k = 0; k <= 1.0001; k += 0.04) {
    c = mix(fg, toward, k);
    if (bgs.every((b) => contrast(c, b) >= ratio)) return c;
  }
  return toward;
}

export function indicator(ph) {
  const p = Math.max(0, Math.min(14, ph));
  const i = Math.min(13, Math.floor(p));
  return mix(INDICATOR[i], INDICATOR[i + 1], p - i);
}
export const indicatorHex = (ph) => toHex(indicator(ph));

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

// Full palette for a pH value (exported so the contrast test can sample it).
export function palette(ph, dark) {
  const m = dark ? DARK : LIGHT;
  const ind = indicator(ph);
  const bg = mix(m.paper, ind, m.tint);
  const surface = dark ? mix(bg, [0, 0, 0], 0.35) : mix(bg, [255, 255, 255], 0.6);
  const bgs = [bg, surface];
  const vars = {
    '--bg': bg,
    '--surface': surface,
    '--ink': m.ink,
    '--muted': ensure(mix(m.ink, bg, 0.35), bgs, 4.6, m.ink),
    '--accent': ensure(ind, bgs, 4.6, m.ink),          // text-safe accent
    '--accent-graphic': ensure(ind, bgs, 3.1, m.ink),  // non-text (borders, marks)
    '--accent-fill': mix(bg, ind, dark ? 0.28 : 0.32), // decorative fill only
    '--line': mix(bg, m.ink, 0.16),
  };
  for (const [k, v] of Object.entries(DOMAIN_PH)) vars[`--c-${k}`] = ensure(indicator(v), bgs, 4.6, m.ink);
  for (const [k, v] of Object.entries(GROUP_PH)) vars[`--g-${k}`] = ensure(indicator(v), bgs, 4.6, m.ink);
  return { ind, vars };
}

/* ---------- scroll → pH ---------- */
let sections = [];
// At the very bottom the last (short) section can't reach the reading line, so treat it as current.
const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
let lastPh = -1;
let readout, marker, root;

function measure() {
  sections = [...document.querySelectorAll('[data-ph]')].map((el) => ({
    el, ph: parseFloat(el.dataset.ph), top: el.getBoundingClientRect().top + scrollY,
  }));
}

function currentPh() {
  const y = scrollY + innerHeight * 0.2;
  if (!sections.length) return 1;
  if (y <= sections[0].top) return sections[0].ph;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    if (y < b.top) return a.ph + (b.ph - a.ph) * ((y - a.top) / (b.top - a.top));
  }
  return sections[sections.length - 1].ph;
}

// Inverse of currentPh(): the scroll position at which the page reads `ph`.
function scrollYForPh(ph) {
  const first = sections[0], last = sections[sections.length - 1];
  const p = Math.max(first.ph, Math.min(last.ph, ph));
  let y = last.top;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    if (p <= b.ph) { y = a.top + ((p - a.ph) / (b.ph - a.ph)) * (b.top - a.top); break; }
  }
  return Math.max(0, y - innerHeight * 0.2);
}

export function apply(force = false) {
  const ph = currentPh();
  if (!force && Math.abs(ph - lastPh) < 0.02) return;
  lastPh = ph;
  const { ind, vars } = palette(ph, isDark());
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, toHex(v));
  root.style.setProperty('--indicator', toHex(ind));
  root.style.setProperty('--ph', ph.toFixed(2));
  root.style.setProperty('--pos-x', (ph / 14).toFixed(4)); // mobile progress bar
  if (readout) readout.textContent = ph.toFixed(1);
  if (marker) marker.style.setProperty('--pos', (ph / 14).toFixed(4));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', toHex(vars['--bg']));
  // Highlight the gauge stop for the section in view.
  let active = sections[0];
  for (const s of sections) if (scrollY + innerHeight * 0.2 >= s.top) active = s;
  if (atBottom()) active = sections[sections.length - 1];
  document.querySelectorAll('.gauge__stops a, .topnav a').forEach((a) =>
    a.toggleAttribute('aria-current', a.hash === '#' + active?.el.id));
  if (marker) {
    marker.setAttribute('aria-valuenow', ph.toFixed(1));
    marker.setAttribute('aria-valuetext', `pH ${ph.toFixed(1)}, ${active?.el.dataset.label ?? ''}`);
  }
}

/* ---------- gauge as a scrollbar: drag, click, keyboard ---------- */
function initGaugeControl() {
  const gauge = document.querySelector('.gauge');
  if (!gauge || !marker) return;
  const phAt = (clientY) => {
    const r = gauge.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientY - r.top) / r.height)) * 14;
  };
  const go = (ph, smooth) => scrollTo({ top: scrollYForPh(ph), behavior: smooth ? 'smooth' : 'instant' });

  let dragging = false;
  gauge.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a')) return; // section labels keep normal link behaviour
    e.preventDefault();
    dragging = true;
    gauge.classList.add('is-dragging');
    gauge.setPointerCapture(e.pointerId);
    // Grabbing the marker drags from where it is; clicking the track glides there.
    if (!e.target.closest('.gauge__marker')) go(phAt(e.clientY), true);
    marker.focus({ preventScroll: true });
  });
  gauge.addEventListener('pointermove', (e) => { if (dragging) go(phAt(e.clientY), false); });
  const end = () => { dragging = false; gauge.classList.remove('is-dragging'); };
  gauge.addEventListener('pointerup', end);
  gauge.addEventListener('pointercancel', end);

  // Keyboard: arrows / Page keys step between sections, Home/End jump to the ends.
  marker.addEventListener('keydown', (e) => {
    const ids = sections.filter((s) => s.el.id);
    const y = scrollY + innerHeight * 0.2;
    let i = atBottom() ? ids.length - 1 : ids.findIndex((s, k) => y < (ids[k + 1]?.top ?? Infinity));
    const step = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 }[e.key];
    if (step) i = Math.max(0, Math.min(ids.length - 1, i + step));
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = ids.length - 1;
    else return;
    e.preventDefault();
    const el = ids[i].el, smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    if (smooth) addEventListener('scrollend', () => el.scrollIntoView({ behavior: 'instant' }), { once: true });
  });
}

export function initPh() {
  root = document.documentElement;
  readout = document.querySelector('[data-ph-readout]');
  marker = document.querySelector('.gauge__marker');

  // The gauge track is the full indicator scale.
  const stops = INDICATOR.map((c, i) => `${toHex(c)} ${(i / 14) * 100}%`).join(',');
  document.querySelector('.gauge__track')?.style.setProperty('--scale', `linear-gradient(to bottom, ${stops})`);

  measure();
  // Section stops in the gauge, positioned at each section's pH.
  const list = document.querySelector('.gauge__stops');
  if (list) {
    list.innerHTML = sections.filter((s) => s.el.id).map((s) =>
      `<li style="--pos:${(s.ph / 14).toFixed(4)}"><a href="#${s.el.id}"><span class="gauge__ph">${s.ph.toFixed(0)}</span><span class="gauge__name">${s.el.dataset.label}</span></a></li>`).join('');
  }

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { apply(); ticking = false; });
  }, { passive: true });
  const remeasure = () => { measure(); apply(true); };
  addEventListener('resize', remeasure);
  new ResizeObserver(remeasure).observe(document.body);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(true));
  initGaugeControl();
  apply(true);
}
