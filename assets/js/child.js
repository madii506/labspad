// LabsPad influencer page: its face and voice, its voice notes, ask it something (it answers out loud), its split and
// payout, what happened to it. Read from LabsPad's records; nothing is made up.
(function () {
  'use strict';
  const C = window.Core, X = window.Cross, L = window.Live, V = window.Vox;
  const { $, esc } = C;
  const mint = (location.pathname.match(/\/c\/([1-9A-HJ-NP-Za-km-z]{32,44})/) || [])[1] || new URLSearchParams(location.search).get('m');
  const app = $('#app'), st = { k: null, notes: [], log: [] };
  const status = (el, t, bad) => { if (!el) return; el.textContent = t || ''; el.classList.toggle('bad', !!bad); };
  const S = { awake: 'talking', rot: 'quiet', dead: 'silent', ascended: 'graduated' };
  if (!mint) { app.innerHTML = `<section class="prof"><div class="wrap"><div class="none"><b>Nobody here</b><a class="btn sm" href="/">Back to LabsPad</a></div></div></section>`; return; }
  function shell(k) {
    document.title = k.name + ' · LABSPAD'; const live = k.status === 'live';
    app.innerHTML = `
    <section class="prof"><div class="wrap pgrid">
      <div class="ring reveal"><span class="orb ${V.orbOf(k.mint)}" id="ring"></span><img src="/i/${k.mint}" alt="${esc(k.name)}"></div>
      <div class="reveal">
        <h1>${esc(k.name)}</h1>
        <div class="tk">$${esc(k.symbol)} <span class="stc ${esc(k.state)}"><i></i>${esc(live ? (S[k.state] || k.state) : 'not live yet')}</span></div>
        <p class="ln">${esc(k.voice)}</p>
        <div class="acts">${live ? `<a class="btn acc sm" href="https://pump.fun/coin/${k.mint}" target="_blank" rel="noopener">Buy on pump.fun ↗</a><a class="btn line sm" href="https://dexscreener.com/solana/${k.mint}" target="_blank" rel="noopener">Chart ↗</a>` : ''}${k.xhandle ? `<a class="btn line sm" href="https://x.com/${esc(k.xhandle)}" target="_blank" rel="noopener">X ↗</a>` : ''}<span class="ca"><span>${C.short(k.mint, 6)}</span><button type="button" id="caBtn">Copy CA</button></span></div>
        ${live ? '' : `<div class="panel" style="margin-top:18px"><h3>Almost live</h3><p class="status" id="finStatus">Its token is on pump.fun, but its split isn’t locked yet. The wallet that launched it can finish with one more signature.</p><div class="acts"><button class="btn sm" id="finBtn" type="button">Finish it</button></div></div>`}
      </div>
    </div></section>
    <section class="sec"><div class="wrap cols2">
      <div class="panel"><h3>Voice notes <small id="nCount"></small></h3><div class="notes" id="notes"></div></div>
      <div style="display:grid;gap:24px">
        <div class="panel"><h3>Ask ${esc(k.name)} <small>it answers out loud</small></h3>
          <form class="ask" id="askForm" autocomplete="off"><input class="in" id="askText" maxlength="240" placeholder="what’s your morning routine?"><button class="btn sm" type="submit">Ask</button></form>
          <p class="status" id="askStatus"></p><div class="qa" id="qa"></div></div>
        <div class="panel"><h3>The split <small>locked at launch</small></h3><dl class="split">${(k.shares || []).map(s => `<div class="${s.address === k.payer ? 'me' : ''}"><dt>${s.address === k.payer ? 'The launcher' : 'The house · voices'}</dt><dd>${s.bps / 100}%</dd></div>`).join('')}</dl>
          <p class="status" id="vault">${k.vault_lamports > 0 ? C.sol(k.vault_lamports) + ' waiting to be paid out.' : 'Nothing waiting to be paid out right now.'}</p><div class="acts"><button class="btn line sm" id="feedBtn" type="button">Pay out the fees</button></div></div>
        <div class="panel"><h3>What happened</h3><ul class="log" id="log"></ul></div>
      </div>
    </div></section>`;
    $('#caBtn').onclick = () => C.copy(k.mint);
    $('#feedBtn').onclick = async () => { const el = $('#vault'); status(el, 'Building the payout…'); try { const r = await X.feed(k.mint); if (!r) return status(el, 'Connect a wallet to send it.'); status(el, 'Paid out ' + C.sol(r.waiting) + ' to the split.'); C.toast('Fees paid out.'); } catch (e) { status(el, C.human(e), true); } };
    const fin = $('#finBtn'); if (fin) fin.onclick = async () => { const el = $('#finStatus'); if (!C.S.me) { await C.connect(); if (!C.S.me) return; } status(el, 'Building it…'); try { await X.route(k.mint); status(el, 'Done. It’s live.'); setTimeout(() => location.reload(), 1200); } catch (e) { status(el, C.human(e), true); } };
    $('#askForm').addEventListener('submit', async e => {
      e.preventDefault(); const el = $('#askStatus'), q = $('#askText').value.trim(), qa = $('#qa');
      if (q.length < 3) return status(el, 'Ask it something.', true);
      qa.insertAdjacentHTML('beforeend', `<div class="q">${esc(q)}</div>`); $('#askText').value = ''; status(el, k.name + ' is thinking…');
      $('#ring').classList.add('playing');
      const r = await C.post('/api/voice', { mint: k.mint, ask: q }).catch(() => null);
      $('#ring').classList.remove('playing'); status(el, '');
      if (!r || !r.ok) { qa.insertAdjacentHTML('beforeend', `<p class="status bad">${esc((r && r.error) || 'No answer this time. Try again.')}</p>`); return; }
      qa.insertAdjacentHTML('beforeend', V.card({ name: k.name, text: r.text, url: r.url, face: '/i/' + k.mint, seed: r.id }));
      const card = qa.lastElementChild; card.style.opacity = 1; card.style.transform = 'none'; card.style.animation = 'none'; V.play(card);
    });
    C.reveal(app);
  }
  function renderNotes() {
    const el = $('#notes'); if (!el) return; $('#nCount').textContent = st.notes.length ? st.notes.length + ' so far' : '';
    if (!st.notes.length) { el.innerHTML = `<div class="none" style="padding:30px 12px"><span class="orb ${V.orbOf(mint)}"></span><b>Warming up</b>${st.xi === false ? 'Voices open soon: the house’s ElevenLabs key isn’t set yet.' : 'Its first words land here in a moment.'}</div>`; return; }
    el.innerHTML = st.notes.map((n, i) => V.card({ name: n.kind === 'intro' ? 'First words' : 'Voice note', sub: C.ago(new Date(n.at)), text: n.text, url: n.url, orb: false, seed: n.id, i }) .replace('<div class="tx">', '<div class="tx">')).join('');
  }
  function renderLog() { const el = $('#log'); if (!el) return; el.innerHTML = st.log.length ? st.log.map(l => `<li><time>${C.ago(new Date(l.at))}</time><span>${esc(l.text)}</span></li>`).join('') : '<li><span style="color:var(--mut)">Nothing yet.</span></li>'; }
  let asked = false;
  async function load() {
    let j = null; try { j = await C.get('/api/kid?mint=' + mint); } catch {}
    if (!j || !j.ok) { if (!st.k) app.innerHTML = `<section class="prof"><div class="wrap"><div class="none"><b>${j && j.missing ? 'Nobody here' : 'The records didn’t answer'}</b>${esc((j && j.error) || '')}<div class="acts" style="justify-content:center"><a class="btn sm" href="/">Back to LabsPad</a></div></div></div></section>`; return; }
    const first = !st.k; st.k = j.coin; st.notes = j.notes || []; st.log = j.log || []; st.xi = j.xi;
    if (first) shell(st.k);
    renderNotes(); renderLog();
    // a fresh influencer with no words yet: ask for its first words once
    if (!asked && st.k.status === 'live' && !st.notes.length && j.xi) { asked = true; C.post('/api/voice', { mint, first: true }).then(r => { if (r && r.ok) setTimeout(load, 800); }).catch(() => {}); }
    if (first && L && st.k.status === 'live') { L.births(false); L.watch([mint]); L.start(); }
  }
  load(); setInterval(() => { if (!document.hidden) load(); }, 30000);
})();
