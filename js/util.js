// Small shared helpers: escaping, TODO placeholders, motion preference.

let hideTodos = false;
export const setHideTodos = (v) => { hideTodos = !!v; };

export const TODO_RE = /\[TODO[^\]]*\]/;
export const isTodo = (s) => typeof s === 'string' && TODO_RE.test(s);

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Escape text and wrap any [TODO: …] in a visible marker.
// With meta.hideTodos on, TODO fragments are dropped instead.
export function t(s = '') {
  // *text* in content.json renders as italics (book titles etc.).
  const html = esc(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return hideTodos
    ? html.replace(/\s*\[TODO[^\]]*\]\s*/g, ' ').trim()
    : html.replace(/\[TODO[^\]]*\]/g, (m) => `<mark class="todo">${m}</mark>`);
}

// True when an item should be skipped entirely in hideTodos mode.
export const skip = (s) => hideTodos && isTodo(s);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Render a link; TODO or empty hrefs become a marked placeholder (or nothing).
export function link({ label, href }, cls = '') {
  if (!href || isTodo(href) || isTodo(label)) {
    return hideTodos ? '' : `<span class="${cls} todo-link">${esc(label)} ${t('[TODO: link]')}</span>`;
  }
  const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${cls}" href="${esc(href)}"${ext}>${t(label)}</a>`;
}

// Scroll to an element and land on it even if lazy demos change the page height
// mid-scroll: once the smooth scroll ends, snap to the element's final position.
export function goTo(el) {
  if (!el) return;
  const smooth = !reducedMotion();
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  if (smooth) addEventListener('scrollend', () => el.scrollIntoView({ behavior: 'instant' }), { once: true });
  // Move focus for keyboard and screen-reader users, as a normal fragment link would.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
