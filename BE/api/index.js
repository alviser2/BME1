import { neon } from '@neondatabase/serverless';

// Database connection - Neon PostgreSQL
const sql = neon(process.env.DATABASE_URL || 'postgresql://user:pass@host/db');

// Anomaly detection helper
const checkAnomaly = (currentVolume, initialVolume, flowRate) => {
  if (!initialVolume || initialVolume === 0) return null;
  const percentRemaining = (currentVolume / initialVolume) * 100;
  
  if (percentRemaining < 5) return 'EMPTY';
  if (flowRate > 5) return 'FAST_DRAIN';
  if (percentRemaining < 30 || percentRemaining < 50 && currentVolume < 50) return 'LOW';
  return null;
};

export default async function handler(req, res) {
  const { pathname, query } = req;
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Route handling
    if (pathname === '/api/health' || pathname === '/health') {
      return res.json({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Bags endpoints
    if (pathname === '/api/bags' || pathname === '/api/bags/all') {
      const includeCompleted = pathname === '/api/bags/all';
      const whereClause = includeCompleted ? '' : "WHERE status != 'completed'";
      const bags = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed 
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        ${sql(whereClause ? whereClause : '')}
        ORDER BY b.updated_at DESC
      `;
      return res.json(bags);
    }
    
    // GET /api/bags/:id
    if (pathname.startsWith('/api/bags/') && pathname.endsWith('/history')) {
      const bagId = pathname.split('/')[3];
      const logs = await sql`
        SELECT * FROM bag_logs 
        WHERE bag_id = ${bagId}
        ORDER BY time DESC
        LIMIT 100
      `;
      return res.json(logs);
    }
    
    if (pathname.match(/^\/api\/bags\/[^/]+$/) && req.method === 'GET') {
      const bagId = pathname.split('/')[3];
      const [bag] = await sql`
        SELECT b.*, p.name as patient_name, p.room, p.bed 
        FROM iv_bags b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE b.id = ${bagId}
      `;
      return res.json(bag || { error: 'Not found' });
    }
    
    // POST /api/bags
    if (pathname === '/api/bags' && req.method === 'POST') {
      const { id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, status } = req.body;
      const anomaly = checkAnomaly(current_volume, initial_volume, flow_rate);
      
      const [bag] = await sql`
        INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, status, anomaly)
        VALUES (${id}, ${patient_id}, ${esp32_id}, ${type}, ${initial_volume}, ${current_volume}, ${flow_rate}, ${status || 'running'}, ${anomaly})
        RETURNING *
      `;
      return res.status(201).json(bag);
    }
    
    // PUT /api/bags/:id
    if (pathname.match(/^\/api\/bags\/[^/]+$/) && req.method === 'PUT') {
      const bagId = pathname.split('/')[3];
      const { current_volume, flow_rate, status, anomaly } = req.body;
      
      const [bag] = await sql`
        UPDATE iv_bags 
        SET current_volume = ${current_volume}, flow_rate = ${flow_rate}, status = ${status}, anomaly = ${anomaly}
        WHERE id = ${bagId}
        RETURNING *
      `;
      return res.json(bag);
    }
    
    // DELETE /api/bags/:id
    if (pathname.match(/^\/api\/bags\/[^/]+$/) && req.method === 'DELETE') {
      const bagId = pathname.split('/')[3];
      await sql`DELETE FROM iv_bags WHERE id = ${bagId}`;
      return res.json({ success: true });
    }
    
    // Patients endpoints
    if (pathname === '/api/patients') {
      const patients = await sql`SELECT * FROM patients ORDER BY name`;
      return res.json(patients);
    }
    
    if (pathname.match(/^\/api\/patients\/[^/]+$/) && req.method === 'GET') {
      const patientId = pathname.split('/')[3];
      const [patient] = await sql`SELECT * FROM patients WHERE id = ${patientId}`;
      return res.json(patient || { error: 'Not found' });
    }
    
    if (pathname === '/api/patients' && req.method === 'POST') {
      const { id, name, room, bed, age, condition } = req.body;
      const [patient] = await sql`
        INSERT INTO patients (id, name, room, bed, age, condition)
        VALUES (${id}, ${name}, ${room}, ${bed}, ${age}, ${condition})
        RETURNING *
      `;
      return res.status(201).json(patient);
    }
    
    // ESP32 endpoints
    if (pathname === '/api/esp32') {
      const devices = await sql`SELECT * FROM esp32_devices ORDER BY last_seen_at DESC`;
      return res.json(devices);
    }
    
    if (pathname === '/api/esp32/register' && req.method === 'POST') {
      const { id } = req.body;
      const [device] = await sql`
        INSERT INTO esp32_devices (id, status)
        VALUES (${id}, 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
        RETURNING *
      `;
      return res.status(201).json(device);
    }
    
    if (pathname === '/api/esp32/update' && req.method === 'POST') {
      const { esp32_id, volume, flow_rate } = req.body;
      
      // Auto-register if new
      await sql`
        INSERT INTO esp32_devices (id, status)
        VALUES (${esp32_id}, 'online')
        ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), status = 'online'
      `;
      
      // Update bag if exists
      const [bag] = await sql`
        UPDATE iv_bags 
        SET current_volume = ${volume}, flow_rate = ${flow_rate}, updated_at = NOW(),
            anomaly = ${checkAnomaly(volume, 500, flow_rate)}
        WHERE esp32_id = ${esp32_id} AND status = 'running'
        RETURNING *
      `;
      
      if (bag) {
        // Log the data
        await sql`
          INSERT INTO bag_logs (bag_id, volume, flow_rate)
          VALUES (${bag.id}, ${volume}, ${flow_rate})
        `;
      }
      
      return res.json({ success: true, bag });
    }
    
    // Machines endpoints
    if (pathname === '/api/machines/reported') {
      const machines = await sql`
        SELECT * FROM reported_machines 
        WHERE status = 'pending'
        ORDER BY reported_at DESC
      `;
      return res.json(machines);
    }
    
    if (pathname === '/api/machines/report' && req.method === 'POST') {
      const { esp32_id, room_bed } = req.body;
      const [machine] = await sql`
        INSERT INTO reported_machines (esp32_id, room_bed)
        VALUES (${esp32_id}, ${room_bed})
        RETURNING *
      `;
      return res.status(201).json(machine);
    }
    
    if (pathname.match(/^\/api\/machines\/[^/]+\/resolve$/) && req.method === 'PUT') {
      const esp32Id = pathname.split('/')[3];
      const [machine] = await sql`
        UPDATE reported_machines 
        SET status = 'resolved', resolved_at = NOW()
        WHERE esp32_id = ${esp32Id}
        RETURNING *
      `;
      return res.json(machine);
    }
    
    // 404
    return res.status(404).json({ error: 'Not found', path: pathname });
    
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}