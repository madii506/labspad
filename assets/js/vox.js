// LabsPad voices: one player for the whole page (one voice at a time), voice cards with a waveform that fills as it plays.
(function () {
  'use strict';
  const C = window.Core, { esc } = C;
  const ORBS = ['ember', 'lilac', 'sea', 'sand', 'mint', 'cocoa'];
  const orbOf = s => 'o-' + ORBS[Math.abs([...String(s || 'x')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % ORBS.length];
  const PLAY = '<svg class="pp" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg><svg class="pa" viewBox="0 0 16 16"><rect x="3" y="2.5" width="3.6" height="11" rx="1.2"/><rect x="9.4" y="2.5" width="3.6" height="11" rx="1.2"/></svg>';
  function wave(seed, n = 34) {
    let x = Math.abs([...String(seed)].reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5)) || 1; const r = () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let out = ''; for (let i = 0; i < n; i++) { const t = i / n, h = .2 + .55 * Math.abs(Math.sin(t * 7 + r() * 2)) + .25 * r(); out += `<i style="--h:${Math.min(1, h).toFixed(2)};--j:${i}"></i>`; }
    return `<div class="wave">${out}</div>`;
  }
  // a voice card: avatar (a face or an orb), name, a line of text, a waveform, a play button
  function card(o) {
    const av = o.face ? `<img class="face" src="${o.face}" alt="" loading="lazy" style="width:64px;height:64px">` : o.orb !== false ? `<span class="orb ${o.orb || orbOf(o.name)}"></span>` : '';
    return `<div class="vc" data-url="${o.url || ''}" style="--i:${o.i || 0}">${av}<div style="min-width:0"><div class="nm">${esc(o.name)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${o.text ? `<div class="tx">${esc(o.text)}</div>` : ''}${wave(o.seed || o.name)}</div><button class="pl" type="button" aria-label="Play">${PLAY}</button></div>`;
  }
  const audio = new Audio(); audio.preload = 'none'; let cur = null;
  function stop() { audio.pause(); if (cur) { cur.classList.remove('playing'); cur.querySelectorAll('.wave i').forEach(i => i.classList.remove('on')); const o = cur.querySelector('.orb'); if (o) o.classList.remove('playing'); } cur = null; }
  function tick() {
    if (!cur || audio.paused) return; const bars = cur.querySelectorAll('.wave i'), p = audio.duration ? audio.currentTime / audio.duration : 0, n = Math.floor(p * bars.length);
    bars.forEach((b, k) => b.classList.toggle('on', k < n)); requestAnimationFrame(tick);
  }
  audio.addEventListener('ended', stop); audio.addEventListener('error', () => { if (cur) C.toast('That voice didn’t load.'); stop(); });
  function play(el) {
    const url = el.dataset.url;
    if (!url) { C.toast(el.dataset.why || 'Voices open soon.'); return; }
    if (cur === el && !audio.paused) { stop(); return; }
    stop(); cur = el; el.classList.add('playing'); const o = el.querySelector('.orb'); if (o) o.classList.add('playing');
    audio.src = url; audio.play().then(() => requestAnimationFrame(tick)).catch(() => { C.toast('Tap again to play.'); stop(); });
  }
  document.addEventListener('click', e => { const b = e.target.closest('.pl'); if (!b) return; const el = b.closest('[data-url]'); if (el) { e.preventDefault(); e.stopPropagation(); play(el); } });
  window.Vox = { card, wave, play, stop, orbOf, PLAY };
})();
