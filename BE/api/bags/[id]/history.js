import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;
    const limit = parseInt(req.query.limit) || 500;
    
    const logs = await sql`
      SELECT time, volume, flow_rate
      FROM bag_logs
      WHERE bag_id = ${id}
      ORDER BY time ASC
      LIMIT ${limit}
    `;

    res.json(logs);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}