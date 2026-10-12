// Entry point: load content.json, render every section, then start the
// interactive pieces. Heavier demos are imported only when they scroll near.

import { setHideTodos, reducedMotion, goTo } from './util.js';
import { initPh, apply } from './ph.js';
import { initTheme } from './theme.js';
import { initNetwork } from './network.js';
import {
  renderPerson, renderNotebook, initDialog, renderArchive,
  renderElements, renderCuriosities, renderResume, renderContact,
} from './sections.js';

// Lazy modules, keyed by the data-lazy attribute in the markup.
const LAZY = {
  titration: () => import('./titration.js'),
  quiz: () => import('./quiz.js'),
  equilibrium: () => import('./equilibrium.js'),
};

async function main() {
  const content = await fetch('content.json').then((r) => r.json());
  setHideTodos(content.meta.hideTodos);

  renderPerson(content);
  const openProject = initDialog(content);
  renderNotebook(content);
  renderArchive(content);
  renderElements(content, openProject);
  renderCuriosities(content, openProject);
  renderResume(content);
  renderContact(content);

  initTheme();
  initPh();
  initNetwork(content, openProject);
  lazyLoad(content);
  revealOnScroll();
  // In-page links (top nav, gauge labels, cross-references) use goTo() so they
  // land correctly even while lazy demos are expanding the page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const target = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', a.hash);
    goTo(target);
  });
  initMenu();
  // Any [data-doc] button (notebook entries, achievement tiles) opens the reader.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-doc]'); if (!b) return;
    const doc = content.documents.find((d) => d.id === b.dataset.doc);
    if (doc) import('./reader.js').then((m) => m.openReader(doc, b));
  });
  document.documentElement.classList.add('is-ready');
  apply(true);
  // Deep links (e.g. #entry-oae from Divya's GitHub profile) point at entries that only
  // exist after rendering, so jump to them once the page is built.
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) {
    // Re-align while lazy demos and fonts settle above it; stop as soon as the reader scrolls.
    let userMoved = false;
    const stop = () => { userMoved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
    const snap = () => { if (!userMoved) target.scrollIntoView({ behavior: 'instant', block: 'start' }); };
    [0, 300, 900, 1800].forEach((ms) => setTimeout(snap, ms));
  }
}

// Mobile "Menu" button: toggles the section links; closes on choice, Escape or outside click.
function initMenu() {
  const btn = document.querySelector('.nav-toggle'), nav = document.getElementById('primary-nav');
  const set = (open) => { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Close' : 'Menu'; };
  btn.addEventListener('click', () => set(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.topbar')) set(false); });
}

// Import a demo module the first time its container comes within 400px of view.
function lazyLoad(content) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      LAZY[e.target.dataset.lazy]?.().then((m) => m.default(e.target, content))
        .catch((err) => { e.target.querySelector('.curio__note')?.replaceChildren('This demo could not load.'); console.error(err); });
    }
  }, { rootMargin: '400px 0px' });
  document.querySelectorAll('[data-lazy]').forEach((el) => io.observe(el));
}

// Gentle fade-up for entries as they arrive; skipped entirely for reduced motion.
function revealOnScroll() {
  const els = document.querySelectorAll('.reveal');
  if (reducedMotion() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

main().catch((err) => {
  console.error(err);
  document.querySelector('.hero__lede').textContent = 'Content failed to load. If you opened this file directly, serve the folder instead (see README).';
});
