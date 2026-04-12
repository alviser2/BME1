import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      const patients = await sql`SELECT * FROM patients WHERE id = ${id}`;
      if (patients.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      return res.json(patients[0]);
    }

    if (req.method === 'PUT') {
      const { name, room, bed, age, condition } = req.body;
      const updates = [];
      const values = [];

      if (name !== undefined) { updates.push('name = $' + (values.length + 1)); values.push(name); }
      if (room !== undefined) { updates.push('room = $' + (values.length + 1)); values.push(room); }
      if (bed !== undefined) { updates.push('bed = $' + (values.length + 1)); values.push(bed); }
      if (age !== undefined) { updates.push('age = $' + (values.length + 1)); values.push(age); }
      if (condition !== undefined) { updates.push('condition = $' + (values.length + 1)); values.push(condition); }
      updates.push('updated_at = NOW()');
      values.push(id);

      if (updates.length > 1) {
        await sql`UPDATE patients SET ${sql.unsafe(updates.join(', '))} WHERE id = ${id}`;
      }
      
      const patients = await sql`SELECT * FROM patients WHERE id = ${id}`;
      res.json(patients[0]);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM patients WHERE id = ${id}`;
      res.json({ message: 'Patient deleted' });
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}