import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function isValidCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(code);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const code = (req.query && req.query.code) || '';
  if (!isValidCode(code)) {
    return res.status(400).json({ error: 'invalid or missing sync code' });
  }
  const key = `zk-roadmap:${code}`;

  try {
    if (req.method === 'GET') {
      const data = await redis.get(key);
      return res.status(200).json({ data: data ?? null });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body || typeof body !== 'object' || !('data' in body)) {
        return res.status(400).json({ error: 'missing data payload' });
      }
      // 1 year TTL so stale codes eventually clean up
      await redis.set(key, body.data, { ex: 60 * 60 * 24 * 365 });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'sync backend error' });
  }
}
