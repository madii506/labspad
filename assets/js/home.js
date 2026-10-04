// LabsPad home: the headline with three sample voices, the studio (a face, a voice designed for it, a token), on air
// (real voice notes), the influencers on pump.fun, how it works. Before the first launch, the lists say so.
(function () {
  'use strict';
  const C = window.Core, X = window.Cross, L = window.Live, V = window.Vox;
  const { $, $$, esc } = C;
  const st = { face: null, faceUrl: null, preview: null, previews: [], busy: false, born: null, open: null, xi: null, board: null, sort: 'new', hint: '' };
  const status = (el, t, bad) => { el.textContent = t || ''; el.classList.toggle('bad', !!bad); };

  // ---------- page one ----------
  const words = [['Launch', 'an', 'AI', 'influencer.'], ['With', 'its', 'own', 'voice.']];
  let wi = 0; $('#h1').innerHTML = words.map((l, n) => `<span class="${n ? 'a' : ''}">${l.map(w => `<span class="w" style="--i:${wi++}">${w}</span>`).join(' ')}</span>`).join('');
  const SAMPLES = [{ k: 'mila', name: 'Mila', sub: '$MILA', orb: 'o-lilac', text: 'One line of text this morning. Now a voice.' }, { k: 'kiko', name: 'Kiko', sub: '$KIKO', orb: 'o-ember', text: 'New voice note every few hours.' }, { k: 'dex', name: 'Dex', sub: '$DEX', orb: 'o-sea', text: 'Some have a ring light. I have a voice.' }];
  $('#stack').insertAdjacentHTML('beforeend', SAMPLES.map((s, i) => V.card({ ...s, url: '/api/voice?house=' + s.k, i, seed: s.k })).join(''));
  function tape(items) { const el = $('#tape'); el.innerHTML = items.join('') + items.join(''); el.style.setProperty('--dur', Math.max(30, items.length * 6) + 's'); }
  tape(['a face', 'a voice', 'a token', 'voice notes every six hours', 'ask it anything', 'never price'].map((t, i) => `<span><span class="orb ${['o-ember', 'o-lilac', 'o-sea', 'o-sand', 'o-mint', 'o-cocoa'][i]}"></span>${t}</span>`));

  // ---------- 01 the studio ----------
  const line = $('#line'), nm = $('#nm'), tk = $('#tk'), vdesc = $('#vdesc');
  const faceBtn = $('#faceBtn'), voiceBtn = $('#voiceBtn'), faceStatus = $('#faceStatus'), voiceStatus = $('#voiceStatus');
  function stage() {
    $('#s1').classList.toggle('done', !!st.face); $('#s1').classList.toggle('now', !st.face);
    $('#s2').classList.toggle('done', !!st.preview); $('#s2').classList.toggle('now', !!st.face && !st.preview);
    $('#s3').classList.toggle('now', !!st.face && !!st.preview && !st.born); $('#s3').classList.toggle('done', !!st.born);
  }
  function preview() {
    const n = nm.value.trim(), t = tk.value.trim().replace(/^\$/, '');
    $('#pvName').textContent = n || 'your influencer'; $('#pvTk').textContent = '$' + (t || 'TICKER'); $('#pvLine').textContent = line.value.trim() || 'One line, a face, a voice.';
    const f = $('#pvFace'); if (st.faceUrl) { f.src = st.faceUrl; f.hidden = false; } else f.hidden = true;
    const p = st.previews.find(v => v.id === st.preview);
    $('#pvVoice').innerHTML = p ? V.card({ name: n || 'its voice', sub: 'first words', url: p.url, orb: false, seed: p.id }) : '';
  }
  let tickerTouched = false;
  nm.addEventListener('input', () => { if (!tickerTouched) tk.value = nm.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10); preview(); refreshGo(); });
  tk.addEventListener('input', () => { tickerTouched = !!tk.value; tk.value = tk.value.replace(/[^A-Za-z0-9$]/g, '').toUpperCase(); preview(); refreshGo(); });
  line.addEventListener('input', preview);
  function setFace(r) {
    st.face = r.face; st.faceUrl = r.url; st.preview = null; st.previews = []; $('#voices').innerHTML = '';
    if (r.voice && !vdesc.value.trim()) vdesc.value = r.voice;
    $('#s1n').textContent = 'done'; stage(); preview(); refreshGo();
    if (!nm.value.trim()) nm.focus();
  }
  faceBtn.addEventListener('click', async () => {
    if (st.busy) return; const l = line.value.trim();
    if (l.length < 8) return status(faceStatus, 'Describe them in one line first.', true);
    st.busy = true; faceBtn.disabled = true; faceBtn.textContent = 'Making the face…'; status(faceStatus, 'About 15 seconds.');
    $('#pvOrb').classList.add('playing');
    try { const r = await C.post('/api/face', { line: l }); if (!r.ok) status(faceStatus, r.error || 'It didn’t come out. Try again.', true); else { setFace(r); status(faceStatus, 'Face done. Now the voice.'); } }
    catch { status(faceStatus, 'It didn’t come out. Try again.', true); }
    finally { st.busy = false; faceBtn.disabled = false; faceBtn.textContent = 'Make the face'; $('#pvOrb').classList.remove('playing'); }
  });
  $('#pic').addEventListener('change', () => {
    const f = $('#pic').files && $('#pic').files[0]; if (!f) return;
    if (!$('#fict').checked) { status(faceStatus, 'Tick the box first: it has to be a fictional character.', true); $('#pic').value = ''; return; }
    if (f.size > 12e6) return status(faceStatus, 'That picture is too big.', true);
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = async () => {
      const s = Math.min(im.width, im.height), cv = document.createElement('canvas'); cv.width = cv.height = 768;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 768, 768); x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 768, 768); URL.revokeObjectURL(url);
      status(faceStatus, 'Uploading…');
      try { const r = await C.post('/api/face', { image: cv.toDataURL('image/jpeg', .9), line: line.value.trim() }); if (!r.ok) status(faceStatus, r.error, true); else { setFace(r); status(faceStatus, 'Face done. Now the voice.'); } }
      catch { status(faceStatus, 'The upload didn’t go through. Try again.', true); }
    };
    im.onerror = () => { status(faceStatus, 'That file didn’t open.', true); URL.revokeObjectURL(url); };
    im.src = url;
  });
  voiceBtn.addEventListener('click', async () => {
    if (st.busy) return;
    if (!st.face) return status(voiceStatus, 'Make or upload the face first.', true);
    if (line.value.trim().length < 8) return status(voiceStatus, 'Describe them in one line in step 1.', true);
    if (!nm.value.trim()) return status(voiceStatus, 'Give them a name.', true);
    st.busy = true; voiceBtn.disabled = true; voiceBtn.textContent = 'Designing…'; status(voiceStatus, 'ElevenLabs is designing three voices. About 20 seconds.');
    $('#voices').innerHTML = [0, 1, 2].map(() => '<div class="skel" style="height:160px"></div>').join('');
    try {
      const r = await C.post('/api/voice', { name: nm.value.trim(), symbol: tk.value.trim(), line: line.value.trim(), describe: vdesc.value.trim(), face: st.face });
      if (!r.ok) { $('#voices').innerHTML = ''; status(voiceStatus, r.error || 'The voices didn’t come out. Try again.', true); return; }
      st.previews = r.previews; st.preview = null; if (r.describe && !vdesc.value.trim()) vdesc.value = r.describe;
      const orbs = ['o-ember', 'o-lilac', 'o-sea'];
      $('#voices').innerHTML = r.previews.map((p, i) => `<div class="vo" data-id="${p.id}" data-url="${p.url}"><span class="orb ${orbs[i % 3]}"></span><button class="pl" type="button" aria-label="Play voice ${i + 1}">${V.PLAY}</button><b>Voice ${i + 1}</b><small>tap to pick</small></div>`).join('');
      status(voiceStatus, 'Play them, then pick one.');
    } catch { $('#voices').innerHTML = ''; status(voiceStatus, 'The voices didn’t come out. Try again.', true); }
    finally { st.busy = false; voiceBtn.disabled = false; voiceBtn.textContent = 'Design three new voices'; }
  });
  $('#voices').addEventListener('click', e => {
    if (e.target.closest('.pl')) return; const v = e.target.closest('.vo'); if (!v) return;
    st.preview = Number(v.dataset.id); $$('#voices .vo').forEach(x => { x.classList.toggle('pick', x === v); x.querySelector('small').textContent = x === v ? 'picked' : 'tap to pick'; });
    status(voiceStatus, 'That’s its voice.'); stage(); preview(); refreshGo();
  });

  // ---------- the token ----------
  const xh = $('#xh'), goBtn = $('#goBtn'), goStatus = $('#goStatus'), goProg = $('#goProg'), goRes = $('#goRes');
  const handle = () => xh.value.trim().replace(/^@/, '');
  const clip32 = s => { s = s.trim(); while (new TextEncoder().encode(s).length > 32) s = s.slice(0, -1); return s; };
  function splitShow() { const me = C.S.me || '\u0000you', H = '\u0000house'; $('#split').innerHTML = X.sharesOf(me, H).map(r => `<div class="${r.address === me ? 'me' : ''}"><dt>${r.address === me ? 'You' : 'The house · pays for voices'}</dt><dd>${r.bps / 100}%</dd></div>`).join(''); }
  function refreshGo() {
    if (st.busyGo) return;
    if (st.open === false) { goBtn.disabled = true; goBtn.textContent = 'Launching opens soon'; return; }
    if (st.born) { goBtn.disabled = true; goBtn.textContent = 'Launched ✓'; return; }
    goBtn.disabled = false; goBtn.textContent = C.S.me ? 'Launch it' : 'Connect wallet to launch';
  }
  const buy = X.buyBox($('#buyBox'));
  C.onWallet(() => { splitShow(); refreshGo(); });
  goBtn.addEventListener('click', async () => {
    if (st.busyGo || st.born || st.open === false) return;
    if (!C.S.me) { await C.connect(); refreshGo(); return; }
    const name = clip32(nm.value), symbol = tk.value.trim().replace(/^\$/, '').toUpperCase();
    if (!st.face) return status(goStatus, 'Make or upload the face in step 1.', true);
    if (line.value.trim().length < 8) return status(goStatus, 'Describe them in one line in step 1.', true);
    if (!name) return status(goStatus, 'Give them a name in step 2.', true);
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return status(goStatus, 'The ticker is 1–10 letters or numbers.', true);
    if (!st.preview && st.xi) return status(goStatus, 'Pick a voice in step 2.', true);
    if (handle() && !/^[A-Za-z0-9_]{1,15}$/.test(handle())) return status(goStatus, 'That X handle doesn’t look right.', true);
    if (buy.over()) return status(goStatus, 'Up to 5 SOL in the first buy.', true);
    st.busyGo = true; goBtn.disabled = true; goBtn.textContent = 'Launching…'; status(goStatus, ''); goRes.hidden = true;
    try {
      const r = await X.run({ name, symbol, line: line.value.trim(), x: handle(), face: st.face, voice: st.preview, devBuy: buy.lamports(), onStep: i => X.steps(goProg, i) });
      X.steps(goProg, 99, true); st.born = r.mint; stage();
      const live = r.settle && r.settle.live;
      goRes.hidden = false;
      goRes.innerHTML = `<p class="okt">${esc(name)} is ${live ? 'live. Its first words are on its page.' : 'on pump.fun.'}</p>${r.buyNote ? `<p class="status">${esc(r.buyNote)}</p>` : ''}<div class="acts"><a class="btn" href="/c/${r.mint}">Its page →</a><a class="btn line" href="https://pump.fun/coin/${r.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn line" href="${C.solscan('tx', r.sig)}" target="_blank" rel="noopener">Solscan ↗</a></div>`;
      C.toast('$' + symbol + ' is live.'); loadBoard(r.mint);
      if (live) C.post('/api/voice', { mint: r.mint, first: true }).catch(() => {});
    } catch (e) {
      status(goStatus, C.human(e), true);
      if (e && e.mint) { goRes.hidden = false; goRes.innerHTML = `<div class="acts"><a class="btn" href="/c/${e.mint}">Finish it on its page →</a></div>`; }
    } finally { st.busyGo = false; refreshGo(); }
  });

  // ---------- on air + influencers ----------
  function renderAir() {
    const ns = (st.board && st.board.notes) || [], el = $('#feed');
    if (!ns.length) { el.style.display = 'block'; el.innerHTML = `<div class="none"><span class="orb o-ember"></span>${st.board && st.board.offline ? '<b>The records are offline</b>Voice notes play here when they’re back.' : '<b>Quiet on air</b>The first influencer’s first words play here the minute it launches.'}</div>`; return; }
    el.style.display = '';
    el.innerHTML = ns.map((n, i) => `<a href="/c/${n.mint}" style="text-decoration:none">${V.card({ name: n.name, sub: '$' + n.symbol, text: n.text, url: n.url, face: '/i/' + n.mint, seed: n.id, i })}</a>`).join('');
  }
  function renderCos(hit) {
    const ks = ((st.board && st.board.coins) || []).slice(), el = $('#coList'), sol = st.board && st.board.solUsd;
    if (st.sort === 'heavy') ks.sort((x, y) => (y.mcap_sol || 0) - (x.mcap_sol || 0) || y.slot - x.slot); else ks.sort((x, y) => y.slot - x.slot);
    if (!ks.length) { el.innerHTML = `<div class="none"><span class="orb o-lilac"></span><b>No influencers yet</b>The first one on the list could be yours.</div>`; return; }
    const S = { awake: 'talking', rot: 'quiet', dead: 'silent', ascended: 'graduated' };
    el.innerHTML = ks.slice(0, 200).map(k => { const mc = k.mcap_sol != null ? (sol ? C.usd(k.mcap_sol * sol) : k.mcap_sol.toFixed(1) + ' SOL') : '—';
      return `<a class="co${k.mint === hit ? ' hit' : ''}" data-m="${k.mint}" href="/c/${k.mint}"><img src="/i/${k.mint}" alt="" loading="lazy"><span><b>${esc(k.name)}</b><small>$${esc(k.symbol)} · ${k.notes || 0} voice notes</small></span><span class="stc ${esc(k.state)}"><i></i>${esc(S[k.state] || k.state)}</span><span class="v">${mc}</span></a>`; }).join('');
  }
  $('#sorts').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.sort = b.dataset.s; $$('#sorts button').forEach(x => x.classList.toggle('on', x === b)); renderCos(); });
  if (L) { L.births(false); L.on('trade', t => { const c = document.querySelector(`.co[data-m="${t.mint}"]`); if (!c) return; c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); }); }
  async function loadBoard(hit) {
    let j = null; try { j = await C.get('/api/board'); } catch {}
    if (!j || !j.ok) { if (!st.board) { st.board = { offline: true }; renderAir(); $('#coList').innerHTML = `<div class="none"><b>The records didn’t answer</b><button class="btn line sm" type="button" id="retryBoard">Try again</button></div>`; const r = $('#retryBoard'); if (r) r.onclick = () => loadBoard(); } return; }
    st.board = j; if (j.open != null) st.open = j.open; if (j.xi != null) st.xi = j.xi; refreshGo(); renderCos(hit); renderAir();
    if (st.xi === false) { voiceBtn.disabled = false; status(voiceStatus, 'Voices open soon: the house’s ElevenLabs key isn’t set yet.'); }
    if (L) L.watch((j.coins || []).slice(0, 200).map(k => k.mint));
  }

  splitShow(); refreshGo(); stage(); preview(); loadBoard();
  setInterval(() => { if (!document.hidden && !st.busyGo) loadBoard(); }, 20000);
  if (L) L.start();
})();
