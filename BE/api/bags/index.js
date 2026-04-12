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
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        JOIN patients p ON b.patient_id = p.id
        WHERE b.status != 'completed'
        ORDER BY b.start_time DESC
      `;
      return res.json(bags);
    }

    if (req.method === 'POST') {
      const { patientId, esp32Id, type, initialVolume, flowRate } = req.body;

      if (!patientId || !type || !initialVolume || !flowRate) {
        return res.status(400).json({ error: 'patientId, type, initialVolume, flowRate are required' });
      }

      const id = `b${Date.now()}`;
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

      await sql`
        INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, start_time, status)
        VALUES (${id}, ${patientId}, ${esp32Id || null}, ${type}, ${initialVolume}, ${initialVolume}, ${flowRate}, ${now}, 'running')
      `;

      const bags = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      res.status(201).json(bags[0]);
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}