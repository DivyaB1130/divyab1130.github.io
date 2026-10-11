// Reaction network hero.
// Domains are reactants on the outside; projects are products bonded to the
// domains they draw on. Layout comes from a small seeded force simulation run
// once, then nodes drift gently around their resting points (paused when
// off-screen, when the tab is hidden, or under prefers-reduced-motion).

import { esc, t, skip, reducedMotion } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 1000, H = 640;
const DOMAIN_POS = { chem: [140, 130], bio: [140, 510], eng: [860, 130], comm: [860, 510] };

// Deterministic PRNG so the layout is identical on every load.
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

function layout(domains, projects) {
  const rand = rng(7);
  const nodes = projects.map((p) => {
    const ds = p.domains.map((d) => DOMAIN_POS[d]);
    const cx = ds.reduce((s, d) => s + d[0], 0) / ds.length;
    const cy = ds.reduce((s, d) => s + d[1], 0) / ds.length;
    // Single-domain products start pulled toward the centre so they don't sit on the domain.
    const pull = ds.length === 1 ? 0.45 : 0.1;
    return { p, x: cx + (500 - cx) * pull + (rand() - 0.5) * 80, y: cy + (320 - cy) * pull + (rand() - 0.5) * 80, vx: 0, vy: 0 };
  });
  const fixed = domains.map((d) => ({ x: DOMAIN_POS[d.id][0], y: DOMAIN_POS[d.id][1] }));

  for (let step = 0; step < 500; step++) {
    for (const n of nodes) {
      let fx = 0, fy = 0;
      // Springs toward each bonded domain.
      for (const d of n.p.domains) {
        const [dx, dy] = [DOMAIN_POS[d][0] - n.x, DOMAIN_POS[d][1] - n.y];
        const dist = Math.hypot(dx, dy) || 1;
        const k = 0.012 * (dist - 230);
        fx += (dx / dist) * k; fy += (dy / dist) * k;
      }
      // Repulsion from every other node; horizontal distance is weighted to leave room for labels.
      for (const o of [...nodes, ...fixed]) {
        if (o === n) continue;
        const dx = (n.x - o.x) / 1.9, dy = n.y - o.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const f = 2600 / d2;
        const d = Math.sqrt(d2);
        fx += (dx / d) * f; fy += (dy / d) * f;
      }
      n.vx = (n.vx + fx) * 0.82; n.vy = (n.vy + fy) * 0.82;
    }
    for (const n of nodes) {
      n.x = Math.max(120, Math.min(W - 200, n.x + n.vx));
      n.y = Math.max(70, Math.min(H - 60, n.y + n.vy));
    }
  }
  return nodes;
}

const hexPath = (r) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i + Math.PI / 6;
  return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
}).join('') + 'Z';

export function initNetwork(content, openProject) {
  const { domains, projects } = content;
  const svg = document.querySelector('.network__svg');
  const list = document.querySelector('.network__list');
  const label = (id) => domains.find((d) => d.id === id)?.label ?? id;
  const visible = projects.filter((p) => !skip(p.question)); // unfinished (TODO) projects drop out in hideTodos mode

  /* ---- mobile / accessible list fallback ---- */
  list.innerHTML = visible.map((p, i) => `
    <li><button type="button" data-open="${p.id}">
      <span class="network__no mono">${String(i + 1).padStart(2, '0')}</span>
      <span class="network__title">${t(p.title)}</span>
      <span class="network__bonds mono">${p.domains.map((d) => `<span class="bond-tag" style="--c:var(--c-${d})">${esc(label(d))}</span>`).join('')}</span>
    </button></li>`).join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]'); if (b) openProject(b.dataset.open, b);
  });

  /* ---- SVG network ---- */
  const nodes = layout(domains, visible);
  const bonds = [];
  const gBonds = document.createElementNS(NS, 'g');
  gBonds.setAttribute('class', 'bonds');
  gBonds.setAttribute('aria-hidden', 'true');
  svg.append(gBonds);

  // Domain (reactant) nodes.
  const dNodes = domains.map((d) => {
    const [x, y] = DOMAIN_POS[d.id];
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node node--domain');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-pressed', 'false');
    g.setAttribute('aria-label', `${d.label}: highlight the projects that draw on it`);
    g.dataset.domain = d.id;
    g.style.setProperty('--c', `var(--c-${d.id})`);
    const below = y > H / 2;
    g.innerHTML = `
      <circle r="50" class="node__ring"/>
      <circle r="40" class="node__core"/>
      <text class="node__symbol" text-anchor="middle" dy="0.35em">${esc(d.symbol)}</text>
      <text class="node__label" text-anchor="middle" y="${below ? 80 : -66}">${esc(d.label)}</text>`;
    svg.append(g);
    return { d, g, x, y, phase: d.ph };
  });

  // Product (project) nodes.
  const pNodes = nodes.map((n, i) => {
    const p = n.p;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node node--product');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${p.title}. ${p.kicker}. Draws on ${p.domains.map(label).join(', ')}. Open notebook entry.`);
    g.dataset.id = p.id;
    g.style.setProperty('--c', `var(--c-${p.domains[0]})`);
    const left = n.x > W * 0.62;
    g.innerHTML = `
      <path d="${hexPath(24)}" class="node__hex"/>
      <text class="node__num" text-anchor="middle" dy="0.35em">${String(i + 1).padStart(2, '0')}</text>
      <text class="node__title" x="${left ? -36 : 36}" text-anchor="${left ? 'end' : 'start'}" dy="0.35em">${esc(p.short || p.title)}</text>`;
    svg.append(g);
    for (const d of p.domains) {
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('class', 'bond');
      line.style.setProperty('--c', `var(--c-${d})`);
      line.dataset.domain = d; line.dataset.id = p.id;
      gBonds.append(line);
      bonds.push({ line, d, p: p.id });
    }
    return { p, g, x: n.x, y: n.y, phase: i * 1.7 };
  });

  /* ---- highlighting ---- */
  let pinned = null;
  const highlight = ({ id = null, domain = null } = {}) => {
    const on = id || domain;
    svg.classList.toggle('is-focused', !!on);
    const proj = id && visible.find((p) => p.id === id);
    pNodes.forEach((n) => n.g.classList.toggle('is-lit', !!on && (n.p.id === id || (domain && n.p.domains.includes(domain)))));
    dNodes.forEach((n) => n.g.classList.toggle('is-lit', !!on && (n.d.id === domain || (proj && proj.domains.includes(n.d.id)))));
    bonds.forEach((b) => b.line.classList.toggle('is-lit', !!on && (b.p === id || b.d === domain)));
  };
  const reset = () => highlight(pinned ? { domain: pinned } : {});

  pNodes.forEach(({ p, g }) => {
    g.addEventListener('pointerenter', () => highlight({ id: p.id }));
    g.addEventListener('focus', () => highlight({ id: p.id }));
    g.addEventListener('pointerleave', reset);
    g.addEventListener('blur', reset);
    g.addEventListener('click', () => openProject(p.id, g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(p.id, g); } });
  });
  dNodes.forEach(({ d, g }) => {
    const toggle = () => {
      pinned = pinned === d.id ? null : d.id;
      dNodes.forEach((n) => n.g.setAttribute('aria-pressed', String(n.d.id === pinned)));
      reset();
    };
    g.addEventListener('pointerenter', () => highlight({ domain: d.id }));
    g.addEventListener('focus', () => highlight({ domain: d.id }));
    g.addEventListener('pointerleave', reset);
    g.addEventListener('blur', reset);
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  });

  /* ---- drift ("molecules in solution") ---- */
  const pos = new Map();
  const draw = (time) => {
    const s = time / 1000;
    const amp = reducedMotion() ? 0 : 1;
    for (const n of [...dNodes, ...pNodes]) {
      const a = n.d ? 3 : 7;
      const x = n.x + amp * a * Math.sin(s * 0.45 + n.phase);
      const y = n.y + amp * a * Math.cos(s * 0.37 + n.phase * 1.3);
      n.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      pos.set(n.d ? 'd:' + n.d.id : n.p.id, [x, y]);
    }
    for (const b of bonds) {
      const [x1, y1] = pos.get('d:' + b.d); const [x2, y2] = pos.get(b.p);
      b.line.setAttribute('x1', x1.toFixed(1)); b.line.setAttribute('y1', y1.toFixed(1));
      b.line.setAttribute('x2', x2.toFixed(1)); b.line.setAttribute('y2', y2.toFixed(1));
    }
  };
  draw(0);

  let raf = 0, inView = true;
  const loop = (time) => { draw(time); raf = requestAnimationFrame(loop); };
  const sync = () => {
    cancelAnimationFrame(raf);
    if (inView && !document.hidden && !reducedMotion()) raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(svg);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { draw(0); sync(); });
}
