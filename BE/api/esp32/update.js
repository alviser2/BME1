import { sql } from '../_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { esp32_id, volume, flow_rate } = req.body;

    if (!esp32_id || volume === undefined || flow_rate === undefined) {
      return res.status(400).json({ error: 'esp32_id, volume, flow_rate are required' });
    }

    // Auto register ESP32 nếu chưa có
    const existing = await sql`SELECT * FROM esp32_devices WHERE id = ${esp32_id}`;
    
    if (existing.length === 0) {
      await sql`
        INSERT INTO esp32_devices (id, registered_at, last_seen_at, status) 
        VALUES (${esp32_id}, NOW(), NOW(), 'online')
      `;
    } else {
      await sql`UPDATE esp32_devices SET last_seen_at = NOW(), status = 'online' WHERE id = ${esp32_id}`;
    }

    // Tìm bag đang chạy
    const bags = await sql`
      SELECT * FROM iv_bags 
      WHERE esp32_id = ${esp32_id} AND status IN ('running', 'empty') 
      LIMIT 1
    `;

    if (bags.length === 0) {
      return res.status(404).json({ error: 'Bag not found or not running', esp32_id });
    }

    const bag = bags[0];
    let status = 'running';
    let emptyTimestamp = null;
    let anomaly = null;

    // Kiểm tra bất thường
    if (volume > 0 && bag.initial_volume > 0) {
      const expectedReductionPerCheck = (bag.flow_rate / 20 / 60) * 5;
      const actualReduction = bag.current_volume - volume;

      if (actualReduction > expectedReductionPerCheck * 3 && actualReduction > 10) {
        anomaly = {
          type: 'FAST_DRAIN',
          message: `Volume giảm nhanh: giảm ${actualReduction.toFixed(1)}ml trong 5s`,
        };
      }
    }

    if (volume <= 0) {
      status = 'empty';
      emptyTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    // Cập nhật bag
    await sql`
      UPDATE iv_bags 
      SET current_volume = ${Math.max(0, volume)}, 
          flow_rate = ${flow_rate}, 
          status = ${status}, 
          empty_timestamp = ${emptyTimestamp}, 
          updated_at = NOW() 
      WHERE esp32_id = ${esp32_id} AND status IN ('running', 'empty')
    `;

    // Ghi log
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await sql`
      INSERT INTO bag_logs (bag_id, time, volume, flow_rate) 
      VALUES (${bag.id}, ${now}, ${Math.max(0, volume)}, ${flow_rate})
    `;

    const updatedBags = await sql`SELECT * FROM iv_bags WHERE id = ${bag.id}`;
    
    res.json({ success: true, bag: updatedBags[0], anomaly: anomaly || null });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}