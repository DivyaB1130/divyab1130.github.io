// Document reader (lazy-loaded): slides, papers, guides and magazines open in a
// full-screen dialog rendered with pdf.js, so they read the same on phones
// (where browsers often can't show PDFs inline) as on desktop. Pages render
// only as they scroll near; a Download link always offers the original PDF.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const ZOOMS = [1, 1.5, 2, 3];

let lib = null;
function loadPdfJs() {
  if (lib) return lib;
  lib = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
    s.onerror = () => { lib = null; reject(new Error('pdf.js failed to load')); };
    document.head.append(s);
  });
  return lib;
}

const $ = (s, r = document) => r.querySelector(s);

export async function openReader(doc, opener) {
  const box = $('.reader');
  const pagesEl = $('.reader__pages', box);
  const counter = $('[data-reader-page]', box);
  $('[data-reader-kind]', box).textContent = doc.kind;
  $('[data-reader-title]', box).textContent = doc.title;
  $('[data-reader-note]', box).textContent = doc.note || '';
  const dl = $('[data-reader-download]', box);
  dl.href = doc.file;
  dl.setAttribute('download', doc.file.split('/').pop());
  pagesEl.innerHTML = '<p class="reader__status mono">Loading document…</p>';
  counter.textContent = '';
  box.onclose = () => { cleanup(); opener?.focus({ preventScroll: true }); };
  box.showModal();

  let pdf, observer, onResize, zoom = 0, pages = [];
  const cleanup = () => { observer?.disconnect(); pdf?.destroy(); removeEventListener('resize', onResize); pagesEl.innerHTML = ''; pages = []; };

  try {
    const pdfjs = await loadPdfJs();
    pdf = await pdfjs.getDocument(doc.file).promise;
  } catch (err) {
    console.error(err);
    pagesEl.innerHTML = `<p class="reader__status">This document couldn't be displayed here. <a href="${doc.file}" target="_blank" rel="noopener">Open the PDF directly</a>.</p>`;
    return;
  }
  if (!box.open) return cleanup();

  // One placeholder per page, sized from the page's own aspect ratio.
  pagesEl.innerHTML = '';
  const first = await pdf.getPage(1);
  const vp1 = first.getViewport({ scale: 1 });
  for (let n = 1; n <= pdf.numPages; n++) {
    const wrap = document.createElement('div');
    wrap.className = 'reader__page';
    wrap.dataset.n = n;
    wrap.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
    wrap.innerHTML = `<canvas role="img" aria-label="Page ${n} of ${pdf.numPages}"></canvas>`;
    pagesEl.append(wrap);
    pages.push({ wrap, rendered: 0, task: null });
  }

  async function render(p) {
    const n = +p.wrap.dataset.n;
    const width = p.wrap.clientWidth;
    if (!width || p.rendered === width) return;
    p.rendered = width;
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    p.wrap.style.aspectRatio = `${base.width} / ${base.height}`; // pages can differ in size
    const scale = (width / base.width) * Math.min(devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale });
    const canvas = p.wrap.querySelector('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    p.task?.cancel();
    p.task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    try { await p.task.promise; p.wrap.classList.add('is-rendered'); } catch { /* cancelled by a re-render */ }
  }

  // Render pages near the viewport, and track which page is mostly in view.
  const visible = new Map();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const p = pages[+e.target.dataset.n - 1];
      if (e.isIntersecting) { render(p); visible.set(p, e.intersectionRatio); } else visible.delete(p);
    }
    const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) counter.textContent = `Page ${top[0].wrap.dataset.n} of ${pdf.numPages}`;
  }, { root: pagesEl, rootMargin: '800px 0px', threshold: [0, 0.25, 0.5, 0.75] });
  pages.forEach((p) => observer.observe(p.wrap));
  counter.textContent = `Page 1 of ${pdf.numPages}`;

  const current = () => +(counter.textContent.match(/\d+/)?.[0] || 1);
  const goPage = (n) => pages[Math.max(1, Math.min(pdf.numPages, n)) - 1].wrap.scrollIntoView({ block: 'start' });
  const setZoom = (z) => {
    const keep = current();
    zoom = Math.max(0, Math.min(ZOOMS.length - 1, z));
    pagesEl.style.setProperty('--zoom', ZOOMS[zoom]);
    $('[data-reader-zoom-label]', box).textContent = `${Math.round(ZOOMS[zoom] * 100)}%`;
    pages.forEach((p) => { p.rendered = 0; });
    requestAnimationFrame(() => { goPage(keep); pages.forEach((p) => visible.has(p) && render(p)); });
  };
  setZoom(0);

  box.onclick = (e) => {
    const b = e.target.closest('[data-reader]');
    if (!b) return;
    const a = b.dataset.reader;
    if (a === 'prev') goPage(current() - 1);
    if (a === 'next') goPage(current() + 1);
    if (a === 'zoom-in') setZoom(zoom + 1);
    if (a === 'zoom-out') setZoom(zoom - 1);
  };
  box.onkeydown = (e) => {
    if (e.target.closest('button, a')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goPage(current() + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPage(current() - 1); }
  };
  // Re-render at the new width when the window is resized.
  let rt;
  onResize = () => { clearTimeout(rt); rt = setTimeout(() => { pages.forEach((p) => { p.rendered = 0; }); visible.forEach((_, p) => render(p)); }, 200); };
  addEventListener('resize', onResize);
  pagesEl.focus({ preventScroll: true });
}
