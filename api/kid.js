// GET /api/kid?mint=  one influencer: its record (its one line is public), its voice notes and what happened to it.
const L = require('./_lib');
const COLS = `mint, slot, name, symbol, voice, xhandle, payer, shares, born_at, status, state, mcap_sol, complete, last_trade_at, vault_lamports, created_at, notes, note_at, (voice_id IS NOT NULL OR preview IS NOT NULL) AS has_voice`;
module.exports = async (req, res) => {
  const mint = String(L.query(req).mint || '').trim();
  if (!L.isAddr(mint)) return L.send(res, 200, { ok: false, error: 'That isn’t a token address.' });
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'LabsPad’s records are offline.' });
  try {
    await L.ready();
    const k = (await L.q(`SELECT ${COLS} FROM lpad_coins WHERE mint=$1`, [mint]))[0];
    if (!k || k.status === 'void') return L.send(res, 200, { ok: false, missing: true, error: 'No influencer lives at that address.' }, L.CACHE(10));
    const [notes, log] = await Promise.all([
      L.q(`SELECT id, kind, text, at FROM lpad_notes WHERE mint=$1 AND kind IN ('intro','note') ORDER BY id DESC LIMIT 60`, [mint]),
      L.q(`SELECT kind, text, at FROM lpad_log WHERE mint=$1 ORDER BY id DESC LIMIT 20`, [mint]),
    ]);
    L.send(res, 200, { ok: true, coin: k, notes: notes.map(n => ({ ...n, url: '/api/voice?n=' + n.id })), log, studio: L.STUDIO || null, xi: L.XI }, L.CACHE(5, 60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'LabsPad’s records didn’t answer.' }); }
};
