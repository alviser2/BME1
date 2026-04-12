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
      const bags = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      if (bags.length === 0) {
        return res.status(404).json({ error: 'Bag not found' });
      }
      return res.json(bags[0]);
    }

    if (req.method === 'PUT') {
      const { type, esp32Id, flowRate, status, currentVolume, emptyTimestamp } = req.body;
      const fields = [];
      const values = [];

      if (type !== undefined) fields.push({ key: 'type', value: type });
      if (esp32Id !== undefined) fields.push({ key: 'esp32_id', value: esp32Id || null });
      if (flowRate !== undefined) fields.push({ key: 'flow_rate', value: flowRate });
      if (status !== undefined) fields.push({ key: 'status', value: status });
      if (currentVolume !== undefined) fields.push({ key: 'current_volume', value: currentVolume });
      if (emptyTimestamp !== undefined) fields.push({ key: 'empty_timestamp', value: emptyTimestamp || null });

      if (fields.length > 0) {
        const setClause = fields.map((f, i) => `${f.key} = $${i + 1}`).join(', ');
        const valuesArr = fields.map(f => f.value);
        await sql`UPDATE iv_bags SET ${sql.unsafe(setClause)} WHERE id = ${id}`.catch(() => {
          // Try with param
        });
      }
      
      const bags = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      res.json(bags[0]);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM iv_bags WHERE id = ${id}`;
      res.json({ message: 'Bag deleted' });
    }
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}