import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const devices = await sql`SELECT * FROM esp32_devices ORDER BY registered_at DESC`;
      return res.json(devices);
    }

    if (req.method === 'POST') {
      const { esp32_id } = req.body;
      
      if (!esp32_id) {
        return res.status(400).json({ error: 'esp32_id is required' });
      }

      const existing = await sql`SELECT * FROM esp32_devices WHERE id = ${esp32_id}`;
      
      if (existing.length === 0) {
        await sql`
          INSERT INTO esp32_devices (id, registered_at, last_seen_at, status) 
          VALUES (${esp32_id}, NOW(), NOW(), 'online')
        `;
      } else {
        await sql`UPDATE esp32_devices SET last_seen_at = NOW(), status = 'online' WHERE id = ${esp32_id}`;
      }

      const devices = await sql`SELECT * FROM esp32_devices WHERE id = ${esp32_id}`;
      res.json(devices[0]);
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}