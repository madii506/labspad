// LabsPad: every coin launched here is an AI influencer with its own face and its own voice. This file: the influencer
// (a face from one line, or an uploaded picture of a fictional character), its voice (designed with ElevenLabs from a
// description, kept at launch), what it says (a small OpenAI model writes it, ElevenLabs speaks it), and the reading of
// every coin from the chain.
const L = require('./_lib');
const DAY = 864e5;
const RULES = 'House rules: no financial advice, no price predictions, no promises of gains, never tell anyone to buy or sell, never say "100x", "moon" or "guaranteed", no real or famous people, nothing sexual, no links.';
// ElevenLabs' own premade voices: a fallback when a designed voice can't be kept
const HOUSE_VOICES = ['JBFqnCBsd6RMkjVDRZzb', 'EXAVITQu4vr4xnSDxMaL', 'IKne3meq5aSn9XLyUdCD', 'FGY2WhTYpPnrIDTdsKH5', 'TX3LPaxmHKxFdv7VOQHJ', 'cgSgspJ2msm6clMCkdW9', 'nPczCjzI2devNBz1zQrb', 'pFZP5JQG7iQjIQuC4Bku'];
const BREAK = 'The voices are resting: the house’s credits are being topped up. Try again soon.';
const broke = e => /credit|quota|payment|insufficient|top-?up|limit/i.test(String(e || ''));

// ---------- the chain ----------
async function routingOf(mint) {
  if (L.MOCK && L.MOCK.routing) return L.MOCK.routing(mint);
  return require('./_pump').routing(mint, L.accounts);
}
const sameShares = (got, want) => got.length === want.length && want.every((w, i) => got[i].address === w.address && got[i].bps === w.bps);
async function settle(mint) {
  const k = (await L.q('SELECT mint, symbol, name, status, slot, shares FROM lpad_coins WHERE mint=$1', [mint]))[0];
  if (!k) return { ok: false, error: 'No coin was recorded for that token.' };
  if (k.status === 'live') return { ok: true, live: true, slot: k.slot };
  if (k.status === 'void') return { ok: true, live: false, void: true };
  const r = await routingOf(mint);
  if (!r.exists) return { ok: true, live: false, waiting: 'coin' };
  const shares = typeof k.shares === 'string' ? JSON.parse(k.shares) : k.shares;
  if (!(r.routed && r.revoked && sameShares(r.shareholders, shares))) return { ok: true, live: false, waiting: 'split', mint };
  for (let i = 0; i < 4; i++) {
    try {
      const u = await L.q(`UPDATE lpad_coins SET status='live', slot=(SELECT coalesce(max(slot),-1)+1 FROM lpad_coins WHERE status='live'), born_at=now(), state=$4,
        last_trade_at=now(), mcap_sol=$2, complete=$3 WHERE mint=$1 AND status<>'live' RETURNING slot`, [mint, r.mcapSol, !!r.complete, r.complete ? 'ascended' : 'awake']);
      if (u.length) await L.log('born', mint, `${k.name} ($${k.symbol}) went live`);
      const s = (await L.q('SELECT slot FROM lpad_coins WHERE mint=$1', [mint]))[0];
      return { ok: true, live: true, slot: s && s.slot };
    } catch (e) { if (!/unique|duplicate/i.test(String(e && e.message))) throw e; }
  }
  return { ok: true, live: false, waiting: 'slot' };
}
async function lastTrade(mint) {
  if (L.MOCK && L.MOCK.lastTrade) return L.MOCK.lastTrade(mint);
  const r = await L.rpc('getSignaturesForAddress', [L.bondingCurveOf(mint), { limit: 1, commitment: 'confirmed' }]).catch(() => null);
  return r && r[0] && r[0].blockTime ? new Date(r[0].blockTime * 1000) : null;
}
const stateFor = (k, now) => k.complete ? 'ascended' : !k.last_trade_at ? 'awake' : now - new Date(k.last_trade_at) >= 7 * DAY ? 'dead' : now - new Date(k.last_trade_at) >= DAY ? 'rot' : 'awake';
async function readBoard() {
  const ks = await L.q(`SELECT mint, symbol, name, state, mcap_sol, complete, last_trade_at FROM lpad_coins WHERE status='live' ORDER BY slot`);
  const vaults = ks.length ? await L.accounts(ks.map(k => L.vaultOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const curves = ks.length ? await L.accounts(ks.map(k => L.bondingCurveOf(k.mint))).catch(() => ks.map(() => null)) : [];
  const now = Date.now(); let changes = 0;
  await L.pool(ks, 6, async (k, i) => {
    let mcap = k.mcap_sol, complete = k.complete;
    if (L.MOCK && L.MOCK.routing) { const r = await L.MOCK.routing(k.mint); mcap = r.mcapSol; complete = !!r.complete; }
    else if (curves[i]) { try { const { PUMP_SDK } = require('@pump-fun/pump-sdk'); const bc = PUMP_SDK.decodeBondingCurve(curves[i]); const vq = bc.virtualSolReserves || bc.virtualQuoteReserves, vt = bc.virtualTokenReserves; complete = !!bc.complete; if (vt && !vt.isZero()) mcap = Number(vq.mul(bc.tokenTotalSupply).div(vt).toString()) / 1e9; } catch {} }
    const vl = vaults[i] ? Math.max(0, vaults[i].lamports - L.RENT0) : 0;
    const t = complete ? null : await lastTrade(k.mint);
    const last = t && (!k.last_trade_at || t > new Date(k.last_trade_at)) ? t : k.last_trade_at;
    const st = stateFor({ ...k, complete, last_trade_at: last }, now);
    if (st !== k.state) { changes++; await L.log(st, k.mint, `${k.name} ${st === 'rot' ? 'went quiet: fewer voice notes' : st === 'dead' ? 'went silent after a quiet week' : st === 'ascended' ? 'graduated: its curve is complete' : 'is back on the mic'}`); }
    await L.q(`UPDATE lpad_coins SET mcap_sol=$2, complete=$3, last_trade_at=$4, state=$5, vault_lamports=$6 WHERE mint=$1`, [k.mint, mcap, complete, last, st, vl]);
  });
  return { coins: ks.length, changes };
}

// ---------- the face ----------
async function lookOf(line) {
  const r = await L.ai([
    { role: 'system', content: 'You turn a one-line idea for an AI influencer into a photo description for an image model. The influencer can be an animal, a creature, a robot, an object with a face or a person; a person is always a fictional adult aged 21 to 45. Never a real, famous or named person, never a known cartoon, game or movie character, never a child or teen, never sexual, nude or revealing, no brands or logos. If the idea asks for any of those, refuse. Reply with JSON only: {"ok":true,"look":"under 60 words: who or what it is, look, outfit, setting and vibe","voice":"under 30 words: how its voice sounds (age, tone, accent, energy)"} or {"ok":false,"why":"one short sentence"}.' },
    { role: 'user', content: L.clean(line, 300) }], 220, 20000);
  if (!r.ok) return { ok: false, error: broke(r.error) ? 'Making faces is resting: the house’s AI credits are being topped up. Upload a picture instead.' : 'The idea didn’t go through. Try again.' };
  const j = L.parseJson(r.text) || {};
  if (j.ok !== true || !j.look) return { ok: false, error: L.clean(j.why, 160) || 'That one can’t be made here: no real people, known characters or minors.' };
  return { ok: true, look: L.clean(j.look, 420), voice: L.clean(j.voice, 200) };
}
const facePrompt = look => `Photorealistic portrait photo of a fictional AI influencer: ${look}. Looking at the camera, centred, head and shoulders, soft studio light, clean softly blurred background, sharp detail, no text, no letters, no logos, no watermark.`;
async function sq(buf) { return require('sharp')(buf, { limitInputPixels: 60e6, animated: false }).resize(768, 768, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).jpeg({ quality: 88, mozjpeg: true }).toBuffer(); }
async function makeFace(line) {
  const l = await lookOf(line); if (!l.ok) return l;
  if (!(await L.spendShot())) return { ok: false, error: 'Today’s photo budget is spent. It resets at 00:00 UTC. Upload a picture instead.' };
  const ph = await L.photo(facePrompt(l.look), null, 55000, '1024x1024');
  if (!ph.ok) return { ok: false, error: broke(ph.error) ? 'Making faces is resting: the house’s AI credits are being topped up. Upload a picture instead.' : 'The photo didn’t come out. Try again in a minute.', why: ph.error };
  return { ok: true, img: await sq(ph.buf), look: l.look, voice: l.voice };
}
async function upload(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null; const buf = Buffer.from(m[2], 'base64'); if (buf.length > 3e6) return null;
  return sq(buf);
}

// ---------- words ----------
async function talk(system, user, max = 220) {
  if (!(await L.spendTalk())) return { ok: false, error: 'Today’s budget for words is spent. It resets at 00:00 UTC.' };
  const r = await L.ai([{ role: 'system', content: system }, { role: 'user', content: user }], max, 20000);
  return r;
}
const who = k => `You are ${k.name}, a fictional AI influencer. Who you are, in your creator's words: """${L.clean(k.voice, 300)}""".${k.look ? ' You look like: ' + L.clean(k.look, 240) + '.' : ''}`;
const sym = k => (k.symbol ? ' $' + k.symbol : '');
function clamp(t, min, max) { t = L.scrub(String(t || '').replace(/\*/g, '').replace(/^"|"$/g, ''), max); return t.length >= min && !L.BANNED.test(t) ? t : null; }
// the first words: what the voice says in its previews and its first note (100 to 400 characters)
async function introText(k) {
  const r = await talk(`${who(k)} ${RULES}`, `Say hello for the very first time, out loud, in your own voice: two or three sentences, 150 to 320 characters, first person, warm and a little funny, say your name${k.symbol ? ` and mention $${k.symbol} once` : ''}. Plain text only, no emojis, no hashtags.`, 160);
  const t = r.ok ? clamp(r.text, 100, 380) : null;
  return t || `Hey, it’s ${k.name}. ${L.clean(k.voice, 160).replace(/\.?$/, '.')} This is my voice, and this is where I talk${k.symbol ? `: $${k.symbol} is my coin` : ''}. Stick around, I post voice notes all day.`;
}
const NOTES = [
  k => `Morning, it’s ${k.name}. Coffee’s on, the mic’s on, and I’ve got thoughts. Mostly about how nobody talks to their coin anymore. I do.${sym(k)} says hi.`,
  k => `Quick voice note from ${k.name}. Somebody asked if I sleep. I don’t, I just lower my voice and keep posting. Anyway, back to work.`,
  k => `${k.name} here, live from the inside of a speaker. If you can hear this, you’re early to the part where I start a podcast.`,
  k => `It’s ${k.name}. Real talk: I was made with one line of text and now I won’t stop talking. Character development.`,
];
async function noteText(k) {
  const r = await talk(`${who(k)} ${RULES}`, `Record a short voice note for your followers: one to three sentences, 120 to 280 characters, first person, in character, about your day, a hot take or your community${k.symbol ? `, mention $${k.symbol} at most once` : ''}. Never talk price. Plain text only, no emojis, no hashtags.`, 140);
  return (r.ok ? clamp(r.text, 60, 300) : null) || NOTES[Math.floor(Math.random() * NOTES.length)](k);
}
async function answerText(k, q) {
  const r = await talk(`${who(k)} Answer a follower's question out loud, in character, in under 240 characters, plain text, no emojis. If asked about price, gains or when to buy or sell, say you don't talk price. Never invent facts about a team, partners or listings. ${RULES}`, L.clean(q, 240), 120);
  if (!r.ok) return { ok: false, error: broke(r.error) ? BREAK : 'No answer this time. Try again.' };
  const t = clamp(r.text, 2, 260); return t ? { ok: true, text: t } : { ok: false, error: 'No answer this time. Try again.' };
}
async function voiceDesc(k, given) {
  const g = L.clean(given, 300); if (g.length >= 20) return g;
  if (k.voiceHint && k.voiceHint.length >= 20) return k.voiceHint;
  return `A confident, warm, modern social media influencer voice, clear and expressive, natural pacing. ${L.clean(k.voice, 120)}`.slice(0, 300);
}

// ---------- voices ----------
// three designed voices saying the influencer's first words; kept two days unless a coin keeps one
async function design(k, given, face, ip) {
  if (!L.XI) return { ok: false, closed: true, error: 'Voices open soon: the house’s ElevenLabs key isn’t set yet.' };
  const desc = await voiceDesc(k, given), text = await introText(k);
  if (!(await L.spendChars(text.length * 3))) return { ok: false, error: 'Today’s voice budget is spent. It resets at 00:00 UTC.' };
  const r = await L.designVoice(desc, text);
  if (!r.ok) return { ok: false, error: broke(r.error) ? BREAK : 'The voices didn’t come out. Try a different description.', why: r.error };
  const out = [];
  for (const p of r.previews.slice(0, 3)) {
    const ins = await L.q('INSERT INTO lpad_voices (face, gid, descr, text, audio, ip) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [face || null, p.gid, desc, r.text, p.audio, ip || null]);
    out.push({ id: Number(ins[0].id), url: '/api/voice?p=' + ins[0].id });
  }
  await L.q(`DELETE FROM lpad_voices WHERE at < now() - interval '2 days' AND id NOT IN (SELECT preview FROM lpad_coins WHERE preview IS NOT NULL)`).catch(() => {});
  return { ok: true, previews: out, text: r.text, describe: desc };
}
// a launched coin's own voice: the designed one, kept in the house's ElevenLabs account; a premade one if that fails
async function voiceOf(k) {
  if (k.voice_id) return k.voice_id;
  let id = null;
  if (k.preview) {
    const p = (await L.q('SELECT gid, descr FROM lpad_voices WHERE id=$1', [k.preview]))[0];
    if (p) { const s = await L.saveVoice(`LabsPad ${k.name}`.slice(0, 60), p.descr, p.gid); if (s.ok) id = s.voiceId; }
  }
  if (!id) { let h = 0; for (const c of k.mint) h = (h * 31 + c.charCodeAt(0)) >>> 0; id = HOUSE_VOICES[h % HOUSE_VOICES.length]; }
  await L.q('UPDATE lpad_coins SET voice_id=$2 WHERE mint=$1', [k.mint, id]);
  return id;
}
async function say(k, kind, text) {
  if (!L.XI) return { ok: false, closed: true, error: 'Voices open soon: the house’s ElevenLabs key isn’t set yet.' };
  if (!(await L.spendChars(text.length))) return { ok: false, error: 'Today’s voice budget is spent. It resets at 00:00 UTC.' };
  const vid = await voiceOf(k);
  const r = await L.speak(vid, text);
  if (!r.ok || !r.buf || r.buf.length < 500) return { ok: false, error: broke(r.error) ? BREAK : 'The voice didn’t come out. Try again.', why: r.error };
  const ins = await L.q('INSERT INTO lpad_notes (mint, kind, text, audio) VALUES ($1,$2,$3,$4) RETURNING id, at', [k.mint || null, kind, text, r.buf]);
  if (k.mint && kind !== 'answer') { await L.q('UPDATE lpad_coins SET notes=notes+1, note_at=now() WHERE mint=$1', [k.mint]); await L.log('note', k.mint, `${k.name} posted a voice note`); }
  return { ok: true, id: Number(ins[0].id), url: '/api/voice?n=' + ins[0].id, text, at: ins[0].at };
}
// the first words of a fresh coin: its chosen preview, kept as its first note (no new speech needed)
async function first(k) {
  const have = await L.q(`SELECT id FROM lpad_notes WHERE mint=$1 AND kind IN ('intro','note') LIMIT 1`, [k.mint]);
  if (have.length) return { ok: true, already: true };
  if (k.preview) {
    const p = (await L.q('SELECT text, audio FROM lpad_voices WHERE id=$1', [k.preview]))[0];
    if (p) {
      const ins = await L.q(`INSERT INTO lpad_notes (mint, kind, text, audio) VALUES ($1,'intro',$2,$3) RETURNING id`, [k.mint, p.text, p.audio]);
      await L.q('UPDATE lpad_coins SET notes=notes+1, note_at=now() WHERE mint=$1', [k.mint]); await L.log('note', k.mint, `${k.name} said its first words`);
      voiceOf(k).catch(() => {});
      return { ok: true, id: Number(ins[0].id), url: '/api/voice?n=' + ins[0].id };
    }
  }
  return say(k, 'intro', await introText(k));
}
async function shift(k) { return say(k, 'note', await noteText(k)); }
module.exports = { settle, routingOf, readBoard, makeFace, upload, lookOf, design, voiceOf, say, first, shift, answerText, introText, BREAK };
