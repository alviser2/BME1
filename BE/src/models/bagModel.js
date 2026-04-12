import { pool } from '../db/mysql.js';

// ========== BAG MODEL (MySQL) ==========
export const bagModel = {
  // Lấy tất cả bags kèm thông tin patient
  async findAllWithPatient() {
    const query = `
      SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
      FROM iv_bags b
      JOIN patients p ON b.patient_id = p.id
      ORDER BY b.start_time DESC
    `;
    const [rows] = await pool.query(query);
    return rows;
  },

  // Lấy bags đang active (không completed)
  async findActiveWithPatient() {
    const query = `
      SELECT b.*, p.name as patient_name, p.room, p.bed, p.condition
      FROM iv_bags b
      JOIN patients p ON b.patient_id = p.id
      WHERE b.status != 'completed'
      ORDER BY b.start_time DESC
    `;
    const [rows] = await pool.query(query);
    return rows;
  },

  // Lấy bags theo patient ID
  async findByPatientId(patientId) {
    const query = `SELECT * FROM iv_bags WHERE patient_id = ? ORDER BY start_time DESC`;
    const [rows] = await pool.query(query, [patientId]);
    return rows;
  },

  // Lấy bag theo ID
  async findById(id) {
    const query = `SELECT * FROM iv_bags WHERE id = ?`;
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  },

  // Tạo bag mới
  async create({ patientId, esp32Id, type, initialVolume, flowRate }) {
    const id = `b${Date.now()}`;
    const startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
      INSERT INTO iv_bags (id, patient_id, esp32_id, type, initial_volume, current_volume, flow_rate, start_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running')
    `;
    await pool.query(query, [id, patientId, esp32Id || null, type, initialVolume, initialVolume, flowRate, startTime]);
    return this.findById(id);
  },

  // Cập nhật bag
  async update(id, { type, esp32Id, flowRate, status, currentVolume, emptyTimestamp }) {
    const fields = [];
    const values = [];

    if (type !== undefined) { fields.push('type = ?'); values.push(type); }
    if (esp32Id !== undefined) { fields.push('esp32_id = ?'); values.push(esp32Id || null); }
    if (flowRate !== undefined) { fields.push('flow_rate = ?'); values.push(flowRate); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (currentVolume !== undefined) { fields.push('current_volume = ?'); values.push(currentVolume); }
    if (emptyTimestamp !== undefined) { fields.push('empty_timestamp = ?'); values.push(emptyTimestamp || null); }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `UPDATE iv_bags SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(query, values);
    return this.findById(id);
  },

  // Xóa bag
  async delete(id) {
    const query = `DELETE FROM iv_bags WHERE id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0 ? { id } : null;
  },

  // Cập nhật từ ESP32 (volume + flowRate) + kiểm tra bất thường
  async updateFromESP32(esp32Id, { volume, flowRate }) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let status = 'running';
    let emptyTimestamp = null;

    // Lấy bag hiện tại để check bất thường
    const currentBag = await this.findByEsp32Id(esp32Id);
    if (!currentBag) return null;

    // Kiểm tra bất thường: volume giảm quá nhanh so với flow_rate ban đầu
    let anomaly = null;
    if (volume > 0 && currentBag.initial_volume > 0) {
      const expectedReductionPerCheck = (currentBag.flow_rate / 20 / 60) * 5; // ml giảm trong 5s
      const actualReduction = currentBag.current_volume - volume;

      // Nếu giảm gấp 3 lần so với expected → bất thường
      if (actualReduction > expectedReductionPerCheck * 3 && actualReduction > 10) {
        anomaly = {
          type: 'FAST_DRAIN',
          message: `Volume giảm nhanh bất thường: giảm ${actualReduction.toFixed(1)}ml trong 5s (expected: ${expectedReductionPerCheck.toFixed(1)}ml)`,
          actualReduction: actualReduction,
          expectedReduction: expectedReductionPerCheck
        };
      }
    }

    if (volume <= 0) {
      status = 'empty';
      emptyTimestamp = now;
    }

    const query = `
      UPDATE iv_bags
      SET current_volume = ?,
          flow_rate = ?,
          status = ?,
          empty_timestamp = ?,
          updated_at = ?
      WHERE esp32_id = ? AND status IN ('running', 'empty')
    `;
    await pool.query(query, [Math.max(0, volume), flowRate, status, emptyTimestamp, now, esp32Id]);

    // Lấy kết quả sau update
    const updatedBag = await this.findByEsp32Id(esp32Id);

    // Ghi log (5s一次)
    if (updatedBag) {
      await this.insertLog(updatedBag.id, { volume: Math.max(0, volume), flowRate });
    }

    return updatedBag ? { bag: updatedBag, anomaly } : null;
  },

  // Lấy bag theo ESP32 ID
  async findByEsp32Id(esp32Id) {
    const query = `SELECT * FROM iv_bags WHERE esp32_id = ? AND status != 'completed' LIMIT 1`;
    const [rows] = await pool.query(query, [esp32Id]);
    return rows[0];
  },

  // Lấy history logs cho chart (limit để tránh quá nặng)
  async getHistoryLogs(bagId, limit = 500) {
    const query = `
      SELECT time, volume, flow_rate
      FROM bag_logs
      WHERE bag_id = ?
      ORDER BY time ASC
      LIMIT ?
    `;
    const [rows] = await pool.query(query, [bagId, limit]);
    return rows;
  },

  // Export data (volume + flowRate) cho analysis
  async exportData(bagId, startTime = null, endTime = null) {
    let query = `
      SELECT time, volume, flow_rate
      FROM bag_logs
      WHERE bag_id = ?
    `;
    const params = [bagId];

    if (startTime) {
      params.push(startTime);
      query += ` AND time >= ?`;
    }
    if (endTime) {
      params.push(endTime);
      query += ` AND time <= ?`;
    }

    query += ` ORDER BY time ASC`;
    const [rows] = await pool.query(query, params);
    return rows;
  },

  // Ghi log mới
  async insertLog(bagId, { volume, flowRate }) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
      INSERT INTO bag_logs (bag_id, time, volume, flow_rate)
      VALUES (?, ?, ?, ?)
    `;
    return await pool.query(query, [bagId, now, volume, flowRate]);
  },

  // Auto complete bag (empty -> completed sau 3 phút)
  async autoCompleteEmpty() {
    const query = `
      UPDATE iv_bags
      SET status = 'completed', updated_at = NOW()
      WHERE status = 'empty'
        AND empty_timestamp IS NOT NULL
        AND TIMESTAMPDIFF(MINUTE, empty_timestamp, NOW()) >= 3
    `;
    const [result] = await pool.query(query);
    return result.affectedRows;
  },

  // Kiểm tra tất cả bags cho bất thường (chạy mỗi 5s)
  async checkAllBagsForAnomalies() {
    const query = `
      SELECT b.*, p.name as patient_name
      FROM iv_bags b
      JOIN patients p ON b.patient_id = p.id
      WHERE b.status = 'running' AND b.esp32_id IS NOT NULL
    `;
    const [bags] = await pool.query(query);
    const anomalies = [];

    for (const bag of bags) {
      if (bag.current_volume <= 0 || bag.initial_volume <= 0) continue;

      // Tính expected giảm trong 5s theo flow_rate hiện tại
      const expectedReductionPerCheck = (bag.flow_rate / 20 / 60) * 5;

      // Lấy log gần nhất trước đó để so sánh
      const lastLogQuery = `
        SELECT volume FROM bag_logs
        WHERE bag_id = ?
        ORDER BY time DESC
        LIMIT 2
      `;
      const [lastLogs] = await pool.query(lastLogQuery, [bag.id]);

      if (lastLogs.length >= 2) {
        const actualReduction = lastLogs[1].volume - bag.current_volume;

        // Ngưỡng bất thường: giảm gấp 3 lần hoặc giảm >30ml trong khi expected <20ml
        if (actualReduction > expectedReductionPerCheck * 3 && actualReduction > 30) {
          anomalies.push({
            bagId: bag.id,
            patientName: bag.patient_name,
            esp32Id: bag.esp32_id,
            type: 'FAST_DRAIN',
            message: `Tốc độ drain bất thường: giảm ${actualReduction.toFixed(1)}ml/5s (expected: ${expectedReductionPerCheck.toFixed(1)}ml)`,
            currentVolume: bag.current_volume,
            flowRate: bag.flow_rate,
            expectedReduction: expectedReductionPerCheck,
            actualReduction: actualReduction,
            severity: actualReduction > expectedReductionPerCheck * 5 ? 'HIGH' : 'MEDIUM'
          });
        }
      }
    }

    return anomalies;
  }
};
