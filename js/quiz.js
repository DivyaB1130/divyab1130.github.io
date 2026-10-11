// "Pick a side" (lazy-loaded): playable version of Divya & Camila's
// greenhouse-effect lesson. Questions come from content.curiosities.pickASide.

import { esc } from './util.js';

export default function init(el, content) {
  const qs = content.curiosities.pickASide;
  let i = 0, score = 0;
  el.querySelector('.curio__note')?.remove();
  const box = document.createElement('div');
  box.setAttribute('aria-live', 'polite');
  el.append(box);

  const ask = (focus = true) => {
    const q = qs[i];
    box.innerHTML = `
      <p class="quiz__progress mono">Question ${i + 1} of ${qs.length} · from the Greenhouse Effect lesson (with Camila)</p>
      <p class="quiz__prompt">${esc(q.prompt)}</p>
      <div class="quiz__options">${q.options.map((o, k) => `<button type="button" class="quiz__opt" data-k="${k}">${esc(o)}</button>`).join('')}</div>
      <p class="quiz__why"></p>`;
    if (focus) box.querySelector('.quiz__opt').focus({ preventScroll: true });
  };

  const end = () => {
    box.innerHTML = `
      <p class="quiz__prompt">${score} of ${qs.length} on the evidence side.</p>
      <p>Misconceptions survive because they're convincing. The point of the game is noticing which one almost got you.</p>
      <button type="button" class="btn" data-again>Play again</button>`;
    box.querySelector('[data-again]').focus({ preventScroll: true });
  };

  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-again]')) { i = 0; score = 0; return ask(); }
    if (e.target.closest('[data-next]')) { i += 1; return i < qs.length ? ask() : end(); }
    const b = e.target.closest('.quiz__opt');
    if (!b || b.disabled) return;
    const q = qs[i], pick = +b.dataset.k;
    if (pick === q.answer) score += 1;
    box.querySelectorAll('.quiz__opt').forEach((o) => {
      o.disabled = true;
      o.dataset.result = +o.dataset.k === q.answer ? 'right' : 'wrong';
    });
    box.querySelector('.quiz__why').innerHTML =
      `${pick === q.answer ? 'Yes. ' : 'Not quite. '}${esc(q.why)} <small>Source: ${esc(q.source)}</small>`;
    const next = document.createElement('button');
    next.type = 'button'; next.className = 'btn'; next.dataset.next = '';
    next.textContent = i + 1 < qs.length ? 'Next question' : 'See result';
    box.append(next);
    next.focus({ preventScroll: true });
  });

  ask(false);
}
