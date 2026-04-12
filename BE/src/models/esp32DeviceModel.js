import { pool } from '../db/mysql.js';

export const esp32DeviceModel = {
  // Lấy tất cả ESP32 devices
  async findAll() {
    const query = `SELECT * FROM esp32_devices ORDER BY registered_at DESC`;
    const [rows] = await pool.query(query);
    return rows;
  },

  // Lấy ESP32 theo ID (MAC)
  async findById(id) {
    const query = `SELECT * FROM esp32_devices WHERE id = ?`;
    const [rows] = await pool.query(query, [id]);
    return rows[0];
  },

  // Đăng ký ESP32 mới (auto called khi ESP32 gửi data lần đầu)
  async register(id) {
    const existing = await this.findById(id);
    if (existing) return existing;

    const query = `
      INSERT INTO esp32_devices (id, registered_at, last_seen_at, status)
      VALUES (?, NOW(), NOW(), 'online')
    `;
    await pool.query(query, [id]);
    return this.findById(id);
  },

  // Cập nhật last_seen (gọi mỗi khi ESP32 gửi data)
  async updateLastSeen(id) {
    const query = `
      UPDATE esp32_devices
      SET last_seen_at = NOW(), status = 'online'
      WHERE id = ?
    `;
    await pool.query(query, [id]);
    return this.findById(id);
  },

  // Đánh dấu offline (gọi periodly hoặc khi timeout)
  async markOffline(id) {
    const query = `
      UPDATE esp32_devices
      SET status = 'offline'
      WHERE id = ?
    `;
    await pool.query(query, [id]);
    return this.findById(id);
  },

  // Lấy các thiết bị offline (không seen > 30s)
  async findOfflineDevices() {
    const query = `
      SELECT * FROM esp32_devices
      WHERE status = 'online'
        AND last_seen_at < NOW() - INTERVAL 30 SECOND
    `;
    const [rows] = await pool.query(query);
    return rows;
  },

  // Auto register + update last_seen - gọi trong esp32Update webhook
  async registerOrUpdate(id) {
    const existing = await this.findById(id);
    if (!existing) {
      return this.register(id);
    }
    return this.updateLastSeen(id);
  }
};
