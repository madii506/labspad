// POST /api/voice {name, symbol, line, describe, face}  design the influencer's voice with ElevenLabs: three voices, each
//      saying its first words. Pick one; it's kept when the coin launches.
// POST /api/voice {mint, ask}    ask a live influencer something; it answers out loud (answers aren't listed)
// POST /api/voice {mint, first}  a freshly launched influencer's first words (once)
// GET  /api/voice?p=N  a designed voice (MP3)     GET /api/voice?n=N  a voice note (MP3)
// GET  /api/voice?house=mila|kiko|dex  the sample voices on page one (ElevenLabs' own premade voices)
const L = require('./_lib');
const B = require('./_labs');
const HOUSE = {
  mila: { voice: 'EXAVITQu4vr4xnSDxMaL', text: 'Hey, it’s Mila. This morning I was one line of text. Now I have a face, a voice and a coin. Honestly? Character development.' },
  kiko: { voice: 'pFZP5JQG7iQjIQuC4Bku', text: 'Kiko here. I don’t sleep, I just lower my voice and keep posting. Anyway. New voice note every few hours. Stay close.' },
  dex: { voice: 'JBFqnCBsd6RMkjVDRZzb', text: 'Dex speaking. Some influencers have a ring light. I have a voice and a token. Pick your fighter.' },
};
function mp3(req, res, buf) {
  buf = Buffer.from(buf); const size = buf.length, range = String(req.headers.range || '');
  res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  const m = range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const a = m[1] === '' ? size - Number(m[2]) : Number(m[1]), z = m[2] === '' || m[1] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
    if (a < 0 || a >= size || z < a) { res.statusCode = 416; res.setHeader('Content-Range', 'bytes */' + size); return res.end(); }
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${a}-${z}/${size}`); res.setHeader('Content-Length', z - a + 1); return res.end(buf.subarray(a, z + 1));
  }
  res.statusCode = 200; res.setHeader('Content-Length', size); return res.end(buf);
}
module.exports = async (req, res) => {
  L.setOidc(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'LabsPad’s records are offline. Try again shortly.' });
  try {
    await L.ready();
    const qy = L.query(req);
    if (req.method === 'GET') {
      if (qy.house) {                      // the sample voices on page one, spoken once and kept
        const h = HOUSE[String(qy.house)]; if (!h) { res.statusCode = 404; return res.end(); }
        let r = await L.q('SELECT audio FROM lpad_notes WHERE kind=$1 ORDER BY id DESC LIMIT 1', ['house:' + qy.house]);
        if (!r.length && L.XI && !L.limited('house', 6, 600000)) { const s = await L.speak(h.voice, h.text); if (s.ok && s.buf.length > 500) { await L.q('INSERT INTO lpad_notes (kind, text, audio) VALUES ($1,$2,$3)', ['house:' + qy.house, h.text, s.buf]); r = [{ audio: s.buf }]; } }
        if (!r.length) { res.statusCode = 404; res.setHeader('Cache-Control', 'public, max-age=60'); return res.end(); }
        return mp3(req, res, r[0].audio);
      }
      const p = String(qy.p || ''), n = String(qy.n || '');
      const r = /^\d{1,12}$/.test(p) ? await L.q('SELECT audio FROM lpad_voices WHERE id=$1', [p]) : /^\d{1,12}$/.test(n) ? await L.q('SELECT audio FROM lpad_notes WHERE id=$1', [n]) : [];
      if (!r.length) { res.statusCode = 404; return res.end(); }
      return mp3(req, res, r[0].audio);
    }
    if (req.method !== 'POST') return L.send(res, 405, { ok: false, error: 'POST only.' });
    const b = await L.body(req, 16 * 1024);
    if (b.mint) {
      const mint = String(b.mint); if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
      const k = (await L.q('SELECT mint, name, symbol, voice, look, status, voice_id, preview FROM lpad_coins WHERE mint=$1', [mint]))[0];
      if (!k || k.status !== 'live') return L.send(res, 200, { ok: false, error: 'That influencer isn’t live yet.' });
      if (b.first) { if (L.limited('first:' + mint, 2, 600000)) return L.send(res, 200, { ok: false, error: 'It’s already warming up.' }); return L.send(res, 200, await B.first(k)); }
      const ask = L.clean(b.ask, 240);
      if (ask.length < 3) return L.send(res, 200, { ok: false, error: 'Ask it something.' });
      if (L.limited('ask:' + L.ip(req), 5, 600000)) return L.send(res, 200, { ok: false, error: 'Five questions per ten minutes. It needs to breathe.' });
      if (!L.XI) return L.send(res, 200, { ok: false, error: 'Voices open soon: the house’s ElevenLabs key isn’t set yet.' });
      const a = await B.answerText(k, ask); if (!a.ok) return L.send(res, 200, a);
      return L.send(res, 200, await B.say(k, 'answer', a.text));
    }
    const name = L.clean(b.name, 32) || 'your influencer', symbol = L.clean(b.symbol, 10).replace(/^\$/, '').toUpperCase().replace(/[^A-Z0-9]/g, ''), line = L.clean(b.line, 300);
    if (line.length < 8) return L.send(res, 200, { ok: false, error: 'Describe your influencer in one line first.' });
    if (L.BANNED.test(name + ' ' + symbol + ' ' + line + ' ' + (b.describe || ''))) return L.send(res, 200, { ok: false, error: 'That breaks the house rules. Try another.' });
    if (L.limited('voice:' + L.ip(req), 4, 3600000)) return L.send(res, 200, { ok: false, error: 'Four voice designs an hour from here. Pick one of the voices you have.' });
    const face = /^\d{1,12}$/.test(String(b.face || '')) ? Number(b.face) : null;
    const look = face ? ((await L.q('SELECT look FROM lpad_faces WHERE id=$1', [face]))[0] || {}).look : null;
    L.send(res, 200, await B.design({ name, symbol, voice: line, look, voiceHint: L.clean(b.hint, 200) }, b.describe, face, L.ip(req)));
  } catch (e) { L.send(res, 200, { ok: false, error: 'The voice desk didn’t answer. Try again.', why: String(e && e.message).slice(0, 160) }); }
};
