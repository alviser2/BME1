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
      const patients = await sql`SELECT * FROM patients ORDER BY created_at DESC`;
      return res.json(patients);
    }

    if (req.method === 'POST') {
      const { name, room, bed, age, condition } = req.body;
      
      if (!name || !room || !bed) {
        return res.status(400).json({ error: 'name, room, bed are required' });
      }

      const id = `p${Date.now()}`;
      await sql`
        INSERT INTO patients (id, name, room, bed, age, condition, created_at)
        VALUES (${id}, ${name}, ${room}, ${bed}, ${age || null}, ${condition || null}, NOW())
      `;

      const patients = await sql`SELECT * FROM patients WHERE id = ${id}`;
      res.status(201).json(patients[0]);
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}