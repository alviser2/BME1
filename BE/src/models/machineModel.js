import { pool } from '../db/postgres.js';

// ========== MACHINE MODEL ==========
export const machineModel = {
  // Lấy danh sách máy đang báo lỗi
  async findReported() {
    const query = `
      SELECT * FROM reported_machines
      WHERE status = 'pending'
      ORDER BY reported_at DESC
    `;
    return (await pool.query(query)).rows;
  },

  // Báo cáo máy lỗi
  async report({ esp32Id, roomBed }) {
    const reportedAt = new Date().toISOString();
    const query = `
      INSERT INTO reported_machines (esp32_id, room_bed, reported_at, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `;
    return (await pool.query(query, [esp32Id, roomBed, reportedAt])).rows[0];
  },

  // Resolve machine (đánh dấu đã sửa xong)
  async resolve(esp32Id) {
    const resolvedAt = new Date().toISOString();
    const query = `
      UPDATE reported_machines
      SET status = 'resolved', resolved_at = $2
      WHERE esp32_id = $1 AND status = 'pending'
      RETURNING *
    `;
    return (await pool.query(query, [esp32Id, resolvedAt])).rows[0];
  },

  // Xóa báo cáo
  async delete(id) {
    const query = `DELETE FROM reported_machines WHERE id = $1 RETURNING *`;
    return (await pool.query(query, [id])).rows[0];
  }
};
