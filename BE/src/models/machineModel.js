import { pool } from '../db/mysql.js';

// ========== MACHINE MODEL (MySQL) ==========
export const machineModel = {
  // Lấy danh sách máy đang báo lỗi
  async findReported() {
    const query = `
      SELECT * FROM reported_machines
      WHERE status = 'pending'
      ORDER BY reported_at DESC
    `;
    const [rows] = await pool.query(query);
    return rows;
  },

  // Báo cáo máy lỗi
  async report({ esp32Id, roomBed }) {
    const reportedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
      INSERT INTO reported_machines (esp32_id, room_bed, reported_at, status)
      VALUES (?, ?, ?, 'pending')
    `;
    await pool.query(query, [esp32Id, roomBed, reportedAt]);
    
    // Lấy record vừa tạo
    const [rows] = await pool.query(
      'SELECT * FROM reported_machines WHERE esp32_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [esp32Id, 'pending']
    );
    return rows[0];
  },

  // Resolve machine (đánh dấu đã sửa xong)
  async resolve(esp32Id) {
    const resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const query = `
      UPDATE reported_machines
      SET status = 'resolved', resolved_at = ?
      WHERE esp32_id = ? AND status = 'pending'
    `;
    await pool.query(query, [resolvedAt, esp32Id]);
    
    // Lấy record sau khi update
    const [rows] = await pool.query(
      'SELECT * FROM reported_machines WHERE esp32_id = ? ORDER BY id DESC LIMIT 1',
      [esp32Id]
    );
    return rows[0];
  },

  // Xóa báo cáo
  async delete(id) {
    const query = `DELETE FROM reported_machines WHERE id = ?`;
    const [result] = await pool.query(query, [id]);
    return result.affectedRows > 0 ? { id } : null;
  }
};
