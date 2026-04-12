import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const machines = await sql`
        SELECT * FROM reported_machines WHERE status = 'pending' ORDER BY reported_at DESC
      `;
      return res.json(machines);
    }

    if (req.method === 'POST') {
      const { esp32_id, room_bed } = req.body;

      if (!esp32_id || !room_bed) {
        return res.status(400).json({ error: 'esp32_id and room_bed are required' });
      }

      await sql`
        INSERT INTO reported_machines (esp32_id, room_bed, reported_at, status) 
        VALUES (${esp32_id}, ${room_bed}, NOW(), 'pending')
      `;

      const machines = await sql`
        SELECT * FROM reported_machines WHERE esp32_id = ${esp32_id} ORDER BY id DESC LIMIT 1
      `;

      return res.status(201).json(machines[0]);
    }

    if (req.method === 'PUT') {
      const { esp32Id } = req.query;
      
      if (!esp32Id) {
        return res.status(400).json({ error: 'esp32Id is required' });
      }

      await sql`
        UPDATE reported_machines 
        SET status = 'resolved', resolved_at = NOW() 
        WHERE esp32_id = ${esp32Id} AND status = 'pending'
      `;

      res.json({ success: true, message: 'Machine resolved' });
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}