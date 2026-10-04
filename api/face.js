// POST /api/face {line}    make an AI influencer's face from one line (FLUX through Vercel's AI Gateway), screened first:
//                          never a real person, never a minor, nothing sexual. It also suggests how the voice sounds.
// POST /api/face {image}   or bring a picture of your own fictional character
// GET  /api/face?id=N      that face (JPEG). Kept two days unless a coin keeps it.
const L = require('./_lib');
const B = require('./_labs');
module.exports = async (req, res) => {
  L.setOidc(req);
  if (!L.dbReady()) return L.send(res, 200, { ok: false, error: 'LabsPad’s records are offline. Try again shortly.' });
  try {
    await L.ready();
    if (req.method === 'GET') {
      const id = String(L.query(req).id || '');
      const r = /^\d{1,12}$/.test(id) ? await L.q('SELECT img FROM lpad_faces WHERE id=$1', [id]) : [];
      if (!r.length) { res.statusCode = 404; return res.end(); }
      res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400, immutable'); return res.end(Buffer.from(r[0].img));
    }
    const b = await L.body(req, 4.2 * 1024 * 1024);
    if (b.tooBig) return L.send(res, 200, { ok: false, error: 'That picture is too big. Try a smaller one.' });
    await L.q(`DELETE FROM lpad_faces WHERE at < now() - interval '2 days'`).catch(() => {});
    if (b.image) {
      if (L.limited('up:' + L.ip(req), 20, 3600000)) return L.send(res, 200, { ok: false, error: 'Too many pictures from here. Try again soon.' });
      const img = await B.upload(b.image).catch(() => null);
      if (!img) return L.send(res, 200, { ok: false, error: 'That picture didn’t open (PNG, JPG, WebP or GIF, under 3 MB).' });
      const r = await L.q(`INSERT INTO lpad_faces (img, line, kind, ip) VALUES ($1,$2,'upload',$3) RETURNING id`, [img, L.clean(b.line, 300) || null, L.ip(req)]);
      return L.send(res, 200, { ok: true, face: Number(r[0].id), url: '/api/face?id=' + r[0].id });
    }
    const line = L.clean(b.line, 300);
    if (line.length < 8) return L.send(res, 200, { ok: false, error: 'Describe your influencer in one line first.' });
    if (L.limited('face:' + L.ip(req), 6, 3600000)) return L.send(res, 200, { ok: false, error: 'Six faces an hour from here. Try again soon.' });
    const f = await B.makeFace(line);
    if (!f.ok) return L.send(res, 200, f);
    const r = await L.q(`INSERT INTO lpad_faces (img, line, look, kind, ip) VALUES ($1,$2,$3,'ai',$4) RETURNING id`, [f.img, line, f.look, L.ip(req)]);
    L.send(res, 200, { ok: true, face: Number(r[0].id), url: '/api/face?id=' + r[0].id, voice: f.voice || null });
  } catch (e) { L.send(res, 200, { ok: false, error: 'It didn’t come out. Try again.', why: String(e && e.message).slice(0, 160) }); }
};
