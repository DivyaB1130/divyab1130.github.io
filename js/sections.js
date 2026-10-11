// Renderers for every content section. Each reads one slice of content.json
// and writes HTML into the matching container in index.html.

import { $, esc, t, skip, isTodo, link } from './util.js';

const pad = (i) => String(i + 1).padStart(2, '0');
const domainLabel = (content, id) => content.domains.find((d) => d.id === id)?.label ?? id;

/* ---------- Document cards (open the reader) ---------- */
export function docsHTML(content, ids = []) {
  const docs = ids.map((id) => content.documents?.find((d) => d.id === id)).filter(Boolean);
  if (!docs.length) return '';
  return `<div class="docs">${docs.map((d) => `
    <button type="button" class="doc" data-doc="${d.id}">
      <span class="doc__icon" aria-hidden="true"><span>${esc(d.kind.slice(0, 1))}</span></span>
      <span class="doc__text"><span class="doc__kind mono">${esc(d.kind)} · ${d.pages} pages</span>
        <span class="doc__title">${t(d.title)}</span></span>
      <span class="doc__cta mono">Read →</span>
    </button>`).join('')}</div>`;
}

/* ---------- Hero text ---------- */
export function renderPerson({ person }) {
  document.querySelectorAll('[data-person]').forEach((el) => { el.innerHTML = t(person[el.dataset.person] ?? ''); });
  // Headshot: blank circle until content.json → person.photo points at an image.
  const portrait = $('[data-portrait]');
  if (portrait && person.photo) {
    portrait.removeAttribute('aria-hidden');
    portrait.innerHTML = `<img src="${esc(person.photo)}" alt="${esc(person.photoAlt || person.name)}" width="88" height="88" decoding="async">`;
  }
}

/* ---------- Lab notebook entry (also used inside the dialog) ---------- */
export function entryHTML(content, p, i, { inDialog = false } = {}) {
  const field = (label, text, cls = '') => skip(text) ? '' :
    `<div class="entry__field ${cls}"><dt class="mono">${label}</dt><dd>${t(text)}</dd></div>`;
  const status = (p.status || []).map((s) =>
    `<li class="pill"><span>${esc(s.label)}</span> ${esc(s.state)}</li>`).join('');
  const links = (p.links || []).map((l) => link(l, 'entry__link')).join('');
  const titleId = inDialog ? 'dialog-title' : `entry-${p.id}-title`;
  return `
    <div class="entry__margin mono">
      <p class="entry__no">No. ${pad(i)}</p>
      ${skip(p.date) ? '' : `<p>${t(p.date)}</p>`}
      <p>${t(p.setting)}</p>
      ${skip(p.collaborators) ? '' : `<p>${t(p.collaborators)}</p>`}
      <ul class="entry__bonds" aria-label="Draws on">${p.domains.map((d) =>
        `<li class="bond-tag" style="--c:var(--c-${d})">${esc(domainLabel(content, d))}</li>`).join('')}</ul>
      ${status ? `<ul class="entry__status" aria-label="Status">${status}</ul>` : ''}
    </div>
    <div class="entry__body">
      <p class="entry__kicker mono">${t(p.kicker)}</p>
      <h3 id="${titleId}" class="entry__title">${t(p.title)}</h3>
      <dl class="entry__fields">
        ${field('Question', p.question)}
        ${field('Method', p.method)}
        ${field('Result', p.result)}
        ${field('Why it matters to people', p.impact, 'entry__field--impact')}
      </dl>
      ${links ? `<p class="entry__links">${links}</p>` : ''}
      ${docsHTML(content, p.documents)}
      ${p.demo && !inDialog ? `<div class="demo" data-lazy="${p.demo}"><p class="curio__note">Loading the interactive model…</p></div>` : ''}
      ${inDialog ? `<p class="entry__links"><a class="entry__link" href="#entry-${p.id}" data-close>Read it in the notebook ↓</a></p>` : ''}
    </div>`;
}

export function renderNotebook(content) {
  const wrap = $('.notebook__entries');
  wrap.innerHTML = content.projects.map((p, i) => skip(p.question) ? '' : `
    <article class="entry reveal" id="entry-${p.id}" aria-labelledby="entry-${p.id}-title">
      ${entryHTML(content, p, i)}
    </article>`).join('');
}

/* ---------- Project dialog (opened from network / questions) ---------- */
export function initDialog(content) {
  const dialog = $('.project-dialog');
  const inner = $('.project-dialog__inner', dialog);
  let opener = null;

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
    const a = e.target.closest('[data-close]');
    if (a) { dialog.close(); }
  });
  dialog.addEventListener('close', () => opener?.focus?.({ preventScroll: true }));

  return (id, from) => {
    const i = content.projects.findIndex((p) => p.id === id);
    if (i < 0) return;
    opener = from;
    inner.innerHTML = `<article class="entry entry--dialog">${entryHTML(content, content.projects[i], i, { inDialog: true })}</article>`;
    dialog.showModal();
  };
}

/* ---------- Archive: two-lane ledger ---------- */
export function renderArchive({ archive }) {
  $('[data-archive-intro]').innerHTML = t(archive.intro);
  for (const lane of ['history', 'community']) {
    $(`[data-archive="${lane}"]`).innerHTML = archive[lane].map((e) => skip(e.title) ? '' : `
      <li class="ledger__item reveal">
        <p class="ledger__year mono">${t(e.year)}</p>
        <div>
          <h4 class="ledger__title">${t(e.title)}</h4>
          <p class="ledger__text">${t(e.text)}</p>
        </div>
      </li>`).join('');
  }
}

/* ---------- Table of elements ---------- */
// Tiles open a detail panel with the story, impact, related projects and an
// image gallery (main image + thumbnails; the main image opens a lightbox).
export function renderElements({ elements, projects, documents }, openProject) {
  const grid = $('.elements__grid');
  const detail = $('.elements__detail');
  const items = elements.filter((e) => !skip(e.name));
  const sym = (e) => `${e.isotope ? `<sup class="mono">${esc(e.isotope)}</sup>` : ''}${esc(e.symbol)}`;
  grid.innerHTML = items.map((e, i) => `
    <div role="listitem">
      <button class="tile" type="button" aria-expanded="false" aria-controls="element-detail" data-i="${i}" style="--g:var(--g-${e.group})">
        <span class="tile__no mono">${i + 1}</span>
        <span class="tile__symbol">${sym(e)}</span>
        <span class="tile__name">${t(e.name)}</span>
        <span class="tile__year mono">${t(e.year)}</span>
        ${e.status ? `<span class="tile__status mono">${esc(e.status)}</span>` : ''}
        ${e.media?.length ? `<span class="tile__media mono" aria-label="${e.media.length} images">▣ ${e.media.length}</span>` : ''}
      </button>
    </div>`).join('');
  detail.id = 'element-detail';

  let current = 0;
  const gallery = (e) => !e.media?.length ? '' : `
    <figure class="ed__gallery">
      <button type="button" class="ed__main" data-zoom aria-label="View image full size">
        <img src="${esc(e.media[0].src)}" alt="${esc(e.media[0].alt)}" loading="lazy" decoding="async">
        <span class="ed__zoom mono" aria-hidden="true">⤢ Full size</span>
      </button>
      <figcaption class="ed__caption mono">${t(e.media[0].caption)}</figcaption>
      ${e.media.length > 1 ? `<div class="ed__thumbs" role="group" aria-label="Images">${e.media.map((m, k) => `
        <button type="button" class="ed__thumb" data-k="${k}" aria-pressed="${k === 0}" aria-label="Show image ${k + 1}: ${esc(m.caption)}">
          <img src="${esc(m.src)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}
    </figure>`;

  const show = (i, scroll = false) => {
    const e = items[i];
    current = i;
    grid.querySelectorAll('.tile').forEach((b) => b.setAttribute('aria-expanded', String(+b.dataset.i === i)));
    detail.style.setProperty('--g', `var(--g-${e.group})`);
    const related = (e.related || []).map((id) => projects.find((p) => p.id === id)).filter(Boolean);
    detail.innerHTML = `
      <header class="ed__head">
        <p class="elements__detail-symbol" aria-hidden="true">${sym(e)}</p>
        <div>
          <p class="mono elements__detail-meta">${esc(e.group)} · ${t(e.year)}${e.status ? ` · ${esc(e.status)}` : ''}</p>
          <h3>${t(e.name)}</h3>
          <p class="ed__lead">${t(e.detail)}</p>
        </div>
      </header>
      <div class="ed__body${e.media?.length ? '' : ' ed__body--text'}">
        <div class="ed__text">
          ${(e.details || []).map((d) => `<p>${t(d)}</p>`).join('')}
          ${e.impact ? `<div class="ed__impact"><p class="mono">Impact</p><p>${t(e.impact)}</p></div>` : ''}
          ${docsHTML({ documents }, e.documents)}
          ${related.length ? `<p class="ed__related"><span class="mono">Related project${related.length > 1 ? 's' : ''}:</span> ${related.map((p) =>
            `<button type="button" class="btn btn--ghost" data-open="${p.id}">${t(p.short || p.title)} →</button>`).join(' ')}</p>` : ''}
        </div>
        ${gallery(e)}
      </div>`;
    if (scroll && detail.getBoundingClientRect().top > innerHeight * 0.75) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setImage = (k) => {
    const m = items[current].media[k];
    const img = $('.ed__main img', detail);
    img.src = m.src; img.alt = m.alt;
    img.closest('[data-zoom]').dataset.k = k;
    $('.ed__caption', detail).innerHTML = t(m.caption);
    detail.querySelectorAll('.ed__thumb').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.k === k)));
  };

  grid.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tile'); if (b) show(+b.dataset.i, true);
  });
  detail.addEventListener('click', (ev) => {
    const th = ev.target.closest('.ed__thumb'); if (th) return setImage(+th.dataset.k);
    const z = ev.target.closest('[data-zoom]'); if (z) return openLightbox(items[current].media, +(z.dataset.k || 0), z);
    const o = ev.target.closest('[data-open]'); if (o) openProject(o.dataset.open, o);
  });
  show(0);
}

/* ---------- Lightbox for element images ---------- */
function openLightbox(media, k, opener) {
  const box = $('.lightbox');
  const img = $('img', box), cap = $('.lightbox__caption', box), count = $('.lightbox__count', box);
  const many = media.length > 1;
  box.querySelectorAll('[data-step]').forEach((b) => { b.hidden = !many; });
  const go = (n) => {
    k = (n + media.length) % media.length;
    img.src = media[k].src; img.alt = media[k].alt;
    cap.innerHTML = t(media[k].caption);
    count.textContent = many ? `${k + 1} / ${media.length}` : '';
  };
  box.onclick = (e) => {
    if (e.target === box) return box.close();
    const s = e.target.closest('[data-step]'); if (s) go(k + +s.dataset.step);
  };
  box.onkeydown = (e) => {
    if (!many) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(k + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(k - 1); }
  };
  box.onclose = () => opener?.focus({ preventScroll: true });
  go(k);
  box.showModal();
}

/* ---------- Curiosities: questions + personal ---------- */
export function renderCuriosities(content, openProject) {
  const { curiosities, projects } = content;
  const ol = $('.questions');
  ol.innerHTML = curiosities.questions.map((q) => {
    const p = projects.find((x) => x.id === q.from);
    return `<li><p>${t(q.q)}</p>${p ? `<button type="button" class="from mono" data-open="${p.id}">from: ${esc(p.short || p.title)}</button>` : ''}</li>`;
  }).join('');
  ol.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]'); if (b) openProject(b.dataset.open, b);
  });
  const personal = curiosities.personal.filter((s) => !skip(s));
  $('.personal').innerHTML = personal.map((s) => `<li>${t(s)}</li>`).join('');
  if (!personal.length) $('.curio--personal').remove();
}

/* ---------- Résumé data sheet ---------- */
export function renderResume({ person, resume, contact }) {
  const list = (items, fn) => items.map(fn).join('');
  $('.resume__sheet').innerHTML = `
    <div class="resume__print-head">
      <p class="resume__name">${esc(person.name)}</p>
      <p class="mono">${t(person.interests)}${isTodo(contact.email) ? '' : ` · ${esc(contact.email)}`}</p>
    </div>
    <div class="resume__col">
      <h3 class="stamp">Education</h3>
      <ul class="resume__list">${list(resume.education, (e) => `<li><strong>${t(e.org)}</strong>
        <span>${t(e.detail)}${e.showGpa && e.gpa ? ` · GPA ${esc(e.gpa)}` : ''}</span>
        ${e.coursework?.length ? `<span class="resume__courses"><span class="mono resume__cat">Senior-year coursework</span> ${e.coursework.map(esc).join(' · ')}</span>` : ''}</li>`)}</ul>
      <h3 class="stamp">Research</h3>
      <ul class="resume__list">${list(resume.research, (r) => `<li><strong>${t(r.title)}</strong><span>${t(r.detail)}</span></li>`)}</ul>
      <h3 class="stamp">Skills &amp; curricula</h3>
      <ul class="resume__skills mono">${list(resume.skills, (s) => `<li>${t(s)}</li>`)}</ul>
    </div>
    <div class="resume__col">
      <h3 class="stamp">Activities &amp; leadership</h3>
      <ol class="resume__list resume__list--acts">${list(resume.activities, (a) => `
        <li><strong>${t(a.role)}</strong><span class="mono resume__cat">${t(a.category)}</span><span>${t(a.text)}</span></li>`)}</ol>
    </div>`;
  document.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => print()));
}

/* ---------- Contact ---------- */
export function renderContact({ contact }) {
  $('.contact__headline').innerHTML = t(contact.headline);
  const email = isTodo(contact.email)
    ? (skip(contact.email) ? '' : `<p class="contact__email">${t(contact.email)}</p>`)
    : `<p class="contact__email"><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
         <button type="button" class="btn btn--ghost mono" data-copy="${esc(contact.email)}">Copy</button></p>`;
  const links = contact.links.map((l) => link(l, 'contact__link')).filter(Boolean).join('');
  $('.contact__body').innerHTML = `
    ${email}
    ${links ? `<p class="contact__links">${links}</p>` : ''}
    <p><button type="button" class="btn" data-print>Save résumé as PDF</button></p>`;
  $('.contact__body').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; }
    catch { b.textContent = 'Press ⌘C'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  });
  document.querySelectorAll('.contact [data-print]').forEach((b) => b.addEventListener('click', () => print()));
}
