/* ===== /api/seed — GET / POST / DELETE SEED data via Upstash Redis ===== */
const { Redis } = require('@upstash/redis');

const KEY = 'ta:seed';

let _redis;
function getRedis() {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in Vercel env vars');
  _redis = new Redis({ url, token });
  return _redis;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = getRedis();

    if (req.method === 'GET') {
      const data = await r.get(KEY);
      if (data === null || data === undefined) return res.status(204).end();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Expected JSON body' });
      await r.set(KEY, body);
      return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
    }

    if (req.method === 'DELETE') {
      await r.del(KEY);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/seed]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
