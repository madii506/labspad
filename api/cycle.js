// GET /api/cycle  one cycle of LabsPad, run by a schedule (safe for anyone to call: it locks, and runs at most once per
// 25 minutes). It finishes launches the page didn't see through, voids ones that never landed, reads every coin from the
// chain, and records the next voice note for every influencer that's due: one every six hours while its coin trades,
// every twelve once it's quiet for a day, none after a quiet week.
const L = require('./_lib');
const B = require('./_labs');
const PER_CYCLE = 4;
module.exports = async (req, res) => {
  L.setOidc(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'records offline' });
  try {
    await L.ready();
    const got = await L.q(`UPDATE lpad_state SET lock_at=now() WHERE id=1 AND (lock_at IS NULL OR lock_at < now() - interval '3 minutes') AND next_at <= now() RETURNING cycle`);
    if (!got.length) return L.send(res, 200, { ok: true, skipped: true });
    const cycle = got[0].cycle + 1, out = { ok: true, cycle, settled: 0, voided: 0, notes: 0 };
    try {
      for (const p of await L.q(`SELECT mint FROM lpad_coins WHERE status='pending' AND created_at > now() - interval '3 hours'`)) { const r = await B.settle(p.mint).catch(() => null); if (r && r.live) out.settled++; }
      const v = await L.q(`UPDATE lpad_coins SET status='void', img=NULL WHERE status='pending' AND created_at <= now() - interval '3 hours' RETURNING mint`); out.voided = v.length;
      const r = await B.readBoard(); out.coins = r.coins; out.changes = r.changes;
      const due = await L.q(`SELECT mint, name, symbol, voice, look, voice_id, preview, notes FROM lpad_coins WHERE status='live' AND (
          (state IN ('awake','ascended') AND (note_at IS NULL OR note_at < now() - interval '6 hours')) OR
          (state = 'rot' AND (note_at IS NULL OR note_at < now() - interval '12 hours')))
        ORDER BY note_at NULLS FIRST LIMIT ${PER_CYCLE}`);
      await L.pool(due, 2, async k => { const s = k.notes ? await B.shift(k) : await B.first(k); if (s.ok) out.notes++; else out.why = s.why || s.error; });
      await L.q(`DELETE FROM lpad_notes WHERE kind='answer' AND at < now() - interval '2 days'`).catch(() => {});
    } finally {
      await L.q(`UPDATE lpad_state SET cycle=$1, lock_at=NULL, next_at=now() + interval '25 minutes' WHERE id=1`, [cycle]);
    }
    L.send(res, 200, out);
  } catch (e) { L.send(res, 200, { ok: false, error: String(e && e.message || e).slice(0, 200) }); }
};
