import { sql } from '../../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Lấy tất cả bags kể cả completed
    const bags = await sql`
      SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
      FROM iv_bags b
      LEFT JOIN patients p ON b.patient_id = p.id
      ORDER BY b.start_time DESC
    `;
    return res.json(bags);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}