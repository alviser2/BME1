import { pool } from '../db/postgres.js';

// ========== BAG MODEL ==========
export const bagModel = {
  // Lấy tất cả bags kèm thông tin patient
  async findAllWithPatient() {
    const query = `
      SELECT b.*, p.name as patient_name, p.room_bed, p.condition
      FROM iv_bags b
      JOIN patients p ON b.patient_id = p.id
      ORDER BY b.start_time DESC
    `;
    return (await pool.query(query)).rows;
  },

  // Lấy bags đang active (không completed)
  async findActiveWithPatient() {
    const query = `
      SELECT b.*, p.name as patient_name, p.room_bed, p.condition
      FROM iv_bags b
      JOIN patients p ON b.patient_id = p.id
      WHERE b.status != 'completed'
      ORDER BY b.start_time DESC
    `;
    return (await pool.query(query)).rows;
  },

  // Lấy bags theo patient ID
  async findByPatientId(patientId) {
    const query = `
      SELECT * FROM iv_bags WHERE patient_id = $1
      ORDER BY start_time DESC
    `;
    return (await pool.query(query, [patientId])).rows;
  },

  // Lấy bag theo ID
  async findById(id) {
    const query = `SELECT * FROM iv_bags WHERE id = $1`;
    return (await pool.query(query, [id])).rows[0];
  },

  // Tạo bag mới
  async create({ patientId, esp32Id, type, initialVolume, flowRate }) {
    const id = `b${Date.now()}`;
    const startTime = new Date().toISOString();
    const query = `
      INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, flow_rate, start_time, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'running')
      RETURNING *
    `;
    return (await pool.query(query, [id, patientId, esp32Id || null, type, initialVolume, flowRate, startTime])).rows[0];
  },

  // Cập nhật bag
  async update(id, { type, esp32Id, flowRate, status, emptyTimestamp }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (type !== undefined) { fields.push(`type = $${idx++}`); values.push(type); }
    if (esp32Id !== undefined) { fields.push(`esp32_id = $${idx++}`); values.push(esp32Id || null); }
    if (flowRate !== undefined) { fields.push(`flow_rate = $${idx++}`); values.push(flowRate); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    if (emptyTimestamp !== undefined) { fields.push(`empty_timestamp = $${idx++}`); values.push(emptyTimestamp || null); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE iv_bags SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    return (await pool.query(query, values)).rows[0];
  },

  // Xóa bag
  async delete(id) {
    const query = `DELETE FROM iv_bags WHERE id = $1 RETURNING *`;
    return (await pool.query(query, [id])).rows[0];
  },

  // Cập nhật từ ESP32 (volume + flowRate)
  async updateFromESP32(esp32Id, { volume, flowRate }) {
    const now = new Date().toISOString();
    let status = 'running';
    let emptyTimestamp = null;

    if (volume <= 0) {
      status = 'empty';
      emptyTimestamp = now;
    }

    const query = `
      UPDATE iv_bags
      SET current_volume = $2,
          flow_rate = $3,
          status = $4,
          empty_timestamp = $5,
          updated_at = $6
      WHERE esp32_id = $1 AND status IN ('running', 'empty')
      RETURNING *
    `;
    return (await pool.query(query, [esp32Id, Math.max(0, volume), flowRate, status, emptyTimestamp, now])).rows[0];
  },

  // Lấy history logs cho chart (limit để tránh quá nặng)
  async getHistoryLogs(bagId, limit = 500) {
    const query = `
      SELECT time, volume, flow_rate
      FROM bag_logs
      WHERE bag_id = $1
      ORDER BY time ASC
      LIMIT $2
    `;
    return (await pool.query(query, [bagId, limit])).rows;
  },

  // Ghi log mới
  async insertLog(bagId, { volume, flowRate }) {
    const now = new Date().toISOString();
    const query = `
      INSERT INTO bag_logs (bag_id, time, volume, flow_rate)
      VALUES ($1, $2, $3, $4)
    `;
    return (await pool.query(query, [bagId, now, volume, flowRate]));
  },

  // Auto complete bag (empty -> completed sau 3 phút)
  async autoCompleteEmpty() {
    const query = `
      UPDATE iv_bags
      SET status = 'completed', updated_at = NOW()
      WHERE status = 'empty'
        AND empty_timestamp IS NOT NULL
        AND (NOW() - empty_timestamp) > INTERVAL '3 minutes'
      RETURNING *
    `;
    return (await pool.query(query)).rows;
  }
};
