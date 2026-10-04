// GET /api/board  every influencer launched here (newest first) and the latest voice notes, read from LabsPad's records,
// which the cycle keeps in step with the chain.
const L = require('./_lib');
const COLS = `mint, slot, name, symbol, payer, born_at, state, mcap_sol, complete, last_trade_at, vault_lamports, notes, note_at`;
module.exports = async (req, res) => {
  const base = { open: !!L.STUDIO, studio: L.STUDIO || null, xi: L.XI };
  if (!L.dbReady()) return L.send(res, 200, { ok: true, offline: true, coins: [], notes: [], ...base });
  try {
    await L.ready();
    const [coins, notes, solUsd] = await Promise.all([
      L.q(`SELECT ${COLS} FROM lpad_coins WHERE status='live' ORDER BY slot DESC LIMIT 500`),
      L.q(`SELECT n.id, n.mint, n.kind, n.text, n.at, c.name, c.symbol FROM lpad_notes n JOIN lpad_coins c ON c.mint = n.mint WHERE n.kind IN ('intro','note') ORDER BY n.id DESC LIMIT 30`),
      L.solPrice().catch(() => null),
    ]);
    L.send(res, 200, { ok: true, coins, notes: notes.map(n => ({ ...n, url: '/api/voice?n=' + n.id })), solUsd, ...base }, L.CACHE(6, 60));
  } catch (e) { L.send(res, 200, { ok: false, error: 'LabsPad’s records didn’t answer.', ...base }); }
};
