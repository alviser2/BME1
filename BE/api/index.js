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
    
    // POST /api/bags - Tạo bag mới
    if (path === '/api/bags' && method === 'POST') {
      const { patientId, esp32Id, type, initialVolume, currentVolume, flowRate } = req.body;
      const id = `b${Date.now()}`;
      await sql`
        INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, status)
        VALUES (${id}, ${patientId}, ${esp32Id || null}, ${type}, ${initialVolume}, ${currentVolume || initialVolume}, ${flowRate}, 'running')
      `;
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      // Log initial
      await sql`INSERT INTO bag_logs (bag_id, volume, flow_rate) VALUES (${id}, ${initialVolume}, ${flowRate})`;
      return res.status(201).json(bag);
    }
    
    // GET /api/bags - Lấy bags đang chạy (không completed)
    if (path === '/api/bags' && method === 'GET') {
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE b.status != 'completed'
        ORDER BY b.updated_at DESC
      `;
      return res.json(bags);
    }
    
    // GET /api/bags/all - Lấy tất cả bags
    if (path === '/api/bags/all' && method === 'GET') {
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        ORDER BY b.updated_at DESC
      `;
      return res.json(bags);
    }

    // GET /api/bags/:id - Lấy 1 bag
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[3];
      const [bag] = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE b.id = ${id}
      `;
      return res.json(bag || { error: 'Not found' });
    }

    // PUT /api/bags/:id - Update bag (volume, flow_rate, etc)
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'PUT' && !path.endsWith('/status')) {
      const id = path.split('/')[3];
      const body = req.body || {};
      
      // Build update query manually
      const updates = [];
      if (body.current_volume !== undefined) updates.push(`current_volume = ${body.current_volume}`);
      if (body.flow_rate !== undefined) updates.push(`flow_rate = ${body.flow_rate}`);
      if (body.status !== undefined) updates.push(`status = '${body.status}'`);
      if (body.anomaly !== undefined) updates.push(`anomaly = '${body.anomaly}'`);
      
      if (updates.length > 0) {
        await sql`UPDATE iv_bags SET ${sql.unsafe(updates.join(', '))} WHERE id = ${id}`;
      }
      
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      return res.json(bag);
    }

    // PUT /api/bags/:id/status - Thay đổi status bag (running, completed, etc)
    if (path.match(/^\/api\/bags\/[^/]+\/status$/) && method === 'PUT') {
      const id = path.split('/')[3];
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }
      
      await sql`UPDATE iv_bags SET status = ${status}, updated_at = NOW() WHERE id = ${id}`;
      const [bag] = await sql`SELECT * FROM iv_bags WHERE id = ${id}`;
      return res.json(bag);
    }

    // DELETE /api/bags/:id - Xóa bag
    if (path.match(/^\/api\/bags\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      await sql`DELETE FROM iv_bags WHERE id = ${id}`;
      return res.json({ success: true });
    }

    // GET /api/bags/:id/history - Lấy lịch sử bag
    if (path.match(/^\/api\/bags\/[^/]+\/history$/) && method === 'GET') {
      const id = path.split('/')[3];
      const logs = await sql`SELECT * FROM bag_logs WHERE bag_id = ${id} ORDER BY id DESC LIMIT 100`;
      return res.json(logs);
    }
    
    // POST /api/bags/:id/history - Thêm log entry cho bag
    if (path.match(/^\/api\/bags\/[^/]+\/history$/) && method === 'POST') {
      const id = path.split('/')[3];
      const { volume, flow_rate } = req.body;
      await sql`INSERT INTO bag_logs (bag_id, volume, flow_rate) VALUES (${id}, ${volume}, ${flow_rate})`;
      const logs = await sql`SELECT * FROM bag_logs WHERE bag_id = ${id} ORDER BY id DESC LIMIT 100`;
      return res.status(201).json(logs);
    }

    // ========== PATIENTS ==========
    
    // GET /api/patients - Lấy tất cả bệnh nhân
    if (path === '/api/patients' && method === 'GET') {
      const patients = await sql`SELECT * FROM patients ORDER BY name`;
      return res.json(patients);
    }

    // POST /api/patients - Tạo bệnh nhân mới
    if (path === '/api/patients' && method === 'POST') {
      const { id, name, room, bed, age, condition } = req.body;
      const patientId = id || `p${Date.now()}`;
      await sql`
        INSERT INTO patients (id, name, room, bed, age, condition)
        VALUES (${patientId}, ${name}, ${room || ''}, ${bed || ''}, ${age || null}, ${condition || ''})
      `;
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${patientId}`;
      return res.status(201).json(patient);
    }

    // GET /api/patients/:id - Lấy 1 bệnh nhân
    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[3];
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${id}`;
      return res.json(patient || { error: 'Not found' });
    }

    // PUT /api/patients/:id - Update bệnh nhân
    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'PUT') {
      const id = path.split('/')[3];
      const { name, room, bed, age, condition } = req.body;
      await sql`
        UPDATE patients SET 
          name = ${name || ''}, 
          room = ${room || ''}, 
          bed = ${bed || ''}, 
          age = ${age || null}, 
          condition = ${condition || ''},
          updated_at = NOW()
        WHERE id = ${id}
      `;
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${id}`;
      return res.json(patient);
    }

    // DELETE /api/patients/:id - Xóa bệnh nhân
    if (path.match(/^\/api\/patients\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[3];
      await sql`DELETE FROM patients WHERE id = ${id}`;
      return res.json({ success: true });
    }

    // ========== ESP32 ==========
    
    // GET /api/esp32 - Lấy tất cả thiết bị
    if (path === '/api/esp32' && method === 'GET') {
      const devices = await sql`SELECT * FROM esp32_devices ORDER BY last_seen_at DESC`;
      return res.json(devices);
    }

    // POST /api/esp32/register - Đăng ký thiết bị mới
    if (path === '/api/esp32/register' && method === 'POST') {
      const id = req.body.esp32_id || req.body.id;
      if (!id) return res.status(400).json({ error: 'esp32_id required' });
      
      await sql`
        INSERT INTO esp32_devices (id, registered_at, last_seen_at, status)
        VALUES (${id}, NOW(), NOW(), 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
      `;
      const [device] = await sql`SELECT * FROM esp32_devices WHERE id = ${id}`;
      return res.status(201).json(device);
    }

    // GET /api/esp32/:id/bags - Lấy bags của 1 thiết bị
    if (path.match(/^\/api\/esp32\/[^/]+\/bags$/) && method === 'GET') {
      const esp32Id = path.split('/')[3];
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE b.esp32_id = ${esp32Id}
        ORDER BY b.start_time DESC
      `;
      return res.json(bags);
    }

    // POST /api/esp32/update - ESP32 gửi data cập nhật
    if (path === '/api/esp32/update' && method === 'POST') {
      const { esp32_id, volume, flow_rate } = req.body;
      
      if (!esp32_id) {
        return res.status(400).json({ error: 'esp32_id required' });
      }
      
      // Auto register ESP32
      await sql`
        INSERT INTO esp32_devices (id, status)
        VALUES (${esp32_id}, 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
      `;

      // Find active bag
      const bags = await sql`
        SELECT * FROM iv_bags WHERE esp32_id = ${esp32_id} AND status IN ('running', 'empty') LIMIT 1
      `;

      if (bags.length === 0) {
        return res.json({ success: false, message: 'No active bag found' });
      }

      const bag = bags[0];
      let status = 'running';
      let emptyTimestamp = bag.empty_timestamp;
      let anomaly = null;

      // Check anomaly
      if (volume <= 0) {
        status = 'empty';
        emptyTimestamp = new Date().toISOString();
      } else if (volume > 0 && bag.initial_volume > 0) {
        const expectedReduction = (parseFloat(bag.flow_rate) / 20 / 60) * 5;
        const actualReduction = parseFloat(bag.current_volume) - volume;
        if (actualReduction > expectedReduction * 3 && actualReduction > 10) {
          anomaly = 'FAST_DRAIN';
        }
      }

      // Update bag
      await sql`
        UPDATE iv_bags SET 
          current_volume = ${volume}, 
          flow_rate = ${flow_rate}, 
          status = ${status}, 
          empty_timestamp = ${emptyTimestamp},
          anomaly = ${anomaly},
          updated_at = NOW()
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
    
    // GET /api/machines/reported - Lấy máy báo lỗi
    if (path === '/api/machines/reported' && method === 'GET') {
      const machines = await sql`
        SELECT * FROM reported_machines WHERE status = 'pending' ORDER BY reported_at DESC
      `;
      return res.json(machines);
    }

    // POST /api/machines/report - Báo lỗi máy
    if (path === '/api/machines/report' && method === 'POST') {
      const { esp32_id, room_bed } = req.body;
      await sql`
        INSERT INTO reported_machines (esp32_id, room_bed) VALUES (${esp32_id}, ${room_bed || ''})
      `;
      return res.status(201).json({ success: true });
    }

    // PUT /api/machines/:esp32Id/resolve - Resolve máy
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