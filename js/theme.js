// Theme switching: Bench (light) ⇄ Night lab (dark).
// Both the header toggle and the hero's burette stopcock call flip(). Where the
// View Transitions API exists, the new theme spreads as a circle from the
// control that was pressed; otherwise (or with reduced motion) it swaps instantly.

import { isDark, apply } from './ph.js';
import { reducedMotion } from './util.js';

function set(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  sync();
  apply(true);
}

function sync() {
  const dark = isDark();
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(dark));
    // Stopcock's accessible name starts with its visible text ("Bench" / "Night lab").
    const label = dark ? 'Switch to light theme (bench)' : 'Switch to dark theme (night lab)';
    b.setAttribute('aria-label', b.matches('.stopcock__btn') ? `${dark ? 'Night lab' : 'Bench'}: ${label.toLowerCase()}` : label);
  });
  document.querySelectorAll('[data-theme-label]').forEach((l) => { l.textContent = dark ? 'Light mode' : 'Dark mode'; });
  document.querySelectorAll('[data-stopcock-state]').forEach((s) => { s.textContent = dark ? 'Night lab' : 'Bench'; });
}

export function flip(from) {
  const next = !isDark();
  if (!document.startViewTransition || reducedMotion()) return set(next);

  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : 0;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const vt = document.startViewTransition(() => set(next));
  vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.6,.05,.3,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

export function initTheme() {
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => flip(b)));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
  sync();
}
