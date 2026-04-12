import { sql } from './_lib/db.js';

// Helper: Check anomaly
const checkAnomaly = (volume, initialVolume, flowRate) => {
  if (!initialVolume || initialVolume === 0) return null;
  const percent = (volume / initialVolume) * 100;
  if (percent < 5) return 'EMPTY';
  if (flowRate > 5) return 'FAST_DRAIN';
  if (percent < 30 || (percent < 50 && volume < 50)) return 'LOW';
  return null;
};

// Main handler - Single Serverless Function
export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ========== HEALTH ==========
    if (path === '/api/health') {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // ========== BAGS ==========
    if (path === '/api/bags') {
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE b.status != 'completed'
        ORDER BY b.updated_at DESC
      `;
      return res.json(bags);
    }
    
    if (path === '/api/bags/all') {
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        ORDER BY b.updated_at DESC
      `;
      return res.json(bags);
    }

    if (path === '/api/bags' && method === 'POST') {
      const { patientId, esp32Id, type, initialVolume, flowRate } = req.body;
      const id = `b${Date.now()}`;
      await sql`
        INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, status)
        VALUES (${id}, ${patientId}, ${esp32Id || null}, ${type}, ${initialVolume}, ${initialVolume}, ${flowRate}, 'running')
      `;
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      return res.status(201).json(bag);
    }

    // GET /api/bags/:id
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[3];
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      return res.json(bag || { error: 'Not found' });
    }

    // PUT /api/bags/:id
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'PUT') {
      const id = path.split('/')[3];
      const { current_volume, flow_rate, status } = req.body;
      await sql`
        UPDATE iv_bags SET current_volume = ${current_volume}, flow_rate = ${flow_rate}, status = ${status} 
        WHERE id = ${id}
      `;
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      return res.json(bag);
    }

    // DELETE /api/bags/:id
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      await sql`DELETE FROM iv_bags WHERE id = ${id}`;
      return res.json({ success: true });
    }

    // GET /api/bags/:id/history
    if (path.match(/^\/api\/bags\/[^/]+\/history$/) && method === 'GET') {
      const id = path.split('/')[3];
      const logs = await sql`
        SELECT * FROM bag_logs WHERE bag_id = ${id} ORDER BY time DESC LIMIT 100
      `;
      return res.json(logs);
    }

    // ========== PATIENTS ==========
    if (path === '/api/patients' && method === 'GET') {
      const patients = await sql`SELECT * FROM patients ORDER BY name`;
      return res.json(patients);
    }

    if (path === '/api/patients' && method === 'POST') {
      const { id, name, room, bed, age, condition } = req.body;
      const patientId = id || `p${Date.now()}`;
      await sql`
        INSERT INTO patients (id, name, room, bed, age, condition)
        VALUES (${patientId}, ${name}, ${room}, ${bed}, ${age}, ${condition})
      `;
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${patientId}`;
      return res.status(201).json(patient);
    }

    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[3];
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${id}`;
      return res.json(patient || { error: 'Not found' });
    }

    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'PUT') {
      const id = path.split('/')[3];
      const { name, room, bed, age, condition } = req.body;
      await sql`
        UPDATE patients SET name = ${name}, room = ${room}, bed = ${bed}, age = ${age}, condition = ${condition}
        WHERE id = ${id}
      `;
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${id}`;
      return res.json(patient);
    }

    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      await sql`DELETE FROM patients WHERE id = ${id}`;
      return res.json({ success: true });
    }

    // ========== ESP32 ==========
    if (path === '/api/esp32' && method === 'GET') {
      const devices = await sql`SELECT * FROM esp32_devices ORDER BY last_seen_at DESC`;
      return res.json(devices);
    }

    if (path === '/api/esp32/register' && method === 'POST') {
      const id = req.body.esp32_id || req.body.id;
      if (!id) return res.status(400).json({ error: 'esp32_id required' });
      
      await sql`
        INSERT INTO esp32_devices (id, last_seen_at, status)
        VALUES (${id}, NOW(), 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
      `;
      const [device] = await sql`SELECT * FROM esp32_devices WHERE id = ${id}`;
      return res.status(201).json(device);
    }

    if (path === '/api/esp32/update' && method === 'POST') {
      const { esp32_id, volume, flow_rate } = req.body;
      
      // Auto register ESP32
      await sql`
        INSERT INTO esp32_devices (id, status)
        VALUES (${esp32_id}, 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
      `;

      // Find running bag
      const bags = await sql`
        SELECT * FROM iv_bags WHERE esp32_id = ${esp32_id} AND status IN ('running', 'empty') LIMIT 1
      `;

      if (bags.length === 0) {
        return res.status(404).json({ error: 'No running bag found' });
      }

      const bag = bags[0];
      let status = 'running';
      let emptyTimestamp = null;
      let anomaly = null;

      // Check anomaly
      if (volume <= 0) {
        status = 'empty';
        emptyTimestamp = new Date().toISOString();
      } else if (volume > 0 && bag.initial_volume > 0) {
        const expectedReduction = (bag.flow_rate / 20 / 60) * 5;
        const actualReduction = bag.current_volume - volume;
        if (actualReduction > expectedReduction * 3 && actualReduction > 10) {
          anomaly = { type: 'FAST_DRAIN', message: 'Volume giảm nhanh' };
        }
      }

      // Update bag
      await sql`
        UPDATE iv_bags SET current_volume = ${volume}, flow_rate = ${flow_rate}, status = ${status}, empty_timestamp = ${emptyTimestamp}
        WHERE esp32_id = ${esp32_id} AND status IN ('running', 'empty')
      `;

      // Log
      await sql`
        INSERT INTO bag_logs (bag_id, volume, flow_rate) VALUES (${bag.id}, ${volume}, ${flow_rate})
      `;

      const [updatedBag] = await sql`SELECT * FROM iv_bags WHERE id = ${bag.id}`;
      return res.json({ success: true, bag: updatedBag, anomaly });
    }

    // ========== MACHINES ==========
    if (path === '/api/machines/reported' && method === 'GET') {
      const machines = await sql`
        SELECT * FROM reported_machines WHERE status = 'pending' ORDER BY reported_at DESC
      `;
      return res.json(machines);
    }

    if (path === '/api/machines/report' && method === 'POST') {
      const { esp32_id, room_bed } = req.body;
      await sql`
        INSERT INTO reported_machines (esp32_id, room_bed) VALUES (${esp32_id}, ${room_bed})
      `;
      return res.status(201).json({ success: true });
    }

    if (path.match(/^\/api\/machines\/[^/]+\/resolve$/) && method === 'PUT') {
      const esp32Id = path.split('/')[3];
      await sql`
        UPDATE reported_machines SET status = 'resolved', resolved_at = NOW()
        WHERE esp32_id = ${esp32Id}
      `;
      return res.json({ success: true });
    }

    // 404
    return res.status(404).json({ error: 'Not found', path });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
}