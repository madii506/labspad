// GET /api/ping  is everything LabsPad needs answering? The database, the AI Gateway token, the house wallet, Higgsfield.
const L = require('./_lib');
module.exports = async (req, res) => {
  L.setOidc(req);
  const out = { ok: true, db: L.dbReady(), ai: !!L.gatewayToken(), open: !!L.STUDIO, xi: L.XI };
  if (out.db) { try { await L.ready(); const s = (await L.q('SELECT shots, shots_day, talk, talk_day, chars, chars_day FROM lpad_state WHERE id=1'))[0]; out.today = s; } catch (e) { out.db = false; out.why = String(e && e.message).slice(0, 120); } }
  L.send(res, 200, out);
};
